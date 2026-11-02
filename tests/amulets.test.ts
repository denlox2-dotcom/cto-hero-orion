import { describe, expect, it } from 'vitest';
import { createRun, recordResult, RoomRules } from '../src/core/rules';
import { getRooms } from '../src/core/rooms';
import type { RoomId } from '../src/core/types';

describe('PAK assembly rewards', () => {
  it('starts each run with its own empty assembly', () => {
    expect(createRun()).toMatchObject({ amulets: [], pakAssistUsed: false });
  });

  it('awards the first three modules only for successful rooms, without duplicates', () => {
    const run = createRun();
    for (const [id, reason] of [['server', 'success'], ['office', 'timeout'], ['perimeter', 'success']] as const) {
      const result = { id, reason, completed: 1, total: 1, remaining: 10, budget: 100 };
      recordResult(run, result); recordResult(run, result);
    }
    expect(run.amulets).toEqual(['server', 'perimeter']);
    expect(run.tokens).toEqual(['server', 'perimeter']);
  });

  it.each(['easy', 'standard', 'hardcore'] as const)('%s: fourth module arrives at shield removal, without completing the room', difficulty => {
    const run = createRun(difficulty);
    const room = getRooms(difficulty)[3];
    const rules = new RoomRules(room, run);
    rules.start();
    const keys = room.entities.filter(e => e.key);
    for (const key of keys.slice(0, -1)) rules.complete(key.id, 'fire');
    expect(run.amulets).toEqual([]);
    rules.complete(keys.at(-1)!.id, 'fire');
    expect(run.amulets).toEqual(['production']);
    expect(run.tokens).toEqual([]);
    expect(run.results).toEqual([]);
    expect(rules.status).toBe('playing');
    rules.complete(keys.at(-1)!.id, 'fire');
    rules.complete('b-boss');
    expect(run.amulets).toEqual(['production']);
    expect(run.tokens).toEqual(['production']);
    expect(run.results).toHaveLength(1);
  });

  it('a complete PAK does not turn a later boss-room failure into a win', () => {
    const run = createRun();
    for (const id of ['server', 'office', 'perimeter'] as RoomId[]) {
      recordResult(run, { id, reason: 'success', completed: 1, total: 1, remaining: 10, budget: 100 });
    }
    const rules = new RoomRules(getRooms('easy')[3], run);
    rules.start(); rules.complete('b-f1', 'fire');
    expect(run.amulets).toHaveLength(4);
    rules.tick(rules.remaining, 0);
    expect(run.tokens).toHaveLength(3);
    expect(run.results.at(-1)?.reason).toBe('timeout');
    expect(createRun().amulets).toEqual([]);
  });

  it('paused and ended rooms cannot award the fourth module', () => {
    const run = createRun();
    const rules = new RoomRules(getRooms('easy')[3], run);
    rules.start(); rules.paused = true; rules.complete('b-f1', 'fire');
    expect(run.amulets).toEqual([]);
    rules.paused = false; rules.tick(rules.remaining, 0); rules.complete('b-f1', 'fire');
    expect(run.amulets).toEqual([]);
  });
});
