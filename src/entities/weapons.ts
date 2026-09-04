/**
 * Оружие: факел светит, но слаб; меч темен, но бьет вдвое больнее и дальше.
 * Выбор — тактика: свет против урона.
 */
export type WeaponId = 'torch' | 'sword';

export interface WeaponStats {
  dmg: number;
  range: number;
  cooldown: number;
  /** базовый свет в руке */
  light: number;
  label: string;
}

export const WEAPONS: Record<WeaponId, WeaponStats> = {
  torch: { dmg: 1, range: 2.4, cooldown: 0.45, light: 9, label: 'ФАКЕЛ' },
  sword: { dmg: 2, range: 2.8, cooldown: 0.6, light: 1.5, label: 'МЕЧ' }
};

export const SWING_LEN = 0.28;
export const SWING_HIT_WINDOW = 0.15;
