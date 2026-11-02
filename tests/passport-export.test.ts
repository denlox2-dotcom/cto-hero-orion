import { afterEach, expect, it } from 'vitest';
import { readFileSync, rmSync, statSync } from 'node:fs';
import { makeTestDirectory } from './helpers/test-paths';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createLeaderboardStore } from '../server/leaderboard.mjs';
const folders: string[] = [];
afterEach(() => folders.splice(0).forEach(path => rmSync(path, { recursive: true, force: true })));

it('exports only assigned passports with contacts, UTF-8, escaped text and no private key', async () => {
  const dir = makeTestDirectory('unit-passport-export', 'cto-export-'); folders.push(dir);
  const path = join(dir, 'leaderboard.sqlite'), output = join(dir, 'raffle.csv');
  const db = createLeaderboardStore(path), id = randomUUID(), passportToken = randomUUID();
  const run = { id, passportToken, difficulty: 'easy', budget: 90,
    player: { firstName: '=1+1', lastName: 'Тестовая', company: 'Тест; "Компания"', contact: '@private_contact', phone: '+70000000000', telegram: '@private_contact', consentVersion: 'draft', consentAcceptedAt: new Date().toISOString() },
    results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })) };
  db.submit(run); db.attachPassport(id, passportToken, '0017'); db.submit({ ...run, id: randomUUID(), passportToken: randomUUID() }); db.close();
  const { exportPassports } = await import('../server/export-passports.mjs');
  expect(exportPassports(path, output)).toBe(1);
  const csv = readFileSync(output, 'utf8');
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv).toContain('Номер паспорта'); expect(csv).toContain('0017'); expect(csv).toContain('@private_contact');
  expect(csv).toContain('Телефон'); expect(csv).toContain('Telegram'); expect(csv).toContain('+70000000000');
  expect(csv).toContain("'=1+1"); expect(csv).toContain('"Тест; ""Компания"""');
  expect(csv).not.toContain(passportToken); expect(csv).not.toContain('token_hash');
  expect(csv.trim().split('\r\n')).toHaveLength(2);
  expect(statSync(output).mode & 0o777).toBe(0o600);
  expect(() => exportPassports(path, output)).toThrow();
  expect(readFileSync(output, 'utf8')).toBe(csv);
});
