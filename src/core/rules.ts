import { BALANCE } from './balance';
import { DIFFICULTIES, getBalance } from './difficulty';
import type { BalanceConfig, DamageSource, Difficulty, EndReason, Objective, RoomConfig, RoomResult, RunState } from './types';

export function createRun(difficulty: Difficulty = 'easy'): RunState {
  return { difficulty, budget: 0, tokens: [], amulets: [], pakAssistUsed: false, firesExtinguished: 0, results: [] };
}

export function recordResult(run: RunState, result: RoomResult): void {
  if (run.results.some(previous => previous.id === result.id)) return;
  run.results.push({ ...result });
  if (result.reason === 'success' && !run.tokens.includes(result.id) && run.tokens.length < 4) {
    run.tokens.push(result.id);
    if (!run.amulets.includes(result.id)) run.amulets.push(result.id);
  }
}

function positive(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export class RoomRules {
  readonly balance: BalanceConfig;
  readonly tuning;
  hasWrench = false;
  objectives = new Map<string, Objective>();
  remaining: number;
  sla = BALANCE.maxSla;
  energy = BALANCE.maxEnergy;
  ogn = 0;
  gpuRemaining = 0;
  proRemaining = 0;
  combo = 1;
  comboRemaining = 0;
  invulnerable = 0;
  status: 'entering' | 'playing' | 'ended' = 'entering';
  paused = false;
  result: RoomResult | null = null;

  constructor(public config: RoomConfig, public run: RunState) {
    this.balance = getBalance(run.difficulty);
    this.tuning = DIFFICULTIES[run.difficulty];
    this.remaining = positive(config.time);
    for (const entity of config.entities) {
      if (entity.kind === 'gpu' || entity.kind === 'pro' || entity.kind === 'coffee' || entity.kind === 'coin' || entity.kind === 'toolbox') continue;
      this.objectives.set(entity.id, {
        id: entity.id, kind: entity.kind, required: entity.required !== false, done: false,
      });
    }
  }

  private get active(): boolean {
    return this.status === 'playing' && !this.paused;
  }

  start(): void {
    if (this.status !== 'entering') return;
    this.status = 'playing';
    this.evaluate();
  }

  tick(dtSeconds: number, activeFires: number): void {
    const dt = positive(dtSeconds);
    if (!this.active || dt === 0) return;
    this.remaining = Math.max(0, this.remaining - dt);
    this.gpuRemaining = Math.max(0, this.gpuRemaining - dt);
    this.proRemaining = Math.max(0, this.proRemaining - dt);
    this.comboRemaining = Math.max(0, this.comboRemaining - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.comboRemaining === 0) this.combo = 1;
    this.ogn = Math.min(100, this.ogn + positive(activeFires) * this.balance.ognPerFire * dt);
    this.evaluate();
  }

  complete(id: string, source: 'fire' | 'other' = 'other', multiplier = 1): boolean {
    if (!this.active) return false;
    const objective = this.objectives.get(id);
    if (!objective || objective.done) return false;
    objective.done = true;
    if (objective.kind === 'fire') this.run.firesExtinguished++;

    let rewardMultiplier = positive(multiplier);
    if (source === 'fire') {
      this.combo = this.comboRemaining > 0 ? Math.min(4, this.combo + 1) : 1;
      this.comboRemaining = this.balance.comboWindow;
      rewardMultiplier *= this.combo;
    }
    this.addBudget(this.balance.taskBudget * rewardMultiplier);
    if (objective.kind === 'backlog') {
      this.remaining = Math.max(0, this.remaining - this.balance.backlogPenalty);
    }
    this.evaluate();
    if (this.active && this.config.id === 'production') {
      const keys = this.config.entities.filter(entity => entity.key);
      if (keys.length > 0 && keys.every(entity => this.objectives.get(entity.id)?.done)
        && !this.run.amulets.includes('production')) this.run.amulets.push('production');
    }
    return true;
  }

  takeDamage(source: DamageSource = 'contact'): boolean {
    if (!this.active || this.invulnerable > 0) return false;
    this.sla = Math.max(0, this.sla - this.tuning.damage[source]);
    this.invulnerable = this.balance.invulnerability;
    this.evaluate();
    return true;
  }

  spray(dt: number): number {
    if (!this.active) return 0;
    const usable = Math.min(positive(dt), positive(this.energy) / this.balance.energyPerSecond);
    this.energy = Math.max(0, this.energy - usable * this.balance.energyPerSecond);
    return usable;
  }

  repair(dt: number): number {
    return this.active && this.hasWrench ? positive(dt) : 0;
  }

  collect(kind: 'gpu' | 'pro' | 'coffee' | 'coin' | 'wrench'): boolean {
    if (!this.active) return false;
    switch (kind) {
      case 'wrench': this.hasWrench = true; break;
      case 'gpu': this.gpuRemaining = this.balance.gpuDuration; break;
      case 'pro': this.proRemaining = this.balance.proDuration; break;
      case 'coffee': this.energy = Math.min(this.balance.maxEnergy, this.energy + this.balance.coffeeEnergy); break;
      case 'coin': this.addBudget(this.balance.coinBudget); break;
    }
    return true;
  }

  addBudget(amount: number): void {
    if (this.active) this.run.budget += positive(amount);
  }

  private failureReason(): EndReason | null {
    if (this.sla <= 0) return 'sla';
    if (this.ogn >= 100) return 'fire';
    if (this.remaining <= 0) return 'timeout';
    return null;
  }

  private evaluate(): void {
    // finish checks mandatory progress after failure precedence, including backlog costs.
    this.finish(this.failureReason() ?? 'success');
  }

  finish(reason: EndReason): void {
    if (!this.active || this.result) return;
    const failure = this.failureReason();
    if (reason !== 'success' && !failure) return;
    const required = [...this.objectives.values()].filter(objective => objective.required);
    const completed = required.filter(objective => objective.done).length;
    const resolvedReason = failure ?? 'success';
    if (resolvedReason === 'success' && completed !== required.length) return;
    this.status = 'ended';
    this.result = {
      id: this.config.id, reason: resolvedReason, completed, total: required.length,
      remaining: this.remaining, budget: this.run.budget,
    };
    recordResult(this.run, this.result);
  }
}

export class IncidentCycle {
  state: 'active' | 'ticket' | 'closed' = 'active';
  remaining = 0;
  stomp(): boolean {
    if (this.state === 'closed') return false;
    if (this.state === 'ticket') {
      this.close();
      return true;
    }
    this.state = 'ticket';
    this.remaining = BALANCE.ticketRevival;
    return false;
  }

  tick(dt: number): void {
    if (this.state !== 'ticket') return;
    this.remaining = Math.max(0, this.remaining - positive(dt));
    if (this.remaining === 0) this.state = 'active';
  }

  close(): void {
    this.state = 'closed';
    this.remaining = 0;
  }
}
