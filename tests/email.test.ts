import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { makeTestDirectory } from './helpers/test-paths';
import { join } from 'node:path';
import { validateRegistration } from '../src/core/registration';
import { createLeaderboardStore } from '../server/leaderboard.mjs';
import { exportPassports } from '../server/export-passports.mjs';

const fields = (email = '') => ({ lastName: 'Тестовый', firstName: 'Участник', company: 'Компания', phone: '+79000000000', telegram: '', email });
const payload = (email?: unknown) => ({
  id: randomUUID(), passportToken: randomUUID(), difficulty: 'easy', budget: 500,
  results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })),
  player: { firstName: 'Участник', lastName: 'Тестовый', company: 'Компания', contact: '+79000000000', phone: '+79000000000', telegram: '', consentVersion: 'draft', consentAcceptedAt: '2026-10-14T09:00:00.000Z', ...(email === undefined ? {} : { email }) },
});
const stores: ReturnType<typeof createLeaderboardStore>[] = [];
const folders: string[] = [];
const makeStore = (path = ':memory:') => { const store = createLeaderboardStore(path); stores.push(store); return store; };
const folder = () => { const value = makeTestDirectory('unit-email', 'cto-email-'); folders.push(value); return value; };
afterEach(() => { stores.splice(0).forEach(store => store.close()); folders.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); });

describe('optional email registration', () => {
  it.each(['', '   ', ' Test.Player+game@example.com '])('allows optional email %j and trims only its surrounding spaces', email => {
    const result = validateRegistration(fields(email), true);
    expect(result.errors).toEqual({});
    expect(result.fields).toHaveProperty('email', email.trim());
  });
  it.each(['not-an-email', 'user@', '@example.com', 'user@@example.com', 'user name@example.com', 'user@.example.com', 'a'.repeat(255) + '@example.com'])('explains a malformed provided email %j', email => {
    expect(validateRegistration(fields(email), true).errors).toHaveProperty('email', expect.any(String));
  });
  it('email alone does not replace the required phone or Telegram', () => {
    const result = validateRegistration({ ...fields('test@example.com'), phone: '' }, true);
    expect(result.errors).toHaveProperty('phone');
    expect(result.errors).toHaveProperty('telegram');
    expect(result.errors).not.toHaveProperty('email');
  });
});

describe('private email storage and compatibility', () => {
  it('stores email, exports it with the passport and omits it from public and staff rankings', () => {
    const dir = folder(), path = join(dir, 'results.sqlite'), store = makeStore(path), run = payload(' Test.Player+game@example.com ');
    store.submit(run); store.submit(run); store.attachPassport(run.id, run.passportToken, '0017');
    expect(store.passportRows()[0]).toHaveProperty('email', 'Test.Player+game@example.com');
    const reader = new DatabaseSync(path);
    try { expect(reader.prepare('SELECT email FROM runs WHERE id = ?').get(run.id)?.email).toBe('Test.Player+game@example.com'); } finally { reader.close(); }
    expect(store.list('easy').total).toBe(1);
    expect(JSON.stringify(store.list('easy', run.id))).not.toMatch(/email|example\.com/);
    expect(JSON.stringify(store.adminList('easy', true))).not.toMatch(/email|example\.com/);
    const output = join(dir, 'passports.csv');
    expect(exportPassports(path, output)).toBe(1);
    expect(readFileSync(output, 'utf8')).toContain('Почта');
    expect(readFileSync(output, 'utf8')).toContain('Test.Player+game@example.com');
    expect(() => store.submit({ ...run, player: { ...run.player, email: 'other@example.com' } })).toThrow();
  });
  it.each([null, 123, 'bad-email', 'a@b', 'user@@example.com', 'a'.repeat(255) + '@example.com'])('the API rejects an invalid provided email %j', email => {
    const store = makeStore();
    expect(() => store.submit(payload(email))).toThrow();
    expect(store.list('easy').total).toBe(0);
  });
  it('migrates the phone/Telegram schema without changing old hashes or retrying old results', () => {
    const path = join(folder(), 'previous.sqlite'), run = payload();
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE runs (
      id TEXT PRIMARY KEY, difficulty TEXT NOT NULL, rooms INTEGER NOT NULL, budget INTEGER NOT NULL,
      first_name TEXT NOT NULL, company TEXT NOT NULL, last_name TEXT NOT NULL, contact TEXT NOT NULL,
      consent_version TEXT NOT NULL, consent_accepted_at TEXT NOT NULL, received_at TEXT NOT NULL,
      payload_hash TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', telegram TEXT NOT NULL DEFAULT ''
    )`);
    const player = Object.fromEntries(['firstName', 'lastName', 'company', 'contact', 'consentVersion', 'consentAcceptedAt', 'phone', 'telegram'].map(key => [key, run.player[key as keyof typeof run.player]]));
    const hash = createHash('sha256').update(JSON.stringify({ id: run.id, difficulty: run.difficulty, budget: run.budget, rooms: 4, player })).digest('hex');
    old.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(run.id, 'easy', 4, 500, player.firstName, player.company, player.lastName, player.contact, player.consentVersion, player.consentAcceptedAt, '2026-10-14T09:00:00.000Z', hash, player.phone, player.telegram);
    old.close();
    const store = makeStore(path);
    const { passportToken, ...oldSubmission } = run;
    expect(() => store.submit(oldSubmission)).not.toThrow();
    expect(() => store.submit({ ...oldSubmission, player: { ...oldSubmission.player, email: '' } })).not.toThrow();
    expect(store.list('easy').total).toBe(1);
    const reader = new DatabaseSync(path);
    try { expect(reader.prepare('SELECT email, payload_hash FROM runs WHERE id = ?').get(run.id)).toEqual({ email: '', payload_hash: hash }); } finally { reader.close(); }
  });
  it('exports an unmigrated previous database with an empty email column', () => {
    const dir = folder(), path = join(dir, 'previous.sqlite'), store = makeStore(path), run = payload();
    store.submit(run); store.attachPassport(run.id, run.passportToken, '0018');
    store.close(); stores.pop();
    const db = new DatabaseSync(path);
    if (db.prepare('PRAGMA table_info(runs)').all().some(row => row.name === 'email')) db.exec('ALTER TABLE runs DROP COLUMN email');
    db.close();
    const output = join(dir, 'previous.csv');
    expect(exportPassports(path, output)).toBe(1);
    expect(readFileSync(output, 'utf8')).toContain('Почта');
  });
});
