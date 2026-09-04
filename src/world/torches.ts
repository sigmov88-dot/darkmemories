import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { makePixelFlame } from './pixel';
import { getGroundHeight } from './ground';

export interface TorchRig {
  update: (t: number) => void;
}

const woodMat = new THREE.MeshLambertMaterial({ color: 0x2e2114 });
const ironMat = new THREE.MeshLambertMaterial({ color: 0x1c1e26 });

function makeStandingTorch(
  scene: THREE.Scene, x: number, z: number, intensity = 11
): { light: THREE.PointLight; flame: THREE.Sprite } {
  const gy = getGroundHeight(x, z);
  const grp = new THREE.Group();
  grp.position.set(x, gy, z);

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.2, 6), woodMat);
  pole.position.y = 1.1;
  pole.castShadow = true;
  grp.add(pole);

  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.1, 0.25, 6), ironMat);
  cup.position.y = 2.3;
  grp.add(cup);

  const flame = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: makePixelFlame(), transparent: true, depthWrite: false })
  );
  flame.position.y = 2.65;
  flame.scale.set(0.55, 0.75, 1);
  grp.add(flame);

  // без теней — только свет (дешево), дистанция режет фрагментный кост
  const light = new THREE.PointLight(0xff8033, intensity, 15, 1.6);
  light.position.y = 2.6;
  grp.add(light);

  scene.add(grp);
  return { light, flame };
}

/**
 * Факелы-вехи вдоль всего маршрута: деревня → поля → врата →
 * середина → мост → ворота замка → двор. Ведут игрока без маркеров.
 * Яркость разная: ключевые (мост, ворота, площадь) — ярче,
 * второстепенные — приглушены, чтобы свет оставался «жемчужиной».
 */
export function createTorches(scene: THREE.Scene, collision: CollisionWorld): TorchRig {
  const spots: Array<[number, number, number]> = [
    [2.5, 23.5, 12], // площадь деревни — ярко
    [-1.9, 16.5, 8], // поля — приглушен
    [-2.9, 9.3, 9], // врата запад
    [2.9, 9.3, 9], // врата восток
    [1.9, -4.5, 8], // середина — приглушен
    [-2.2, -7.4, 13], // мост юг — ярко
    [2.2, -14.8, 12], // мост север / ворота замка — ярко
    [-3.5, -18, 10] // двор замка
  ];
  const list = spots.map(([x, z, base]) => ({ ...makeStandingTorch(scene, x, z, base), base }));
  // шест тонкий, но проходить сквозь пламя некрасиво — маленькие круги
  for (const [x, z] of spots) collision.addCircle(x, z, 0.28);
  return {
    update: (t: number) => {
      const step = Math.floor(t * 8);
      list.forEach((f, i) => {
        const n = Math.sin(step * 1.7 + i * 2.4) * 0.5 + Math.sin(step * 0.6 + i) * 0.5;
        f.light.intensity = f.base + n * 2.0;
        f.flame.scale.set(0.55 + n * 0.03, 0.75 - n * 0.04, 1);
        f.flame.position.x = n * 0.03;
      });
    }
  };
}
