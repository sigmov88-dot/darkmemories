import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { createEnemies } from './enemies';

/**
 * Замах 0.4с: урона нет раньше времени, удар приходит после телеграфа.
 * Враг у дома (-7.5,-1.5), игрок стоит в 1.5м — в радиусе атаки.
 */
describe('enemy windup', () => {
  it('бьет только после 0.4с замаха', () => {
    const scene = new THREE.Scene();
    const collision = new CollisionWorld();
    const enemies = createEnemies(scene, collision);
    const pp = new THREE.Vector3(-7.5 + 1.5, 0, -1.5);
    const dt = 1 / 60;
    let t = 0;
    let hits = 0;

    for (let i = 0; i < 20; i++) {
      t += dt;
      hits += enemies.update(dt, t, pp, null, true).toPlayer;
    }
    expect(hits).toBe(0); // 0.33с — еще замах

    for (let i = 0; i < 25; i++) {
      t += dt;
      hits += enemies.update(dt, t, pp, null, true).toPlayer;
    }
    expect(hits).toBe(1); // ~0.75с — удар прошел, дальше кулдаун
  });
});
