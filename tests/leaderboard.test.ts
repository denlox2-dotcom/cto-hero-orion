import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { makeTestDirectory } from './helpers/test-paths';
import { join } from 'node:path';
import { createLeaderboardStore } from '../server/leaderboard.mjs';

const stores: ReturnType<typeof createLeaderboardStore>[] = [];
const folders: string[] = [];
const store = (path = ':memory:') => { const value = createLeaderboardStore(path); stores.push(value); return value; };
const result = (rooms = 2, budget = 510, difficulty = 'easy') => ({
  id: randomUUID(),
  player: { firstName: 'Анна', company: 'Компания', lastName: 'Скрытая', contact: '@private_contact', consentVersion: 'draft-2026-09-26', consentAcceptedAt: new Date().toISOString() },
  difficulty, budget,
  results: ['server', 'office', 'perimeter', 'production'].map((id, index) => ({ id, reason: index < rooms ? 'success' : 'timeout' })),
});
afterEach(() => { for (const value of stores.splice(0)) value.close(); for (const path of folders.splice(0)) rmSync(path, { recursive: true, force: true }); });

describe('shared leaderboard', () => {
  it('stores completed runs and exposes only public profile fields', () => {
    const db = store(); const payload = result();
    db.submit(payload);
    const board = db.list('easy', payload.id);
    expect(board.current).toMatchObject({ id: payload.id, firstName: 'Анна', company: 'Компания', rooms: 2, budget: 510, rank: 1 });
    expect(Object.keys(board.entries[0]).sort()).toEqual(['budget', 'company', 'firstName', 'id', 'rank', 'rooms'].sort());
    expect(JSON.stringify(board)).not.toContain('private_contact');
    expect(JSON.stringify(board)).not.toContain('Скрытая');
  });
  it('ranks rooms before budget, isolates difficulty, and keeps earlier equal scores ahead', () => {
    const db = store();
    const rows = [result(1, 900), result(2, 100), result(2, 300), result(2, 300), result(4, 900, 'standard')];
    rows.forEach(row => db.submit(row));
    expect(db.list('easy').entries.map(row => row.id)).toEqual([rows[2].id, rows[3].id, rows[1].id, rows[0].id]);
    expect(db.list('easy').entries.map(row => row.rank)).toEqual([1, 2, 3, 4]);
    expect(db.list('standard').total).toBe(1);
  });
  it('records zero scores and retries idempotently, rejects changed duplicate results', () => {
    const db = store(); const payload = result(0, 0);
    db.submit(payload); db.submit(payload);
    expect(db.list('easy').total).toBe(1);
    expect(() => db.submit({ ...payload, budget: 100 })).toThrow();
  });
  it('rejects malformed or unfinished submissions', () => {
    const db = store();
    for (const change of [
      { difficulty: 'cheat' }, { budget: -1 }, { budget: Infinity }, { budget: 1e15 },
      { results: [] }, { results: Array(4).fill({ id: 'server', reason: 'success' }) },
      { player: { ...result().player, contact: '123' } },
      { player: { ...result().player, firstName: ' ' } },
      { player: { ...result().player, consentVersion: '' } },
    ]) expect(() => db.submit({ ...result(), ...change })).toThrow();
    expect(db.list('easy').total).toBe(0);
  });
  it('persists across server restarts and returns the current run outside the first 100', () => {
    const folder = makeTestDirectory('unit-leaderboard', 'uptime-board-'); folders.push(folder);
    const path = join(folder, 'results.sqlite');
    const db = store(path); const low = result(0, 0); db.submit(low);
    for (let index = 0; index < 101; index++) db.submit(result(4, index));
    db.close(); stores.pop();
    const reopened = store(path); const board = reopened.list('easy', low.id);
    expect(board.total).toBe(102); expect(board.entries).toHaveLength(100);
    expect(board.current).toMatchObject({ id: low.id, rank: 102 });
  });
});
