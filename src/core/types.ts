export type RoomId = 'server' | 'office' | 'perimeter' | 'production';
export type Difficulty = 'easy' | 'standard' | 'hardcore';
export type DamageSource = 'contact' | 'fire' | 'projectile' | 'boss' | 'shell';
export type ObjectiveKind = 'incident' | 'debt' | 'backlog' | 'leak' | 'fire' | 'boss';
export type EntityKind = ObjectiveKind | 'gpu' | 'pro' | 'coffee' | 'coin' | 'toolbox';
export type EndReason = 'success' | 'timeout' | 'sla' | 'fire';
export interface Rect { x: number; y: number; width: number; height: number }
export interface Spawn { id: string; kind: EntityKind; x: number; y: number; required?: boolean; patrol?: [number, number]; key?: boolean }
export interface RoomConfig {
  id: RoomId; title: string; subtitle: string; token: string; time: number; color: string;
  hint: string; platforms: Rect[]; spawn: { x: number; y: number }; entities: Spawn[];
}
export interface RoomResult { id: RoomId; reason: EndReason; completed: number; total: number; remaining: number; budget: number }
export interface RunState {
  difficulty: Difficulty;
  /** Completed rooms; kept separate from the PAK assembled before the final boss. */
  tokens: RoomId[];
  amulets: RoomId[];
  pakAssistUsed: boolean;
  firesExtinguished: number;
  budget: number;
  results: RoomResult[];
}
export interface Objective { id: string; kind: ObjectiveKind; required: boolean; done: boolean }
export interface BalanceConfig {
  maxSla: number; maxEnergy: number; damage: number; invulnerability: number;
  energyPerSecond: number; fireSeconds: number; leakSeconds: number; bossSeconds: number;
  coffeeEnergy: number; coffeeRespawn: number; ognPerFire: number; taskBudget: number;
  coinBudget: number; gpuDuration: number; proDuration: number; comboWindow: number;
  backlogPenalty: number; ticketRevival: number; moveSpeed: number; jumpVelocity: number;
  gravity: number; coyoteTime: number; jumpBuffer: number;
  fireHitboxWidth: number; fireHitboxHeight: number;
}
