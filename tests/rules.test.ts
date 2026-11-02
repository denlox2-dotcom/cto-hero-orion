import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/core/balance';
import { createRun, IncidentCycle, recordResult, RoomRules } from '../src/core/rules';
import type { RoomConfig, RoomId, RoomResult, Spawn } from '../src/core/types';

function config(entities: Spawn[] = [
  { id: 'first', kind: 'incident', x: 0, y: 0 },
  { id: 'last', kind: 'debt', x: 0, y: 0 },
], changes: Partial<RoomConfig> = {}): RoomConfig {
  return {
    id: 'server', title: 'Room', subtitle: '', token: 'Token', time: 60,
    color: '#000', hint: '', platforms: [], spawn: { x: 0, y: 0 },
    entities, ...changes,
  };
}

function playing(entities?: Spawn[], changes?: Partial<RoomConfig>): RoomRules {
  const rules = new RoomRules(config(entities, changes), createRun('standard'));
  rules.start();
  return rules;
}

function result(id: RoomId, reason: RoomResult['reason'] = 'success'): RoomResult {
  return { id, reason, completed: 2, total: 2, remaining: 20, budget: 200 };
}

describe('run results', () => {
  it('starts a four-room run selected only by difficulty', () => {
    expect(createRun('hardcore')).toEqual({ difficulty: 'hardcore', budget: 0, tokens: [], amulets: [], pakAssistUsed: false, firesExtinguished: 0, results: [] });
  });

  it('starts each run with independent empty totals', () => {
    const first = createRun();
    expect(first).toEqual({ difficulty: 'easy', budget: 0, tokens: [], amulets: [], pakAssistUsed: false, firesExtinguished: 0, results: [] });
    first.tokens.push('office');
    expect(createRun()).toEqual({ difficulty: 'easy', budget: 0, tokens: [], amulets: [], pakAssistUsed: false, firesExtinguished: 0, results: [] });
  });

  it('records a full successful run with four unique tokens', () => {
    const run = createRun();
    for (const id of ['server', 'office', 'perimeter', 'production'] as const) {
      recordResult(run, result(id));
    }
    expect(run.results).toHaveLength(4);
    expect(run.tokens).toEqual(['server', 'office', 'perimeter', 'production']);
  });

  it('preserves failed room results without awarding their tokens', () => {
    const run = createRun();
    recordResult(run, result('server'));
    recordResult(run, result('office', 'sla'));
    recordResult(run, result('perimeter', 'fire'));
    recordResult(run, result('production'));
    expect(run.tokens).toEqual(['server', 'production']);
    expect(run.results.map(item => item.reason)).toEqual(['success', 'sla', 'fire', 'success']);
  });

  it('keeps all failed results with zero tokens', () => {
    const run = createRun();
    for (const id of ['server', 'office', 'perimeter', 'production'] as const) {
      recordResult(run, result(id, 'timeout'));
    }
    expect(run.tokens).toEqual([]);
    expect(run.results).toHaveLength(4);
  });

  it('deduplicates room IDs even if a failed result is later submitted as success', () => {
    const run = createRun();
    recordResult(run, result('office', 'timeout'));
    recordResult(run, result('office'));
    recordResult(run, result('server'));
    recordResult(run, result('server'));
    expect(run.results).toHaveLength(2);
    expect(run.results[0].reason).toBe('timeout');
    expect(run.tokens).toEqual(['server']);
  });

  it('awards all four tokens independently of room order', () => {
    const run = createRun();
    for (const id of ['production', 'perimeter', 'office', 'server'] as const) {
      recordResult(run, result(id));
    }
    expect(run.tokens).toEqual(['production', 'perimeter', 'office', 'server']);
    expect(run.results).toHaveLength(4);
  });

  it('does not add a cumulative result budget a second time', () => {
    const run = createRun();
    run.budget = 200;
    const submitted = result('server');
    recordResult(run, submitted);
    submitted.budget = 999;
    expect(run.budget).toBe(200);
    expect(run.results[0]?.budget).toBe(200);
  });
});

describe('room lifecycle', () => {
  it('begins in entry with fresh resources and separates pickups from objectives', () => {
    const rules = new RoomRules(config([
      { id: 'a', kind: 'incident', x: 0, y: 0 },
      { id: 'b', kind: 'fire', x: 0, y: 0, required: false },
      { id: 'c', kind: 'coffee', x: 0, y: 0 },
    ]), createRun());
    expect(rules.status).toBe('entering');
    expect(rules.objectives.size).toBe(2);
    expect(rules.objectives.get('a')).toEqual({ id: 'a', kind: 'incident', required: true, done: false });
    expect(rules.objectives.get('b')?.required).toBe(false);
    expect([rules.remaining, rules.sla, rules.energy, rules.ogn]).toEqual([60, 100, 100, 0]);
    expect([rules.gpuRemaining, rules.proRemaining, rules.combo, rules.comboRemaining, rules.invulnerable]).toEqual([0, 0, 1, 0, 0]);
    expect(rules.result).toBeNull();
  });

  it('freezes the timer and rejects gameplay actions before start', () => {
    const rules = new RoomRules(config(), createRun());
    rules.tick(10, 10);
    rules.addBudget(50);
    expect(rules.complete('first')).toBe(false);
    expect(rules.takeDamage()).toBe(false);
    expect(rules.spray(1)).toBe(0);
    expect(rules.collect('coin')).toBe(false);
    expect([rules.remaining, rules.ogn, rules.run.budget]).toEqual([60, 0, 0]);
  });

  it('starts only once without resetting elapsed room time', () => {
    const rules = playing();
    rules.tick(4, 0);
    rules.start();
    expect(rules.status).toBe('playing');
    expect(rules.remaining).toBe(56);
  });

  it('freezes every clock and rejects actions while paused', () => {
    const rules = playing();
    rules.collect('gpu');
    rules.collect('pro');
    rules.takeDamage();
    rules.complete('first', 'fire');
    const before = [rules.remaining, rules.energy, rules.sla, rules.gpuRemaining,
      rules.proRemaining, rules.comboRemaining, rules.invulnerable, rules.run.budget];
    rules.paused = true;
    rules.tick(20, 100);
    rules.addBudget(100);
    expect(rules.complete('last')).toBe(false);
    expect(rules.takeDamage()).toBe(false);
    expect(rules.spray(5)).toBe(0);
    expect(rules.collect('coin')).toBe(false);
    expect([rules.remaining, rules.energy, rules.sla, rules.gpuRemaining,
      rules.proRemaining, rules.comboRemaining, rules.invulnerable, rules.run.budget]).toEqual(before);
    expect(rules.ogn).toBe(0);
    rules.paused = false;
    rules.tick(1, 0);
    expect(rules.remaining).toBe(59);
  });

  it('awards a task once and succeeds immediately on the last required objective', () => {
    const rules = playing();
    expect(rules.complete('missing')).toBe(false);
    expect(rules.complete('first', 'other', 2)).toBe(true);
    expect(rules.complete('first', 'other', 2)).toBe(false);
    expect(rules.run.budget).toBe(BALANCE.taskBudget * 2);
    expect(rules.status).toBe('playing');
    expect(rules.complete('last')).toBe(true);
    expect(rules.status).toBe('ended');
    expect(rules.result).toEqual({ id: 'server', reason: 'success', completed: 2, total: 2, remaining: 60, budget: 300 });
    expect(rules.run.tokens).toEqual(['server']);
  });

  it('preserves partial progress and budget after timeout', () => {
    const rules = playing();
    rules.complete('first');
    rules.tick(100, 0);
    expect(rules.result).toEqual({ id: 'server', reason: 'timeout', completed: 1, total: 2, remaining: 0, budget: 100 });
    expect(rules.run.tokens).toEqual([]);
  });

  it('does not delay boss success for optional enemies or fires', () => {
    const rules = playing([
      { id: 'boss', kind: 'boss', x: 0, y: 0 },
      { id: 'fire', kind: 'fire', x: 0, y: 0, required: false },
      { id: 'enemy', kind: 'incident', x: 0, y: 0, required: false },
    ]);
    rules.complete('boss');
    expect(rules.result?.reason).toBe('success');
    expect(rules.result?.completed).toBe(1);
    expect(rules.result?.total).toBe(1);
    expect(rules.objectives.get('fire')?.done).toBe(false);
  });

  it('does not let optional completion substitute for a required objective', () => {
    const rules = playing([
      { id: 'boss', kind: 'boss', x: 0, y: 0 },
      { id: 'fire', kind: 'fire', x: 0, y: 0, required: false },
    ]);
    rules.complete('fire', 'fire');
    rules.finish('success');
    expect(rules.status).toBe('playing');
    expect(rules.run.tokens).toEqual([]);
  });

  it('does not resolve an empty room during entry', () => {
    const rules = new RoomRules(config([]), createRun());
    expect(rules.result).toBeNull();
    rules.start();
    expect(rules.result?.reason).toBe('success');
  });

  it('locks the finished result against later ticks, actions and repeated finish', () => {
    const rules = playing();
    rules.complete('first');
    rules.tick(rules.remaining, 0);
    const saved = { ...rules.result! };
    rules.finish('success');
    rules.start();
    rules.tick(100, 100);
    rules.addBudget(500);
    expect(rules.complete('last')).toBe(false);
    expect(rules.collect('coin')).toBe(false);
    expect(rules.takeDamage()).toBe(false);
    expect(rules.spray(10)).toBe(0);
    expect(rules.result).toEqual(saved);
    expect(rules.run.results).toHaveLength(1);
    expect(rules.run.budget).toBe(100);
  });

  it('does not finish a paused room even when a real failure threshold is reached', () => {
    const rules = playing();
    rules.remaining = 0;
    rules.paused = true;
    rules.finish('timeout');
    expect(rules.status).toBe('playing');
    expect(rules.result).toBeNull();
    expect(rules.run.results).toEqual([]);
    rules.paused = false;
    rules.finish('timeout');
    expect(rules.result?.reason).toBe('timeout');
  });

  it.each(['timeout', 'sla', 'fire'] as const)('rejects an unsupported %s failure request', reason => {
    const rules = playing();
    rules.tick(20, 0);
    rules.finish(reason);
    expect(rules.status).toBe('playing');
    expect(rules.result).toBeNull();
    expect(rules.run.results).toEqual([]);
    expect(rules.remaining).toBe(40);
  });

  it('does not substitute success for an unsupported failure request', () => {
    const rules = playing();
    for (const objective of rules.objectives.values()) objective.done = true;
    rules.finish('timeout');
    expect(rules.status).toBe('playing');
    expect(rules.result).toBeNull();
    rules.finish('success');
    expect(rules.result?.reason).toBe('success');
  });

  it('resets room resources and buffs while preserving the run totals', () => {
    const run = createRun();
    const first = new RoomRules(config(), run);
    first.start();
    first.collect('gpu');
    first.collect('pro');
    first.spray(2);
    first.takeDamage();
    first.tick(1, 2);
    first.complete('first');
    first.complete('last');
    const next = new RoomRules(config(undefined, { id: 'office' }), run);
    expect([next.energy, next.sla, next.ogn, next.remaining]).toEqual([100, 100, 0, 60]);
    expect([next.gpuRemaining, next.proRemaining, next.combo, next.comboRemaining, next.invulnerable]).toEqual([0, 0, 1, 0, 0]);
    expect(next.run.budget).toBe(200);
    expect(next.run.tokens).toEqual(['server']);
    expect(next.run.results).toHaveLength(1);
  });
});

describe('resource boundaries and failure precedence', () => {
  it('ignores negative and non-finite time deltas', () => {
    const rules = playing();
    for (const dt of [-1, NaN, Infinity]) rules.tick(dt, 3);
    expect(rules.remaining).toBe(60);
    expect(rules.ogn).toBe(0);
  });

  it('applies damage once per invulnerability window', () => {
    const rules = playing();
    expect(rules.takeDamage()).toBe(true);
    expect(rules.sla).toBe(100 - BALANCE.damage);
    expect(rules.takeDamage()).toBe(false);
    rules.tick(BALANCE.invulnerability / 2, 0);
    expect(rules.takeDamage()).toBe(false);
    rules.tick(BALANCE.invulnerability / 2, 0);
    expect(rules.takeDamage()).toBe(true);
    expect(rules.sla).toBe(100 - 2 * BALANCE.damage);
  });

  it('clamps lethal damage to zero and records SLA failure', () => {
    const rules = playing();
    rules.sla = 10;
    expect(rules.takeDamage()).toBe(true);
    expect(rules.sla).toBe(0);
    expect(rules.result?.reason).toBe('sla');
  });

  it('limits usable spray time to available energy', () => {
    const rules = playing();
    rules.energy = 5;
    expect(rules.spray(2)).toBe(5 / BALANCE.energyPerSecond);
    expect(rules.energy).toBe(0);
    expect(rules.spray(1)).toBe(0);
    expect(rules.spray(-1)).toBe(0);
    expect(rules.spray(NaN)).toBe(0);
    expect(rules.spray(Infinity)).toBe(0);
  });

  it('collects coffee up to capacity without repairing SLA', () => {
    const rules = playing();
    rules.energy = 10;
    rules.sla = 50;
    expect(rules.collect('coffee')).toBe(true);
    expect(rules.energy).toBe(10 + BALANCE.coffeeEnergy);
    rules.collect('coffee');
    expect(rules.energy).toBe(BALANCE.maxEnergy);
    expect(rules.sla).toBe(50);
  });

  it('collects coins and accepts only positive finite budget additions', () => {
    const rules = playing();
    rules.collect('coin');
    rules.addBudget(25);
    rules.addBudget(-10);
    rules.addBudget(NaN);
    rules.addBudget(Infinity);
    expect(rules.run.budget).toBe(BALANCE.coinBudget + 25);
  });

  it('increments OGN by the current active fire count without passive decay', () => {
    const rules = playing([
      { id: 'fire', kind: 'fire', x: 0, y: 0 },
      { id: 'last', kind: 'debt', x: 0, y: 0 },
    ]);
    rules.tick(4, 3);
    expect(rules.ogn).toBe(4 * 3 * BALANCE.ognPerFire);
    rules.complete('fire', 'fire');
    rules.tick(2, 0);
    expect(rules.ogn).toBe(4 * 3 * BALANCE.ognPerFire);
    rules.tick(2, -5);
    expect(rules.ogn).toBe(4 * 3 * BALANCE.ognPerFire);
  });

  it('clamps OGN to its failure threshold', () => {
    const rules = playing();
    rules.tick(1, 1000);
    expect(rules.ogn).toBe(100);
    expect(rules.result?.reason).toBe('fire');
  });

  it.each([
    { sla: 0, ogn: 100, expected: 'sla' },
    { sla: 1, ogn: 100, expected: 'fire' },
    { sla: 1, ogn: 99, expected: 'timeout' },
  ] as const)('resolves simultaneous failures as $expected', ({ sla, ogn, expected }) => {
    const rules = playing();
    rules.sla = sla;
    rules.ogn = ogn;
    rules.remaining = 0;
    rules.finish('success');
    expect(rules.result?.reason).toBe(expected);
    expect(rules.run.tokens).toEqual([]);
  });

  it('applies backlog time cost before resolving last-task success', () => {
    const rules = playing([{ id: 'backlog', kind: 'backlog', x: 0, y: 0 }]);
    rules.remaining = BALANCE.backlogPenalty;
    rules.complete('backlog');
    expect(rules.remaining).toBe(0);
    expect(rules.result?.reason).toBe('timeout');
    expect(rules.result?.completed).toBe(1);
    expect(rules.result?.budget).toBe(BALANCE.taskBudget);
    expect(rules.run.tokens).toEqual([]);
  });

  it('succeeds after backlog when a positive amount of time remains', () => {
    const rules = playing([{ id: 'backlog', kind: 'backlog', x: 0, y: 0 }]);
    rules.remaining = BALANCE.backlogPenalty + 0.1;
    rules.complete('backlog');
    expect(rules.result?.reason).toBe('success');
    expect(rules.remaining).toBeCloseTo(0.1);
  });
});

describe('boosts and fire combo', () => {
  it('expires each boost and allows PRO to be renewed', () => {
    const rules = playing();
    rules.collect('gpu');
    rules.collect('pro');
    rules.tick(BALANCE.gpuDuration, 0);
    expect(rules.gpuRemaining).toBe(0);
    expect(rules.proRemaining).toBe(BALANCE.proDuration - BALANCE.gpuDuration);
    rules.collect('pro');
    expect(rules.proRemaining).toBe(BALANCE.proDuration);
    rules.tick(BALANCE.proDuration, 0);
    expect(rules.proRemaining).toBe(0);
    expect(rules.collect('pro')).toBe(true);
    expect(rules.proRemaining).toBe(BALANCE.proDuration);
  });

  it('refreshes an existing boost without stacking its duration', () => {
    const rules = playing();
    rules.collect('gpu');
    rules.tick(1, 0);
    rules.collect('gpu');
    expect(rules.gpuRemaining).toBe(BALANCE.gpuDuration);
  });

  it('awards consecutive fires at x1, x2, x3, x4 and caps the combo', () => {
    const entities: Spawn[] = Array.from({ length: 6 }, (_, i) => ({ id: `fire-${i}`, kind: 'fire', x: 0, y: 0 }));
    const rules = playing(entities);
    for (let i = 0; i < 5; i++) {
      rules.complete(`fire-${i}`, 'fire');
      expect(rules.combo).toBe(Math.min(i + 1, 4));
      expect(rules.comboRemaining).toBe(BALANCE.comboWindow);
      rules.tick(0.5, 0);
    }
    expect(rules.run.budget).toBe(BALANCE.taskBudget * (1 + 2 + 3 + 4 + 4));
    expect(rules.complete('fire-4', 'fire')).toBe(false);
    expect(rules.combo).toBe(4);
  });

  it('resets the combo at its exact deadline and combines explicit multipliers', () => {
    const rules = playing([
      { id: 'a', kind: 'fire', x: 0, y: 0 },
      { id: 'b', kind: 'fire', x: 0, y: 0 },
      { id: 'c', kind: 'fire', x: 0, y: 0 },
      { id: 'last', kind: 'debt', x: 0, y: 0 },
    ]);
    rules.complete('a', 'fire');
    rules.complete('b', 'fire', 2);
    expect(rules.run.budget).toBe(500);
    rules.tick(BALANCE.comboWindow, 0);
    expect(rules.combo).toBe(1);
    expect(rules.comboRemaining).toBe(0);
    rules.complete('c', 'fire');
    expect(rules.combo).toBe(1);
    expect(rules.run.budget).toBe(600);
  });

  it('does not apply or extend the fire combo for other tasks', () => {
    const rules = playing([
      { id: 'a', kind: 'fire', x: 0, y: 0 },
      { id: 'b', kind: 'fire', x: 0, y: 0 },
      { id: 'c', kind: 'debt', x: 0, y: 0 },
      { id: 'last', kind: 'debt', x: 0, y: 0 },
    ]);
    rules.complete('a', 'fire');
    rules.complete('b', 'fire');
    rules.tick(1, 0);
    rules.complete('c');
    expect(rules.combo).toBe(2);
    expect(rules.comboRemaining).toBe(BALANCE.comboWindow - 1);
    expect(rules.run.budget).toBe(400);
  });
});

describe('incident lifecycle', () => {
  it('turns the first stomp into a ticket and closes only on the second stomp', () => {
    const incident = new IncidentCycle();
    expect(incident.state).toBe('active');
    expect(incident.stomp()).toBe(false);
    expect(incident.state).toBe('ticket');
    expect(incident.remaining).toBe(BALANCE.ticketRevival);
    expect(incident.stomp()).toBe(true);
    expect(incident.state).toBe('closed');
    expect(incident.remaining).toBe(0);
    expect(incident.stomp()).toBe(false);
  });

  it('revives an unclosed ticket when its timer expires', () => {
    const incident = new IncidentCycle();
    incident.stomp();
    incident.tick(BALANCE.ticketRevival - 0.5);
    expect(incident.state).toBe('ticket');
    expect(incident.remaining).toBe(0.5);
    incident.tick(1);
    expect(incident.state).toBe('active');
    expect(incident.remaining).toBe(0);
    expect(incident.stomp()).toBe(false);
  });

  it('ignores invalid deltas and never revives a closed incident', () => {
    const incident = new IncidentCycle();
    incident.stomp();
    incident.tick(-1);
    incident.tick(NaN);
    incident.tick(Infinity);
    expect(incident.remaining).toBe(BALANCE.ticketRevival);
    incident.close();
    incident.close();
    incident.tick(100);
    expect(incident.state).toBe('closed');
    expect(incident.remaining).toBe(0);
  });
});
