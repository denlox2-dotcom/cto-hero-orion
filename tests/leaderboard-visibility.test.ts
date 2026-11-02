import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from 'node:http';
import { readFileSync, rmSync } from 'node:fs';
import { makeTestDirectory } from './helpers/test-paths';
import { join } from 'node:path';
import { createLeaderboardApi, createLeaderboardStore } from '../server/leaderboard.mjs';
import { exportPassports } from '../server/export-passports.mjs';

const stores: any[] = [], folders: string[] = [], servers: any[] = [];
const open = (path = ':memory:') => { const db = createLeaderboardStore(path); stores.push(db); return db; };
const result = (budget = 510, difficulty = 'easy') => ({
  id: randomUUID(), passportToken: randomUUID(), difficulty, budget,
  player: { firstName: 'Тест', lastName: 'Участник', company: 'Компания', phone: '+70000000001', telegram: '@test_contact', consentVersion: 'draft', consentAcceptedAt: new Date().toISOString() },
  results: ['server', 'office', 'perimeter', 'production'].map(id => ({ id, reason: 'success' })),
});
afterEach(async () => {
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  stores.splice(0).forEach(db => db.close()); folders.splice(0).forEach(path => rmSync(path, { recursive: true, force: true }));
});

describe('leaderboard visibility', () => {
  it('hides only from the public board and current result, recalculates ranks, restores ties', () => {
    const db = open(), a = result(900), b = result(900), c = result(100), other = result(50, 'standard');
    [a, b, c, other].forEach(run => db.submit(run));
    db.setHidden(a.id, true);
    const board = db.list('easy', a.id);
    expect(board.total).toBe(2); expect(board.current).toBeNull();
    expect(board.entries.map(row => [row.id, row.rank])).toEqual([[b.id, 1], [c.id, 2]]);
    expect(db.list('standard').total).toBe(1);
    db.setHidden(a.id, false);
    expect(db.list('easy').entries.map(row => [row.id, row.rank])).toEqual([[a.id, 1], [b.id, 2], [c.id, 3]]);
  });
  it('preserves every run, contact, claim, passport and the exact raffle export across hiding and restart', () => {
    const dir = makeTestDirectory('unit-leaderboard-visibility', 'cto-visibility-'); folders.push(dir);
    const path = join(dir, 'board.sqlite'), db = open(path), run = result();
    db.submit(run); db.attachPassport(run.id, run.passportToken, '0017');
    const read = new DatabaseSync(path, { readOnly: true });
    const before = ['runs', 'run_claims', 'run_passports'].map(table => read.prepare(`SELECT * FROM ${table}`).all());
    const csvBefore = join(dir, 'before.csv'); exportPassports(path, csvBefore);
    db.setHidden(run.id, true); db.setHidden(run.id, true); db.submit(run);
    expect(db.list('easy', run.id)).toMatchObject({ total: 0, entries: [], current: null });
    expect(['runs', 'run_claims', 'run_passports'].map(table => read.prepare(`SELECT * FROM ${table}`).all())).toEqual(before);
    expect(read.prepare('SELECT * FROM run_visibility').all()).toHaveLength(1);
    expect(db.passportRows()[0]).toMatchObject({ passport_number: '0017', phone: '+70000000001', telegram: '@test_contact' });
    const csvAfter = join(dir, 'after.csv'); exportPassports(path, csvAfter);
    expect(readFileSync(csvAfter)).toEqual(readFileSync(csvBefore)); read.close();
    db.close(); stores.pop(); const reopened = open(path);
    expect(reopened.list('easy').total).toBe(0);
    expect(reopened.adminList('easy', true).entries[0]).toMatchObject({ id: run.id, hidden: true, rank: null });
    reopened.setHidden(run.id, false); reopened.setHidden(run.id, false);
    expect(reopened.list('easy', run.id).current).toMatchObject({ rank: 1 });
  });
  it('validates visibility commands and cannot hide unknown results or accept a deletion command', () => {
    const db = open(), run = result(); db.submit(run);
    for (const hidden of [undefined, null, 'true', 1, {}]) expect(() => db.setHidden(run.id, hidden)).toThrow();
    expect(() => db.setHidden('bad-id', true)).toThrow();
    expect(() => db.setHidden(randomUUID(), true)).toThrow('Результат не найден');
    expect(db.list('easy').total).toBe(1);
  });
  it('filters hidden rows before the public limit and paginates the staff list with explicit visibility', () => {
    const db = open(), low = result(0); db.submit(low);
    const high = Array.from({ length: 101 }, (_, i) => result(i + 1)); high.forEach(run => db.submit(run));
    db.setHidden(high[100].id, true);
    expect(db.list('easy', low.id)).toMatchObject({ total: 101, current: { rank: 101 } });
    expect(db.list('easy').entries).toHaveLength(100);
    const first = db.adminList('easy', true, 0), second = db.adminList('easy', true, 1);
    expect(first).toMatchObject({ total: 102, page: 0, hasMore: true }); expect(first.entries).toHaveLength(100);
    expect(second).toMatchObject({ total: 102, page: 1, hasMore: false }); expect(second.entries).toHaveLength(2);
    expect(first.entries[0]).toMatchObject({ hidden: true, rank: null });
    expect(db.adminList('easy', false).total).toBe(101);
    expect(JSON.stringify(first)).not.toMatch(/test_contact|70000000001|token_hash|passport_number|consent/);
    for (const args of [['bad', false, 0], ['easy', 'true', 0], ['easy', true, -1], ['easy', true, 1.5]]) expect(() => db.adminList(...args)).toThrow();
  });
});

const adminToken = 'synthetic-test-admin-key-1234567890';
async function api(key: string | undefined = adminToken) {
  const controller = createLeaderboardApi(':memory:', { adminToken: key }); stores.push(controller);
  const server = createServer(controller.handler); servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = (route: string, options: RequestInit = {}) => fetch(origin + route, options);
  const run = result();
  expect((await request('/api/runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(run) })).status).toBe(200);
  return { request, run, origin };
}
const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };
describe('staff API', () => {
  it('requires the case-sensitive staff key for both reading and writing; offers no deletion endpoint', async () => {
    const { request, run } = await api(); const route = `/api/admin/runs/${run.id}/visibility`;
    for (const authorization of ['', 'Bearer wrong', `Bearer ${adminToken.toUpperCase()}`]) {
      expect((await request('/api/admin/leaderboard', { headers: { Authorization: authorization } })).status).toBe(401);
      expect((await request(route, { method: 'POST', headers: { ...headers, Authorization: authorization }, body: '{"hidden":true}' })).status).toBe(401);
    }
    expect((await request(route, { method: 'DELETE', headers })).status).toBe(405);
    expect((await request('/api/runs/' + run.id, { method: 'DELETE', headers })).status).toBe(404);
    expect((await (await request('/api/leaderboard')).json()).total).toBe(1);
  });
  it('can hide and restore, validates origin and boolean, excludes hidden current, keeps passports private', async () => {
    const { request, run } = await api(); const route = `/api/admin/runs/${run.id}/visibility`;
    expect((await request(route, { method: 'POST', headers: { ...headers, Origin: 'https://other.example' }, body: '{"hidden":true}' })).status).toBe(403);
    expect((await request(route, { method: 'POST', headers, body: '{"hidden":"true"}' })).status).toBe(400);
    expect((await request(route, { method: 'POST', headers, body: '{"hidden":true}' })).status).toBe(200);
    expect(await (await request('/api/leaderboard?current=' + run.id)).json()).toMatchObject({ total: 0, current: null, entries: [] });
    const admin = await (await request('/api/admin/leaderboard?showHidden=true', { headers })).json();
    expect(admin.entries[0]).toMatchObject({ id: run.id, hidden: true });
    expect(JSON.stringify(admin)).not.toMatch(/test_contact|70000000001|passportToken|token_hash/);
    expect((await request('/api/runs/' + run.id + '/passport', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passportToken: run.passportToken, passportNumber: '0017' }) })).status).toBe(200);
    expect((await request(route, { method: 'POST', headers, body: '{"hidden":false}' })).status).toBe(200);
    expect((await (await request('/api/leaderboard?current=' + run.id)).json()).current.rank).toBe(1);
  });
  it('disables staff access if no sufficiently long key is configured', async () => {
    for (const key of ['', 'short-key']) {
      const { request } = await api(key);
      expect((await request('/api/admin/leaderboard', { headers })).status).toBe(503);
      expect((await request('/api/leaderboard')).status).toBe(200);
    }
  });
});
