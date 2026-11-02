import { describe, expect, it } from 'vitest';
import { createRun, RoomRules } from '../src/core/rules';
import { getRooms } from '../src/core/rooms';

describe('passport fire totals', () => {
  it('starts a run with zero fires', () => {
    expect(createRun().firesExtinguished).toBe(0);
  });
  it('counts each extinguished fire once, including optional dynamic fires', () => {
    const run = createRun();
    const rules = new RoomRules(getRooms('easy')[0], run); rules.start();
    rules.complete('s-f1', 'fire'); rules.complete('s-f1', 'fire');
    expect(run.firesExtinguished).toBe(1);
    rules.objectives.set('extra-fire', { id: 'extra-fire', kind: 'fire', required: false, done: false });
    rules.complete('extra-fire', 'fire');
    expect(run.firesExtinguished).toBe(2);
    rules.complete('s-i1');
    expect(run.firesExtinguished).toBe(2);
  });
  it('keeps actual fires even when the room fails; boss is not counted as a fire', () => {
    const run = createRun();
    const first = new RoomRules(getRooms('easy')[0], run); first.start(); first.complete('s-f1', 'fire');
    first.tick(first.remaining, 0);
    expect(run.firesExtinguished).toBe(1);
    const boss = new RoomRules(getRooms('easy')[3], run); boss.start(); boss.complete('b-f1', 'fire'); boss.complete('b-boss');
    expect(run.firesExtinguished).toBe(2);
    expect(createRun().firesExtinguished).toBe(0);
  });
  it('does not count paused, missing, or post-result completions', () => {
    const run = createRun();
    const rules = new RoomRules(getRooms('easy')[0], run); rules.start(); rules.paused = true;
    rules.complete('s-f1', 'fire'); rules.paused = false; rules.complete('missing', 'fire');
    rules.tick(rules.remaining, 0); rules.complete('s-f1', 'fire');
    expect(run.firesExtinguished).toBe(0);
  });
});
