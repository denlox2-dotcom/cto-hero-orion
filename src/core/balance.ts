import type { BalanceConfig } from './types';
export const DEBT_SHELL_SPEED = 240;
export const BALANCE: BalanceConfig = {
  maxSla:100, maxEnergy:100, damage:12, invulnerability:1.2,
  energyPerSecond:8, fireSeconds:0.75, leakSeconds:0.75, bossSeconds:2.5,
  coffeeEnergy:60, coffeeRespawn:5, ognPerFire:0.4, taskBudget:100,
  coinBudget:10, gpuDuration:15, proDuration:30, comboWindow:5,
  backlogPenalty:2, ticketRevival:5, moveSpeed:210, jumpVelocity:560,
  gravity:1500, coyoteTime:0.12, jumpBuffer:0.15,
  fireHitboxWidth:32, fireHitboxHeight:40,
};
