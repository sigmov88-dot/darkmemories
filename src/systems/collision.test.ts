import { describe, it, expect } from 'vitest';
import { CollisionWorld } from './collision';

describe('CollisionWorld', () => {
  it('выталкивает из точного центра круга детерминированно', () => {
    const c = new CollisionWorld();
    c.addCircle(5, 5, 1.0);
    const out = { x: 0, z: 0 };
    const ret = c.resolve(5, 5, 0.42, out);
    expect(ret).toBe(out); // тот же объект, без аллокаций
    expect(Math.hypot(out.x - 5, out.z - 5)).toBeCloseTo(1.42, 5);
  });

  it('выталкивает центр изнутри блока наружу', () => {
    const c = new CollisionWorld();
    c.addBox(0, 0, 4, 4);
    const out = { x: 0, z: 0 };
    c.resolve(0.5, 0.2, 0.42, out);
    const outside =
      out.x <= -2 - 0.42 + 1e-6 ||
      out.x >= 2 + 0.42 - 1e-6 ||
      out.z <= -2 - 0.42 + 1e-6 ||
      out.z >= 2 + 0.42 - 1e-6;
    expect(outside).toBe(true);
  });

  it('не трогает точку в свободном месте', () => {
    const c = new CollisionWorld();
    c.addBox(10, 10, 2, 2);
    const out = { x: 0, z: 0 };
    c.resolve(0, 0, 0.42, out);
    expect(out.x).toBe(0);
    expect(out.z).toBe(0);
  });
});
