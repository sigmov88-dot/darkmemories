import { describe, it, expect } from 'vitest';
import { WEAPONS } from './weapons';

describe('weapons balance', () => {
  it('меч сильнее, дальше и медленнее факела, но не светит', () => {
    expect(WEAPONS.sword.dmg).toBeGreaterThan(WEAPONS.torch.dmg);
    expect(WEAPONS.sword.range).toBeGreaterThan(WEAPONS.torch.range);
    expect(WEAPONS.sword.cooldown).toBeGreaterThanOrEqual(WEAPONS.torch.cooldown);
    expect(WEAPONS.sword.light).toBeLessThan(WEAPONS.torch.light);
  });

  it('меч убивает тень (3 HP) за 2 удара, факел — за 3', () => {
    const enemyHp = 3;
    expect(Math.ceil(enemyHp / WEAPONS.sword.dmg)).toBe(2);
    expect(Math.ceil(enemyHp / WEAPONS.torch.dmg)).toBe(3);
  });
});
