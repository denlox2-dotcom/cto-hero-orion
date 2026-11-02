import { describe, expect, it } from 'vitest';
import { createRun } from '../src/core/rules';
import { PakAssist, PAK_WARNING_SECONDS, PAK_FALL_SECONDS } from '../src/core/pak';

const battle = { playing: true, paused: false, shieldOpen: true, bossHealth: 0.5 };
function prepared() {
  const run = createRun();
  run.amulets.push('server', 'office', 'perimeter', 'production');
  return { run, assist: new PakAssist(run) };
}
describe('PAK boss assistance', () => {
  it('keeps the call visible for 0.8 seconds and gives appearance and fall 1.2 seconds', () => {
    const { assist } = prepared(); assist.tryLaunch(battle);
    assist.advance(0.79, battle);
    expect(assist.phase).toBe('warning');
    assist.advance(0.011, battle);
    expect(assist.phase).toBe('falling');
    assist.advance(1.18, battle);
    expect(assist.phase).toBe('falling');
    expect(assist.fallProgress).toBeGreaterThan(0.97);
    expect(assist.advance(0.02, battle)).toBe(true);
    expect(assist.phase).toBe('impact');
    expect(assist.advance(20, battle)).toBe(false);
  });
  it('triggers exactly once when damage crosses half health', () => {
    const { run, assist } = prepared();
    expect(assist.tryLaunch({ ...battle, bossHealth: 0.51 })).toBe(false);
    expect(assist.tryLaunch({ ...battle, bossHealth: 0.43 })).toBe(true);
    expect(assist.phase).toBe('warning');
    expect(run.pakAssistUsed).toBe(true);
    expect(assist.tryLaunch(battle)).toBe(false);
    expect(new PakAssist(run).tryLaunch(battle)).toBe(false);
  });
  it.each(['server', 'office', 'perimeter', 'production'] as const)('does not trigger without the %s module', id => {
    const { run, assist } = prepared();
    run.amulets = run.amulets.filter(value => value !== id);
    expect(assist.tryLaunch(battle)).toBe(false);
    expect(run.pakAssistUsed).toBe(false);
  });
  it.each([
    { bossHealth: 0 }, { bossHealth: -1 }, { bossHealth: NaN },
    { playing: false }, { paused: true }, { shieldOpen: false },
  ])('rejects unavailable battle state %j', change => {
    expect(prepared().assist.tryLaunch({ ...battle, ...change })).toBe(false);
  });
  it('warns, falls, impacts once, and freezes during pause', () => {
    const { assist } = prepared(); assist.tryLaunch(battle);
    expect(assist.advance(10, { ...battle, paused: true })).toBe(false);
    expect(assist.phase).toBe('warning');
    expect(assist.advance(PAK_WARNING_SECONDS, battle)).toBe(false);
    expect(assist.phase).toBe('falling');
    assist.advance(PAK_FALL_SECONDS / 2, battle);
    const progress = assist.fallProgress;
    assist.advance(10, { ...battle, paused: true });
    expect(assist.fallProgress).toBe(progress);
    expect(assist.advance(PAK_FALL_SECONDS / 2, battle)).toBe(true);
    expect(assist.phase).toBe('impact');
    expect(assist.advance(10, battle)).toBe(false);
  });
  it('a large frame still applies one impact', () => {
    const { assist } = prepared(); assist.tryLaunch(battle);
    expect(assist.advance(5, battle)).toBe(true);
    expect(assist.advance(5, battle)).toBe(false);
  });
  it.each([{ playing: false }, { bossHealth: 0 }])('cancels if the battle is already over %j', change => {
    const { assist } = prepared(); assist.tryLaunch(battle);
    assist.advance(PAK_WARNING_SECONDS, battle);
    expect(assist.advance(5, { ...battle, ...change })).toBe(false);
    expect(assist.phase).toBe('cancelled');
    expect(assist.tryLaunch(battle)).toBe(false);
  });
  it('ignores invalid elapsed time and starts fresh on a new run', () => {
    const { assist } = prepared(); assist.tryLaunch(battle);
    for (const dt of [-1, Infinity, NaN]) expect(assist.advance(dt, battle)).toBe(false);
    expect(assist.phase).toBe('warning');
    expect(prepared().assist.tryLaunch(battle)).toBe(true);
  });
});
