import type { RunState } from './types';

export const PAK_WARNING_SECONDS = 0.8;
export const PAK_FALL_SECONDS = 1.2;
export interface PakBattleState { playing: boolean; paused: boolean; shieldOpen: boolean; bossHealth: number }
export class PakAssist {
  phase: 'idle' | 'warning' | 'falling' | 'impact' | 'cancelled' = 'idle';
  private elapsed = 0;
  constructor(private readonly run: RunState) {}
  get fallProgress(): number {
    return this.phase === 'impact' ? 1 : this.phase === 'falling' ? Math.min(1, this.elapsed / PAK_FALL_SECONDS) : 0;
  }
  tryLaunch(battle: PakBattleState): boolean {
    if (this.phase !== 'idle' || this.run.pakAssistUsed || !battle.playing || battle.paused || !battle.shieldOpen
      || !Number.isFinite(battle.bossHealth) || battle.bossHealth <= 0 || battle.bossHealth > 0.5
      || !(['server', 'office', 'perimeter', 'production'] as const).every(id => this.run.amulets.includes(id))) return false;
    this.run.pakAssistUsed = true;
    this.phase = 'warning';
    this.elapsed = 0;
    return true;
  }
  /** Returns true once, when the rack reaches the boss. Scene owns the actual hit. */
  advance(dt: number, battle: PakBattleState): boolean {
    if (this.phase !== 'warning' && this.phase !== 'falling') return false;
    if (!battle.playing || battle.bossHealth <= 0) { this.phase = 'cancelled'; return false; }
    if (battle.paused || !Number.isFinite(dt) || dt <= 0) return false;
    this.elapsed += dt;
    if (this.phase === 'warning' && this.elapsed >= PAK_WARNING_SECONDS) {
      this.elapsed -= PAK_WARNING_SECONDS;
      this.phase = 'falling';
    }
    if (this.phase === 'falling' && this.elapsed >= PAK_FALL_SECONDS) {
      this.phase = 'impact';
      return true;
    }
    return false;
  }
}
