import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from './collision';
import { getGroundHeight } from '../world/ground';
import { createVillage } from '../world/village';
import { createRuins } from '../world/ruins';
import { createRiver } from '../world/river';
import { createCastle } from '../world/castle';
import { createTorches } from '../world/torches';
import { createDeadForest } from '../world/forest';
import { SHARD_SPOTS, ALTAR_POS, PORTAL_POS, SHARD_TAKE_R } from './quest';

/**
 * Тест проходимости из вердикта: от спавна должны быть доступны
 * все 5 осколков (радиус взятия), зона алтаря и триггер портала.
 * BFS по сетке 0.5м с теми же коллайдерами и радиусом игрока 0.42.
 */
describe('reachability', () => {
  it(
    'все цели доступны от спавна (0, 26)',
    () => {
      const scene = new THREE.Scene();
      const collision = new CollisionWorld();
      createVillage(scene, collision);
      createRuins(scene, collision);
      createRiver(scene, collision);
      createCastle(scene, collision);
      createTorches(scene, collision);
      createDeadForest(scene, collision);

      const STEP = 0.5;
      const MIN_X = -46;
      const MAX_X = 46;
      const MIN_Z = -36;
      const MAX_Z = 42;
      const W = Math.round((MAX_X - MIN_X) / STEP) + 1;
      const H = Math.round((MAX_Z - MIN_Z) / STEP) + 1;
      const out = { x: 0, z: 0 };

      const walkable = (x: number, z: number): boolean => {
        collision.resolve(x, z, 0.42, out);
        if (Math.hypot(out.x - x, out.z - z) > 0.05) return false;
        if (getGroundHeight(x, z) < -0.8) return false; // глубокая вода
        return true;
      };

      const seen = new Uint8Array(W * H);
      const idx = (ix: number, iz: number): number => iz * W + ix;
      const start: [number, number] = [0, 26];
      const six = Math.round((start[0] - MIN_X) / STEP);
      const siz = Math.round((start[1] - MIN_Z) / STEP);
      expect(walkable(start[0], start[1])).toBe(true);

      const queue: Array<[number, number]> = [[six, siz]];
      seen[idx(six, siz)] = 1;
      const DIRS: Array<[number, number]> = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
      ];
      while (queue.length > 0) {
        const [cx, cz] = queue.pop() as [number, number];
        for (const [dx, dz] of DIRS) {
          const nx = cx + dx;
          const nz = cz + dz;
          if (nx < 0 || nz < 0 || nx >= W || nz >= H || seen[idx(nx, nz)]) continue;
          // без срезания углов сквозь коллайдеры
          if (dx !== 0 && dz !== 0) {
            if (!seen[idx(cx + dx, cz)] || !seen[idx(cx, cz + dz)]) continue;
          }
          const wx = MIN_X + nx * STEP;
          const wz = MIN_Z + nz * STEP;
          if (!walkable(wx, wz)) continue;
          seen[idx(nx, nz)] = 1;
          queue.push([nx, nz]);
        }
      }

      let visited = 0;
      for (let i = 0; i < seen.length; i++) if (seen[i]) visited++;
      expect(visited).toBeGreaterThan(2000);

      const nearestVisitedDist = (x: number, z: number): number => {
        const r = 6;
        let best = Infinity;
        const ix0 = Math.max(0, Math.round((x - r - MIN_X) / STEP));
        const ix1 = Math.min(W - 1, Math.round((x + r - MIN_X) / STEP));
        const iz0 = Math.max(0, Math.round((z - r - MIN_Z) / STEP));
        const iz1 = Math.min(H - 1, Math.round((z + r - MIN_Z) / STEP));
        for (let ix = ix0; ix <= ix1; ix++) {
          for (let iz = iz0; iz <= iz1; iz++) {
            if (!seen[idx(ix, iz)]) continue;
            const d = Math.hypot(MIN_X + ix * STEP - x, MIN_Z + iz * STEP - z);
            if (d < best) best = d;
          }
        }
        return best;
      };

      for (const [sx, sz, hint] of SHARD_SPOTS) {
        expect(
          nearestVisitedDist(sx, sz),
          `осколок «${hint}» (${sx}, ${sz}) недоступен`
        ).toBeLessThan(SHARD_TAKE_R - 0.05);
      }
      expect(nearestVisitedDist(ALTAR_POS.x, ALTAR_POS.z)).toBeLessThan(
        ALTAR_POS.interactR - 0.1
      );
      expect(nearestVisitedDist(PORTAL_POS.x, PORTAL_POS.z)).toBeLessThan(
        PORTAL_POS.triggerR - 0.1
      );
      // M1: новые земли тоже доступны — середина дамбы и смотровая
      expect(nearestVisitedDist(-33, -4)).toBeLessThan(1.0);
      expect(nearestVisitedDist(38, -8)).toBeLessThan(1.5);
    },
    60000
  );
});
