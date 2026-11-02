import { describe, expect, it } from 'vitest';
import { hitsBlockFromBelow, isOutsideHorizontalField } from '../src/core/collisions';
import { getRooms } from '../src/core/rooms';
import { createRun, RoomRules } from '../src/core/rules';
import { BALANCE } from '../src/core/balance';
import type { Rect } from '../src/core/types';

const hero = (x: number, y: number): Rect => ({ x, y, width: 24, height: 44 });
const block: Rect = { x: 150, y: 300, width: 36, height: 36 };

describe('backlog head strikes', () => {
  it('detects the rising head crossing the underside', () => {
    expect(hitsBlockFromBelow(hero(150, 380), hero(150, 320), block)).toBe(true);
  });
  it('detects a fast frame that passes completely through the block', () => {
    expect(hitsBlockFromBelow(hero(150, 380), hero(150, 260), block)).toBe(true);
  });
  it('accepts exact underside contact', () => {
    expect(hitsBlockFromBelow(hero(150, 380), hero(150, 336), block)).toBe(true);
  });
  it('rejects side contact, stationary overlap and descending contact', () => {
    expect(hitsBlockFromBelow(hero(100, 320), hero(150, 320), block)).toBe(false);
    expect(hitsBlockFromBelow(hero(150, 320), hero(150, 320), block)).toBe(false);
    expect(hitsBlockFromBelow(hero(150, 260), hero(150, 380), block)).toBe(false);
    expect(hitsBlockFromBelow(hero(150, 310), hero(150, 290), block)).toBe(false);
  });
  it('checks horizontal overlap at the moment the head reaches the underside', () => {
    expect(hitsBlockFromBelow(hero(100, 380), hero(180, 300), block)).toBe(true);
    expect(hitsBlockFromBelow(hero(0, 380), hero(150, 300), block)).toBe(false);
    expect(hitsBlockFromBelow(hero(126, 380), hero(126, 300), block)).toBe(false);
  });
});

describe('shell field boundary', () => {
  it('keeps the shell active while any of its width is still in the field', () => {
    expect(isOutsideHorizontalField({ x: -20, y: 480, width: 36, height: 24 }, 960)).toBe(false);
    expect(isOutsideHorizontalField({ x: 950, y: 480, width: 36, height: 24 }, 960)).toBe(false);
  });
  it('retires a shell only after its full width passes either edge', () => {
    expect(isOutsideHorizontalField({ x: -36, y: 480, width: 36, height: 24 }, 960)).toBe(true);
    expect(isOutsideHorizontalField({ x: 960, y: 480, width: 36, height: 24 }, 960)).toBe(true);
  });
});

for (const difficulty of ['easy', 'standard', 'hardcore'] as const) {
  it(`${difficulty} puts every backlog block above an accessible jumping surface`, () => {
    const room = getRooms(difficulty)[1];
    const jumpRise = BALANCE.jumpVelocity ** 2 / (2 * BALANCE.gravity);
    for (const entity of room.entities.filter(entity => entity.kind === 'backlog')) {
      const support = room.platforms.filter(platform => platform.x <= entity.x - 12 && platform.x + platform.width >= entity.x + 12 && platform.y > entity.y).sort((a, b) => a.y - b.y)[0];
      expect(support).toBeDefined();
      const headToUnderside = support.y - 44 - entity.y;
      expect(headToUnderside).toBeGreaterThan(30);
      expect(headToUnderside).toBeLessThan(jumpRise - 15);
      expect(room.platforms.filter(platform => platform !== support && platform.y > entity.y && platform.y < support.y && platform.x < entity.x + 12 && platform.x + platform.width > entity.x - 12)).toEqual([]);
    }
  });
  it(`${difficulty} applies the backlog reward and time cost only once`, () => {
    const rules = new RoomRules(getRooms(difficulty)[1], createRun(difficulty));
    rules.start();
    const before = rules.remaining;
    const penalty = { easy: 0, standard: 2, hardcore: 3 }[difficulty];
    expect(rules.complete('o-b1')).toBe(true);
    expect(rules.run.budget).toBe(100);
    expect(rules.remaining).toBe(before - penalty);
    expect(rules.complete('o-b1')).toBe(false);
    expect(rules.run.budget).toBe(100);
    expect(rules.remaining).toBe(before - penalty);
  });
}
