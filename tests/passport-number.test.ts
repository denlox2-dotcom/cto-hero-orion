import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { rmSync } from 'node:fs';
import { makeTestDirectory } from './helpers/test-paths';
import { join } from 'node:path';
import { createLeaderboardStore } from '../server/leaderboard.mjs';

const stores: any[] = [], folders: string[] = [];
const open = (path = ':memory:') => { const db = createLeaderboardStore(path); stores.push(db); return db; };
const payload = () => ({
  id: randomUUID(), passportToken: randomUUID(), difficulty: 'easy', budget: 510,
  player: { firstName: 'Анна', lastName: 'Тестовая', company: 'Тестовая компания', contact: '@private_contact', consentVersion: 'draft-2026-09-26', consentAcceptedAt: new Date().toISOString() },
  results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })),
});
afterEach(() => { stores.splice(0).forEach(db => db.close()); folders.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })); });

describe('paper passport assignment', () => {
  it('links a number with the same run and contact, preserves leading zeroes, and retries once', () => {
    const db = open(), run = payload(); db.submit(run);
    expect(db.attachPassport(run.id, run.passportToken, '0017')).toMatchObject({ passportNumber: '0017' });
    const first = db.passportRows()[0];
    expect(first).toMatchObject({ passport_number: '0017', id: run.id, first_name: 'Анна', contact: '@private_contact' });
    db.attachPassport(run.id, run.passportToken, '0017'); db.submit(run);
    expect(db.passportRows()).toEqual([first]);
    expect(db.list('easy').total).toBe(1);
    expect(JSON.stringify(db.list('easy'))).not.toMatch(/0017|private_contact|passport|token/i);
  });
  it('rejects a passport already attached to another run, including a different zero padding', () => {
    const db = open(), a = payload(), b = payload(); db.submit(a); db.submit(b);
    db.attachPassport(a.id, a.passportToken, '0017');
    for (const number of ['0017', '17', '00017']) {
      expect(() => db.attachPassport(b.id, b.passportToken, number)).toThrow('Этот номер паспорта уже привязан');
    }
    expect(db.passportRows()).toHaveLength(1);
  });
  it('allows correction for the owning run without overwriting another participant', () => {
    const db = open(), a = payload(), b = payload(); db.submit(a); db.submit(b);
    db.attachPassport(a.id, a.passportToken, '0017');
    db.attachPassport(b.id, b.passportToken, '0018');
    expect(() => db.attachPassport(a.id, a.passportToken, '18')).toThrow();
    expect(db.passportRows().find(row => row.id === a.id).passport_number).toBe('0017');
    db.attachPassport(a.id, a.passportToken, '0019');
    db.attachPassport(b.id, b.passportToken, '0017');
    expect(db.passportRows().find(row => row.id === a.id).passport_number).toBe('0019');
  });
  it('requires the private key, validates digits and does not allow claiming a legacy result', () => {
    const db = open(), run = payload(); db.submit(run);
    for (const token of [undefined, '', randomUUID(), run.id]) expect(() => db.attachPassport(run.id, token, '17')).toThrow();
    for (const number of ['', ' ', '17a', '-17', '1.7', '<b>17</b>', '1'.repeat(21), 17]) expect(() => db.attachPassport(run.id, run.passportToken, number)).toThrow();
    const legacy = payload(); delete (legacy as any).passportToken; db.submit(legacy);
    expect(() => db.submit({ ...legacy, passportToken: randomUUID() })).toThrow();
    expect(() => db.attachPassport(legacy.id, run.passportToken, '20')).toThrow();
    expect(() => db.attachPassport(randomUUID(), run.passportToken, '20')).toThrow();
    expect(db.passportRows()).toEqual([]);
  });
  it('preserves the legacy runs schema, existing rows and assignments across restart', () => {
    const dir = makeTestDirectory('unit-passport-number', 'cto-passports-'); folders.push(dir);
    const path = join(dir, 'leaderboard.sqlite');
    const old = new DatabaseSync(path);
    old.exec(`CREATE TABLE runs (id TEXT PRIMARY KEY, difficulty TEXT NOT NULL, rooms INTEGER NOT NULL, budget INTEGER NOT NULL,
      first_name TEXT NOT NULL, company TEXT NOT NULL, last_name TEXT NOT NULL, contact TEXT NOT NULL,
      consent_version TEXT NOT NULL, consent_accepted_at TEXT NOT NULL, received_at TEXT NOT NULL, payload_hash TEXT NOT NULL)`);
    const legacyId = randomUUID();
    old.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(legacyId, 'easy', 2, 99, 'Прежний', 'Тест', 'Участник', '@legacy_contact', 'draft', '2026-10-13T10:00:00Z', '2026-10-13T10:00:00Z', 'legacy-hash');
    old.close();
    const db = open(path), run = payload(); db.submit(run); db.attachPassport(run.id, run.passportToken, '00020');
    db.close(); stores.pop();
    const reopened = open(path);
    expect(reopened.list('easy', legacyId).current).toMatchObject({ firstName: 'Прежний', budget: 99 });
    expect(reopened.list('easy').total).toBe(2);
    expect(reopened.passportRows()[0]).toMatchObject({ passport_number: '00020', contact: '@private_contact' });
    expect(reopened.attachPassport(run.id, run.passportToken, '00020')).toMatchObject({ passportNumber: '00020' });
  });
  it('works with the already migrated fourteen-column database and keeps both contacts', () => {
    const dir = makeTestDirectory('unit-passport-number', 'cto-contacts-'); folders.push(dir);
    const path = join(dir, 'leaderboard.sqlite');
    const existing = new DatabaseSync(path), legacyId = randomUUID();
    existing.exec(`CREATE TABLE runs (id TEXT PRIMARY KEY, difficulty TEXT NOT NULL, rooms INTEGER NOT NULL, budget INTEGER NOT NULL,
      first_name TEXT NOT NULL, company TEXT NOT NULL, last_name TEXT NOT NULL, contact TEXT NOT NULL,
      consent_version TEXT NOT NULL, consent_accepted_at TEXT NOT NULL, received_at TEXT NOT NULL, payload_hash TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '', telegram TEXT NOT NULL DEFAULT '')`);
    existing.prepare('INSERT INTO runs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(legacyId, 'easy', 2, 99, 'Прежний', 'Тест', 'Участник', '+70000000000', 'draft', '2026-10-13T10:00:00Z', '2026-10-13T10:00:00Z', 'legacy-hash', '+70000000000', '@legacy_contact');
    existing.close();
    const db = open(path), run = payload();
    Object.assign(run.player, { phone: '+70000000001', telegram: '@both_contacts' });
    db.submit(run); db.submit(run); db.attachPassport(run.id, run.passportToken, '00021');
    expect(db.list('easy').total).toBe(2);
    expect(db.passportRows()[0]).toMatchObject({ contact: '+70000000001', phone: '+70000000001', telegram: '@both_contacts' });
    expect(JSON.stringify(db.list('easy'))).not.toMatch(/both_contacts|70000000001|phone|telegram|passport|token/i);
    db.close(); stores.pop();
    const readonly = new DatabaseSync(path, { readOnly: true });
    expect(readonly.prepare('SELECT phone, telegram FROM runs WHERE id = ?').get(legacyId)).toEqual({ phone: '+70000000000', telegram: '@legacy_contact' });
    readonly.close();
  });
});
