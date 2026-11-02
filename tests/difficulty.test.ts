import { describe, expect, it } from 'vitest';
import { DIFFICULTIES, getBalance } from '../src/core/difficulty';
import { getRooms, ROOMS } from '../src/core/rooms';
import { createRun, RoomRules } from '../src/core/rules';
import type { Difficulty } from '../src/core/types';
import { PAK_ENTRY_Y } from '../src/core/presentation';

const levels: Difficulty[] = ['easy', 'standard', 'hardcore'];
describe('difficulty presets', () => {
  it('defaults to the booth preset and accepts a selected difficulty', () => {
    expect(createRun().difficulty).toBe('easy');
    expect(createRun('hardcore').difficulty).toBe('hardcore');
  });
  it('increases threats before the boss and preserves token slots with a clearer hardcore finale', () => {
    const rooms = levels.map(getRooms);
    for (let i = 0; i < 4; i++) {
      const count = (level: number, kinds: string[]) => rooms[level][i].entities.filter(e => kinds.includes(e.kind)).length;
      for (const kinds of [['incident', 'debt', 'leak', 'boss'], ['fire']]) {
        expect(count(0, kinds)).toBeLessThan(count(1, kinds));
        if (i < 3) expect(count(1, kinds)).toBeLessThan(count(2, kinds));
        else expect(count(2, kinds)).toBeLessThanOrEqual(count(1, kinds));
      }
      expect(rooms.map(r => r[i].id)).toEqual([ROOMS[i].id, ROOMS[i].id, ROOMS[i].id]);
    }
  });
  it.each(levels)('%s provides a permanent tool in every leak room and reachable touch loot', difficulty => {
    for (const room of getRooms(difficulty)) {
      expect(new Set(room.entities.map(e => e.id)).size).toBe(room.entities.length);
      if (room.entities.some(e => e.kind === 'leak')) {
        const toolbox = room.entities.find(e => e.kind === 'toolbox');
        expect(toolbox).toBeDefined();
        expect(toolbox!.y).toBe(500);
        const rules = new RoomRules(room, createRun(difficulty));
        expect(rules.objectives.has(toolbox!.id)).toBe(false);
        rules.start();
        expect(rules.collect('wrench')).toBe(true);
        rules.tick(20, 0);
        expect(rules.hasWrench).toBe(true);
        expect(new RoomRules(room, rules.run).hasWrench).toBe(false);
      }
      for (const block of room.entities.filter(e => e.kind === 'backlog')) {
        expect(room.platforms.some(p => p.y - block.y > 44 && p.y - block.y < 44 + 560 ** 2 / (2 * 1500) && block.x - 12 >= p.x && block.x + 12 <= p.x + p.width)).toBe(true);
      }
    }
  });
  it('makes damage source-specific and resources more forgiving on easy', () => {
    const rules = levels.map(d => { const r = new RoomRules(getRooms(d)[0], createRun(d)); r.start(); return r; });
    for (const r of rules) { r.takeDamage('fire'); r.tick(2, 1); r.spray(1); }
    expect(rules[0].sla).toBeGreaterThan(rules[1].sla);
    expect(rules[1].sla).toBeGreaterThan(rules[2].sla);
    expect(rules[0].ogn).toBeLessThan(rules[1].ogn);
    expect(rules[1].ogn).toBeLessThan(rules[2].ogn);
    expect(rules[0].energy).toBeGreaterThan(rules[1].energy);
    expect(rules[1].energy).toBeGreaterThan(rules[2].energy);
    for (const d of levels) expect(DIFFICULTIES[d].damage.fire).toBeLessThan(DIFFICULTIES[d].damage.boss);
  });
  it.each(levels)('%s keeps the doubled extinguishing speed and precise movement', d => {
    expect(getBalance(d).fireSeconds).toBe(0.75);
    expect(getBalance(d).bossSeconds).toBe(2.5);
    expect(getBalance(d).moveSpeed).toBe(210);
  });
  it('repairs with an empty extinguisher but never before collecting a key or while paused', () => {
    const rules = new RoomRules(getRooms('easy')[2], createRun());
    rules.start(); rules.energy = 0;
    expect(rules.repair(1)).toBe(0);
    rules.collect('wrench');
    expect(rules.repair(0.75)).toBe(0.75);
    expect(rules.energy).toBe(0);
    rules.paused = true;
    expect(rules.repair(1)).toBe(0);
  });
  it('creates independent room configs', () => {
    const rooms = getRooms('hardcore');
    rooms[0].entities[0].x = -999;
    rooms[0].platforms[0].x = -999;
    expect(getRooms('hardcore')[0].entities[0].x).not.toBe(-999);
    expect(ROOMS[0].platforms[0].x).toBe(0);
  });
  it('leaves the hardcore boss approach free from stacked optional floor hazards', () => {
    const room = getRooms('hardcore')[3];
    expect(room.entities.filter(e => e.kind === 'fire' && e.key)).toHaveLength(3);
    expect(room.entities.filter(e => e.y === 508 && e.required === false && ['leak', 'fire', 'incident', 'debt'].includes(e.kind))).toHaveLength(0);
    // No patrol crosses a required fire: the player can work from its side.
    for (const fire of room.entities.filter(e => e.key)) {
      for (const enemy of room.entities.filter(e => e.y === fire.y && e.patrol)) {
        expect(fire.x < enemy.patrol![0] - 64 || fire.x > enemy.patrol![1] + 64).toBe(true);
      }
    }
  });
  it('allows time to finish a tool action between hardcore hits and leak shots', () => {
    const balance = getBalance('hardcore');
    const tuning = DIFFICULTIES.hardcore;
    expect(balance.invulnerability).toBeGreaterThanOrEqual(balance.fireSeconds + 0.4);
    expect(tuning.leakShotInterval).toBeGreaterThanOrEqual(balance.leakSeconds * 3);
    expect(tuning.bossFireInterval).toBeGreaterThanOrEqual(6);
    expect(tuning.bossFireLimit).toBeLessThanOrEqual(2);
  });
  it.each(levels)('%s keeps the final boss on the floor center with a clear PAK drop', difficulty => {
    const room = getRooms(difficulty)[3];
    const floor = room.platforms.find(platform => platform.x === 0 && platform.width === 960)!;
    const boss = room.entities.find(entity => entity.kind === 'boss')!;
    expect(boss.x).toBe(floor.x + floor.width / 2);
    expect(boss.y).toBe(floor.y);
    // The 118px impact marker and falling rack must have an unobstructed column.
    expect(room.platforms.filter(platform => platform !== floor).some(platform =>
      platform.y < boss.y && platform.y + platform.height > PAK_ENTRY_Y - 168
      && platform.x < boss.x + 62 && platform.x + platform.width > boss.x - 62)).toBe(false);
    for (const fire of room.entities.filter(entity => entity.key)) {
      expect(room.platforms.some(platform => platform.y === fire.y && fire.x > platform.x && fire.x < platform.x + platform.width)).toBe(true);
    }
  });
});
