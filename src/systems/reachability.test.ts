import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CollisionWorld } from './collision';
import { getGroundHeight } from '../world/ground';
import { createVillage } from '../world/village';
import { createRuins } from '../world/ruins';
import { createRiver } from '../world/river';
import { createLake } from '../world/lake';
import { createCrags } from '../world/crags';
import { createCastle } from '../world/castle';
import { createTorches } from '../world/torches';
import { createDeadForest } from '../world/forest';
import { createSatellites } from '../world/satellites';
import { SHARD_SPOTS, ALTAR_POS, PORTAL_POS, SHARD_TAKE_R } from '../world/landmarks';

/**
 * Тест проходимости: ПОЛНЫЙ мир (все строители с коллайдерами).
 * Позитивные проверки: цели доступны. Негативные: глубь озера,
 * стремнина реки и обрывы — НЕ достижимы (барьеры целы).
 * BFS по сетке 0.5м с радиусом игрока 0.42.
 * Упрощение: «глубина < −0.8 = нельзя» — проектное намерение
 * (глубокая вода вне игры), в движке глубины нет.
 */
describe('reachability', () => {
  it(
    'все цели доступны, барьеры целы',
    () => {
      const scene = new THREE.Scene();
      const collision = new CollisionWorld();
      createVillage(scene, collision);
      createRuins(scene, collision);
      createRiver(scene, collision);
      createLake(scene, collision);
      createCrags(scene, collision);
      createCastle(scene, collision);
      createTorches(scene, collision);
      createDeadForest(scene, collision);
      createSatellites(scene, collision);

      const STEP = 0.5;
      const MIN_X = -64;
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
      // (у костра радиус 1.1+0.42, встать можно вплотную: порог 1.6)
      expect(nearestVisitedDist(-33, -4)).toBeLessThan(1.0);
      expect(nearestVisitedDist(38, -8)).toBeLessThan(1.6);
      // M2: остров (пьедестал под ключ) достижим вброд от дамбы
      expect(nearestVisitedDist(-44.5, -3)).toBeLessThan(1.0);
      // Спутники: ферма, осадный лагерь, сторожевая башня
      expect(nearestVisitedDist(10, 38)).toBeLessThan(1.5);
      expect(nearestVisitedDist(0, -36)).toBeLessThan(1.5);
      expect(nearestVisitedDist(44.5, -12)).toBeLessThan(1.5);
      // Пепелище и цвингер (патрульный проход между стенами)
      expect(nearestVisitedDist(26, 19)).toBeLessThan(1.5);
      expect(nearestVisitedDist(9, -20)).toBeLessThan(1.5);
      // Мост — единственный путь через реку в окне карты
      expect(nearestVisitedDist(0, -11)).toBeLessThan(0.8);
      // Негативы: глубь озера, стремнина и конец русла — вне доступа
      // (центр озера — склон острова, поэтому проба в настоящей глуби на западе)
      expect(nearestVisitedDist(-58, -2)).toBeGreaterThan(5);
      expect(nearestVisitedDist(30, -11.5)).toBeGreaterThan(1.2);
      expect(nearestVisitedDist(-20, -11)).toBeGreaterThan(1.2);
    },
    60000
  );
});
