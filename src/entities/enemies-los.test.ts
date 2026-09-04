import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { createEnemies } from './enemies';

const HOME = { x: -7.5, z: -1.5 }; // пост тени на кладбище
const PX = HOME.x + 6; // игрок в 6м (внутри агро 9м)

function runFrames(
  collision: CollisionWorld,
  frames: number,
  px: number,
  pz: number
): number {
  const scene = new THREE.Scene();
  const enemies = createEnemies(scene, collision);
  const pp = new THREE.Vector3(px, 0, pz);
  const dt = 1 / 60;
  let t = 0;
  let hits = 0;
  for (let i = 0; i < frames; i++) {
    t += dt;
    hits += enemies.update(dt, t, pp, null, true).toPlayer;
  }
  return hits;
}

describe('enemy line of sight', () => {
  it('segBlocked видит стену и свободный проход', () => {
    const c = new CollisionWorld();
    c.addBox(-4.5, -1.5, 1.0, 4.0);
    expect(c.segBlocked(HOME.x, HOME.z, PX, HOME.z)).toBe(true);
    expect(c.segBlocked(HOME.x, HOME.z, HOME.x + 1, HOME.z)).toBe(false);
    // касательный луч мимо угла — не блок
    expect(c.segBlocked(HOME.x, HOME.z + 5, PX, HOME.z + 5)).toBe(false);
  });

  it('сквозь стены не агрится и не бьет', () => {
    const c = new CollisionWorld();
    // закрытая комната вокруг игрока: ни одна из 5 теней не видит и не дойдет
    c.addBox(-1.5, 0.2, 3.8, 0.4); // север
    c.addBox(-1.5, -3.2, 3.8, 0.4); // юг
    c.addBox(-3.2, -1.5, 0.4, 3.8); // запад
    c.addBox(0.2, -1.5, 0.4, 3.8); // восток
    expect(runFrames(c, 240, -1.5, -1.5)).toBe(0);
  });

  it('без стены за то же время догоняет и бьет', () => {
    const c = new CollisionWorld();
    expect(runFrames(c, 240, PX, HOME.z)).toBeGreaterThan(0);
  });
});
