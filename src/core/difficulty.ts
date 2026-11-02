import { BALANCE } from './balance';
import type { BalanceConfig, DamageSource, Difficulty } from './types';

export interface DifficultyConfig {
  label: string;
  description: string;
  damage: Record<DamageSource, number>;
  balance: Partial<BalanceConfig>;
  enemyTempo: number;
  projectileSpeed: number;
  leakShotInterval: number;
  bossFireInterval: number;
  bossFireLimit: number;
  roomTimes: [number, number, number, number];
}

export const DIFFICULTIES: Record<Difficulty, DifficultyConfig> = {
  easy: {
    label: 'Легкая', description: 'Меньше угроз, больше времени. Соберите все наклейки.',
    damage: { contact: 5, fire: 4, projectile: 4, boss: 8, shell: 6 },
    balance: { damage: 5, invulnerability: 1.5, energyPerSecond: 5, ognPerFire: 0.15, backlogPenalty: 0 },
    enemyTempo: 0.65, projectileSpeed: 80, leakShotInterval: 4,
    bossFireInterval: 7, bossFireLimit: 0, roomTimes: [45, 45, 40, 45],
  },
  standard: {
    label: 'Средняя', description: 'Все механики и умеренный темп. Для тех, кто уже освоился.',
    damage: { contact: 12, fire: 8, projectile: 10, boss: 15, shell: 12 },
    balance: {}, enemyTempo: 1, projectileSpeed: 100, leakShotInterval: 2.8,
    bossFireInterval: 7, bossFireLimit: 3, roomTimes: [40, 40, 35, 40],
  },
  hardcore: {
    label: 'Сложная', description: 'Быстрые угрозы и высокая цена ошибки. Уклоняйтесь и выбирайте маршрут.',
    damage: { contact: 18, fire: 12, projectile: 14, boss: 20, shell: 18 },
    balance: { damage: 18, invulnerability: 1.2, energyPerSecond: 12, ognPerFire: 0.8, backlogPenalty: 3 },
    enemyTempo: 1.2, projectileSpeed: 125, leakShotInterval: 2.4,
    bossFireInterval: 6, bossFireLimit: 2, roomTimes: [35, 35, 30, 35],
  },
};

export function getBalance(difficulty: Difficulty): BalanceConfig {
  return { ...BALANCE, ...DIFFICULTIES[difficulty].balance };
}
