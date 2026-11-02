import { DatabaseSync } from 'node:sqlite';
import { createHash, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const difficulties = ['easy', 'standard', 'hardcore'];
const rooms = ['server', 'office', 'perimeter', 'production'];
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function check(condition) { if (!condition) throw new ApiError(400, 'Некорректные данные результата.'); }
function clean(value) { check(typeof value === 'string' && value.trim().length > 0 && value.length <= 100); return value.trim().replace(/\s+/g, ' '); }
const tokenHash = token => createHash('sha256').update(token.toLowerCase()).digest('hex');
function optionalContact(value, maximum = 100) { if (value === undefined) return ''; check(typeof value === 'string' && value.length <= maximum); return value.trim(); }
function normalize(data) {
  check(data && typeof data === 'object' && uuid.test(data.id));
  check(difficulties.includes(data.difficulty));
  check(Number.isSafeInteger(data.budget) && data.budget >= 0 && data.budget <= 10_000_000);
  check(Array.isArray(data.results) && data.results.length === 4);
  check(rooms.every(id => data.results.filter(row => row?.id === id).length === 1));
  check(data.results.every(row => ['success', 'timeout', 'sla', 'fire'].includes(row.reason)));
  check(data.player && typeof data.player === 'object');
  const structuredContacts = Object.hasOwn(data.player, 'phone') || Object.hasOwn(data.player, 'telegram');
  const phone = structuredContacts ? optionalContact(data.player.phone) : '';
  const telegram = structuredContacts ? optionalContact(data.player.telegram) : '';
  if (structuredContacts) {
    check(phone !== '' || telegram !== '');
    check(phone === '' || /^\+?\d{7,15}$/.test(phone));
    check(telegram === '' || /^@[a-z\d_]{3,32}$/i.test(telegram));
  }
  // Keep the legacy normalized shape and its hash stable for already saved runs.
  const contact = structuredContacts ? phone || telegram : clean(data.player.contact);
  const player = Object.fromEntries(['firstName', 'lastName', 'company', 'contact', 'consentVersion', 'consentAcceptedAt'].map(key => [key, key === 'contact' ? contact : clean(data.player[key])]));
  check(/^\+?\d{7,15}$/.test(player.contact) || /^@[a-z\d_]{3,32}$/i.test(player.contact));
  if (structuredContacts) Object.assign(player, { phone, telegram });
  const email = optionalContact(data.player.email, 254);
  check(email === '' || /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email));
  // Omitted and empty email must retain the pre-email hash for old retries.
  if (email) player.email = email;
  check(Number.isFinite(Date.parse(player.consentAcceptedAt)));
  return { id: data.id, difficulty: data.difficulty, budget: data.budget, rooms: data.results.filter(row => row.reason === 'success').length, player };
}

export function createLeaderboardStore(filename) {
  if (filename !== ':memory:') {
    mkdirSync(dirname(resolve(filename)), { recursive: true, mode: 0o700 });
  }
  const db = new DatabaseSync(filename);
  if (filename !== ':memory:') chmodSync(filename, 0o600);
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, difficulty TEXT NOT NULL, rooms INTEGER NOT NULL, budget INTEGER NOT NULL,
      first_name TEXT NOT NULL, company TEXT NOT NULL, last_name TEXT NOT NULL, contact TEXT NOT NULL,
      consent_version TEXT NOT NULL, consent_accepted_at TEXT NOT NULL,
      received_at TEXT NOT NULL, payload_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '', telegram TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS runs_ranking ON runs(difficulty, rooms DESC, budget DESC);
    CREATE TABLE IF NOT EXISTS run_claims (
      run_id TEXT PRIMARY KEY REFERENCES runs(id), token_hash TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_passports (
      run_id TEXT PRIMARY KEY REFERENCES runs(id), passport_number TEXT NOT NULL,
      number_key TEXT NOT NULL UNIQUE, assigned_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS run_visibility (
      run_id TEXT PRIMARY KEY REFERENCES runs(id), hidden INTEGER NOT NULL CHECK(hidden IN (0, 1)),
      changed_at TEXT NOT NULL
    );`);
  db.exec('BEGIN IMMEDIATE');
  try {
    const columns = new Set(db.prepare('PRAGMA table_info(runs)').all().map(column => column.name));
    const missing = ['phone', 'telegram'].filter(column => !columns.has(column));
    for (const column of missing) db.exec(`ALTER TABLE runs ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    if (!columns.has('email')) db.exec("ALTER TABLE runs ADD COLUMN email TEXT NOT NULL DEFAULT ''");
    if (missing.length) db.exec(`UPDATE runs SET
      phone = CASE WHEN contact LIKE '@%' THEN '' ELSE contact END,
      telegram = CASE WHEN contact LIKE '@%' THEN contact ELSE '' END
      WHERE phone = '' AND telegram = ''`);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); db.close(); throw error; }
  const visible = 'NOT EXISTS (SELECT 1 FROM run_visibility WHERE run_id = runs.id AND hidden = 1)';
  const ranked = `SELECT id, first_name AS firstName, company, rooms, budget,
    ROW_NUMBER() OVER (ORDER BY rooms DESC, budget DESC, rowid ASC) AS rank
    FROM runs WHERE difficulty = ? AND ${visible}`;
  return {
    submit(data) {
      const value = normalize(data);
      const token = data.passportToken;
      check(token === undefined || (typeof token === 'string' && uuid.test(token)));
      const hash = createHash('sha256').update(JSON.stringify(value)).digest('hex');
      const previous = db.prepare('SELECT payload_hash FROM runs WHERE id = ?').get(value.id);
      if (previous) {
        if (previous.payload_hash !== hash) throw new ApiError(409, 'Этот результат уже сохранён.');
        if (token !== undefined && db.prepare('SELECT token_hash FROM run_claims WHERE run_id = ?').get(value.id)?.token_hash !== tokenHash(token)) {
          throw new ApiError(409, 'Этот результат уже сохранён другой сессией.');
        }
        return;
      }
      const p = value.player;
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO runs (id, difficulty, rooms, budget, first_name, company, last_name,
          contact, consent_version, consent_accepted_at, received_at, payload_hash, phone, telegram, email)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
          value.id, value.difficulty, value.rooms, value.budget, p.firstName, p.company, p.lastName,
          p.contact, p.consentVersion, p.consentAcceptedAt, new Date().toISOString(), hash,
          p.phone ?? (p.contact.startsWith('@') ? '' : p.contact), p.telegram ?? (p.contact.startsWith('@') ? p.contact : ''), p.email ?? '',
        );
        if (token !== undefined) db.prepare('INSERT INTO run_claims VALUES (?, ?)').run(value.id, tokenHash(token));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    attachPassport(id, token, number) {
      if (typeof id !== 'string' || !uuid.test(id) || typeof token !== 'string' || !uuid.test(token)) {
        throw new ApiError(403, 'Не удалось подтвердить эту попытку.');
      }
      const claim = db.prepare('SELECT token_hash FROM run_claims WHERE run_id = ?').get(id);
      if (!claim || !timingSafeEqual(Buffer.from(claim.token_hash, 'hex'), Buffer.from(tokenHash(token), 'hex'))) {
        throw new ApiError(403, 'Не удалось подтвердить эту попытку.');
      }
      if (typeof number !== 'string' || !/^\d{1,20}$/.test(number.trim())) {
        throw new ApiError(400, 'Введите номер паспорта: от 1 до 20 цифр.');
      }
      const passportNumber = number.trim(), key = passportNumber.replace(/^0+(?=\d)/, '');
      try {
        db.prepare(`INSERT INTO run_passports VALUES (?, ?, ?, ?)
          ON CONFLICT(run_id) DO UPDATE SET passport_number = excluded.passport_number,
            number_key = excluded.number_key, assigned_at = excluded.assigned_at
          WHERE run_passports.passport_number <> excluded.passport_number`).run(id, passportNumber, key, new Date().toISOString());
      } catch (error) {
        if (error.message.includes('UNIQUE constraint failed: run_passports.number_key')) {
          throw new ApiError(409, 'Этот номер паспорта уже привязан к другой попытке. Проверьте номер на бумажном паспорте.');
        }
        throw error;
      }
      return { passportNumber };
    },
    passportRows() {
      return db.prepare(`SELECT runs.id, first_name, last_name, company, contact, phone, telegram, email, difficulty, rooms, budget,
        received_at, passport_number, assigned_at FROM run_passports JOIN runs ON runs.id = run_passports.run_id
        ORDER BY assigned_at, runs.rowid`).all();
    },
    setHidden(id, hidden) {
      check(typeof id === 'string' && uuid.test(id) && typeof hidden === 'boolean');
      if (!db.prepare('SELECT 1 FROM runs WHERE id = ?').get(id)) throw new ApiError(404, 'Результат не найден.');
      // Visibility is independent of the immutable run, its contacts and paper passport.
      db.prepare(`INSERT INTO run_visibility VALUES (?, ?, ?)
        ON CONFLICT(run_id) DO UPDATE SET hidden = excluded.hidden, changed_at = excluded.changed_at
        WHERE run_visibility.hidden <> excluded.hidden`).run(id, Number(hidden), new Date().toISOString());
      return { id, hidden };
    },
    adminList(difficulty, showHidden = false, page = 0) {
      check(difficulties.includes(difficulty) && typeof showHidden === 'boolean');
      check(Number.isSafeInteger(page) && page >= 0 && page <= 1_000_000);
      const filter = `runs.difficulty = ?${showHidden ? '' : ` AND ${visible}`}`;
      const total = db.prepare(`SELECT COUNT(*) AS total FROM runs WHERE ${filter}`).get(difficulty).total;
      const entries = db.prepare(`WITH ranked AS (${ranked})
        SELECT runs.id, runs.first_name AS firstName, runs.last_name AS lastName, runs.company,
          runs.rooms, runs.budget, runs.received_at AS receivedAt, ranked.rank,
          COALESCE(run_visibility.hidden, 0) AS hidden
        FROM runs LEFT JOIN run_visibility ON run_visibility.run_id = runs.id
        LEFT JOIN ranked ON ranked.id = runs.id WHERE ${filter}
        ORDER BY runs.rooms DESC, runs.budget DESC, runs.rowid ASC LIMIT 100 OFFSET ?`).all(difficulty, difficulty, page * 100)
        .map(row => ({ ...row, hidden: Boolean(row.hidden) }));
      return { entries, total, page, hasMore: (page + 1) * 100 < total };
    },
    list(difficulty, currentId = '') {
      check(difficulties.includes(difficulty));
      check(currentId === '' || uuid.test(currentId));
      return {
        entries: db.prepare(`${ranked} ORDER BY rank LIMIT 100`).all(difficulty),
        current: currentId ? db.prepare(`SELECT * FROM (${ranked}) WHERE id = ?`).get(difficulty, currentId) ?? null : null,
        total: db.prepare(`SELECT COUNT(*) AS total FROM runs WHERE difficulty = ? AND ${visible}`).get(difficulty).total,
      };
    },
    close() { db.close(); },
  };
}

export function createLeaderboardApi(filename = process.env.LEADERBOARD_DB_PATH || 'data/leaderboard.sqlite', { adminToken = process.env.LEADERBOARD_ADMIN_TOKEN } = {}) {
  const store = createLeaderboardStore(filename);
  const adminHash = typeof adminToken === 'string' && adminToken.length >= 24 && adminToken.length <= 256
    ? createHash('sha256').update(adminToken).digest() : null;
  const requireAdmin = req => {
    if (!adminHash) throw new ApiError(503, 'Управление ещё не настроено. Запустите игру через «Играть.command» или задайте ключ сотрудника на сервере.');
    const authorization = req.headers.authorization || '';
    const key = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
    if (!key || !timingSafeEqual(adminHash, createHash('sha256').update(key).digest())) {
      throw new ApiError(401, 'Ключ сотрудника не подходит. Проверьте ключ и попробуйте ещё раз.');
    }
  };
  const handler = async (req, res, next = () => { res.writeHead(404); res.end(); }) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/')) { next(); return; }
    const reply = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(JSON.stringify(data));
    };
    try {
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') {
        reply(200, store.list(url.searchParams.get('difficulty') || 'easy', url.searchParams.get('current') || '')); return;
      }
      const adminBoard = url.pathname === '/api/admin/leaderboard';
      const visibilityRoute = /^\/api\/admin\/runs\/([\da-f-]{36})\/visibility$/i.exec(url.pathname);
      if (adminBoard || visibilityRoute) requireAdmin(req);
      if (adminBoard) {
        if (req.method !== 'GET') { reply(405, { error: 'Метод не поддерживается.' }); return; }
        const showHidden = url.searchParams.get('showHidden') || 'false', page = url.searchParams.get('page') || '0';
        check(['true', 'false'].includes(showHidden) && /^\d+$/.test(page));
        reply(200, store.adminList(url.searchParams.get('difficulty') || 'easy', showHidden === 'true', Number(page))); return;
      }
      const passportRoute = /^\/api\/runs\/([\da-f-]{36})\/passport$/i.exec(url.pathname);
      if (url.pathname !== '/api/runs' && !passportRoute && !visibilityRoute) { reply(404, { error: 'Не найдено.' }); return; }
      if (req.method !== 'POST') { reply(405, { error: 'Метод не поддерживается.' }); return; }
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw new ApiError(403, 'Недопустимый источник запроса.');
      if (!req.headers['content-type']?.startsWith('application/json')) throw new ApiError(415, 'Ожидается JSON.');
      let size = 0; const chunks = [];
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 16_384) throw new ApiError(413, 'Запрос слишком большой.');
        chunks.push(chunk);
      }
      let data;
      try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new ApiError(400, 'Некорректный JSON.'); }
      if (visibilityRoute) reply(200, store.setHidden(visibilityRoute[1], data?.hidden));
      else if (passportRoute) reply(200, store.attachPassport(passportRoute[1], data?.passportToken, data?.passportNumber));
      else { store.submit(data); reply(200, store.list(data.difficulty, data.id)); }
    } catch (error) {
      reply(error instanceof ApiError ? error.status : 503, { error: error instanceof ApiError ? error.message : 'Таблица лидеров временно недоступна.' });
    }
  };
  return { handler, close: () => store.close() };
}
