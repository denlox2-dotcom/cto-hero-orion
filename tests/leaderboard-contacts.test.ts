import { afterEach, describe, expect, it } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { makeTestDirectory } from './helpers/test-paths';
import { join } from 'node:path';
import { createLeaderboardStore } from '../server/leaderboard.mjs';

const stores: ReturnType<typeof createLeaderboardStore>[] = [];
const folders: string[] = [];
const makeStore = (path = ':memory:') => { const value = createLeaderboardStore(path); stores.push(value); return value; };
const databasePath = () => { const folder = makeTestDirectory('unit-leaderboard-contacts', 'cto-contacts-'); folders.push(folder); return join(folder, 'results.sqlite'); };
const payload = (phone = '', telegram = '') => ({
  id: randomUUID(), difficulty: 'easy', budget: 500,
  results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })),
  player: { firstName: 'Тестовый', lastName: 'Участник', company: 'Тестовая компания', contact: '', phone, telegram, consentVersion: 'draft-game-registration-2026-10-04', consentAcceptedAt: '2026-10-13T09:00:00.000Z' },
});
afterEach(() => { for (const store of stores.splice(0)) store.close(); for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe('private separate contacts in the shared leaderboard', () => {
  it.each([['+79000000000', ''], ['', '@test_private'], ['+79000000000', '@test_private']])('stores phone %s and Telegram %s without exposing them', (phone, telegram) => {
    const path = databasePath(); const store = makeStore(path); const run = payload(phone, telegram);
    store.submit(run); store.submit(run);
    const board = store.list('easy', run.id);
    expect(board.total).toBe(1);
    expect(Object.keys(board.entries[0]).sort()).toEqual(['budget', 'company', 'firstName', 'id', 'rank', 'rooms'].sort());
    expect(JSON.stringify(board)).not.toMatch(/phone|telegram|contact|79000000000|test_private/);
    store.close(); stores.pop();
    const reader = new DatabaseSync(path);
    try { expect(reader.prepare('SELECT phone, telegram FROM runs WHERE id = ?').get(run.id)).toEqual({ phone, telegram }); }
    finally { reader.close(); }
  });

  it.each([['', ''], ['123', '@test_private'], ['+79000000000', '@a'], ['', '+79000000000']])('rejects absent or malformed structured contacts (%s, %s)', (phone, telegram) => {
    const store = makeStore(); const run = payload(phone, telegram);
    // A legacy contact must not bypass invalid explicitly supplied new fields.
    run.player.contact = '@legacy_test';
    expect(() => store.submit(run)).toThrow();
    expect(store.list('easy').total).toBe(0);
  });

  it('migrates the previous schema and keeps old results and repeat submissions intact', () => {
    const path = databasePath();
    const legacyRuns = ['+79000000000', '@test_legacy'].map(contact => {
      const run = payload(); const { phone, telegram, ...player } = run.player;
      return { ...run, player: { ...player, contact } };
    });
    const legacy = new DatabaseSync(path);
    legacy.exec(`CREATE TABLE runs (
      id TEXT PRIMARY KEY, difficulty TEXT NOT NULL, rooms INTEGER NOT NULL, budget INTEGER NOT NULL,
      first_name TEXT NOT NULL, company TEXT NOT NULL, last_name TEXT NOT NULL, contact TEXT NOT NULL,
      consent_version TEXT NOT NULL, consent_accepted_at TEXT NOT NULL,
      received_at TEXT NOT NULL, payload_hash TEXT NOT NULL
    )`);
    for (const run of legacyRuns) {
      const player = Object.fromEntries(['firstName', 'lastName', 'company', 'contact', 'consentVersion', 'consentAcceptedAt'].map(key => [key, run.player[key as keyof typeof run.player]]));
      const normalized = { id: run.id, difficulty: run.difficulty, budget: run.budget, rooms: 4, player };
      const hash = createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
      legacy.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(run.id, 'easy', 4, 500, player.firstName, player.company, player.lastName, player.contact, player.consentVersion, player.consentAcceptedAt, '2026-10-13T09:00:00.000Z', hash);
    }
    legacy.close();
    const store = makeStore(path);
    expect(store.list('easy').total).toBe(2);
    for (const run of legacyRuns) expect(() => store.submit(run)).not.toThrow();
    store.close(); stores.pop();
    const reader = new DatabaseSync(path);
    try {
      const columns = reader.prepare('PRAGMA table_info(runs)').all().map(row => row.name);
      expect(columns).toContain('phone'); expect(columns).toContain('telegram');
      expect(reader.prepare('SELECT phone, telegram FROM runs ORDER BY rowid').all()).toEqual([{ phone: '+79000000000', telegram: '' }, { phone: '', telegram: '@test_legacy' }]);
    } finally { reader.close(); }
    const reopened = makeStore(path); const next = payload('+79000000001', '@test_new');
    reopened.submit(next); reopened.submit(next);
    expect(reopened.list('easy').total).toBe(3);
    expect(reopened.list('easy').entries.map(row => row.id)).toEqual([...legacyRuns.map(run => run.id), next.id]);
  });
});
