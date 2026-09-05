import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import {
  getGroundHeight, riverZAt, lakeNorm,
  ISLAND, CAUSEWAY, cragPathInfo, VIEWPOINT
} from './ground';
import { makePixelBark, pixelCylinder, pixelBox } from './pixel';

/** Мертвый лес — стена по краю мира + рощи. Не лезет на тропы, воду и зоны. */
export function createDeadForest(scene: THREE.Scene, collision: CollisionWorld): void {
  const trunkGeo = pixelCylinder(0.14, 0.45, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ map: makePixelBark() });

  function clearOfMap(x: number, z: number): boolean {
    if (Math.abs(x) < 4 && z > -26 && z < 34) return false; // главная тропа
    if (Math.abs(x) < 15 && z > 11 && z < 37) return false; // деревня+поля
    if (Math.abs(x) < 11 && z > -31 && z < -11) return false; // замок
    if (Math.abs(x) < 13 && z > -8 && z < 6.5) return false; // кладбище+часовня
    if (Math.abs(z - riverZAt(x)) < 5) return false; // река и берега
    if (lakeNorm(x, z) > 0.3) return false; // озеро
    if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < 9) return false; // остров
    if (Math.abs(z - CAUSEWAY.z) < 3.5 && x < -22 && x > -44) return false; // дамба
    if (cragPathInfo(x, z).d < 4) return false; // серпантин
    if (Math.hypot(x - VIEWPOINT.x, z - VIEWPOINT.z) < 7) return false; // смотровая
    if (x > -4 && x < 22 && z > 36 && z < 54) return false; // ферма
    if (x > -13 && x < 13 && z > -52 && z < -32) return false; // осадный лагерь
    if (Math.hypot(x - 48, z + 12) < 9) return false; // сторожевая башня
    if (Math.hypot(x + 70, z - 40) < 12) return false; // западный хутор
    if (Math.hypot(x - 75, z - 55) < 12) return false; // южный хутор
    if (Math.hypot(x - 26, z - 18) < 12) return false; // Пепелище
    if (Math.hypot(x + 80, z + 30) < 14) return false; // форт
    if (Math.hypot(x, z - 132) < 22) return false; // спавн-луг
    return true;
  }

  const spots: Array<[number, number]> = [];
  // внешнее кольцо по новым границам
  const COUNT = 210;
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2 + (i % 7) * 0.09;
    const r = 62 + ((i * 29) % 34);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r * 0.9 - 2;
    if (clearOfMap(x, z)) spots.push([x, z]);
  }
  // рощи по бокам средней зоны
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (15 + ((i * 37) % 10));
    const z = 8 - ((i * 23) % 22);
    if (clearOfMap(x, z)) spots.push([x, z]);
  }
  // три бора на воле: западный, восточный, северный
  const massifs: Array<readonly [number, number, number, number]> = [
    // cx, cz, радиус, число
    [-100, 5, 30, 70],
    [95, -35, 28, 60],
    [-35, -70, 26, 55]
  ];
  for (const [mcx, mcz, mr, mn] of massifs) {
    for (let i = 0; i < mn; i++) {
      const a = i * 2.39996 + mcx;
      const r = mr * Math.sqrt(((i * 0.61803) % 1 + 1) % 1);
      const x = mcx + Math.cos(a) * r;
      const z = mcz + Math.sin(a) * r;
      if (clearOfMap(x, z)) spots.push([x, z]);
    }
  }

  const mesh = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(spots.length, 1));
  mesh.castShadow = true;
  const dummy = new THREE.Object3D();
  const scales: number[] = [];
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, getGroundHeight(x, z) - 0.2, z);
    dummy.rotation.y = (i * 1.3) % Math.PI;
    dummy.rotation.z = ((i * 7) % 10) / 10 * 0.2 - 0.1;
    const s = 0.9 + ((i * 11) % 10) / 12;
    scales.push(s);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    // Твердые только деревья ядра карты — дальние чисто декор (и дешевле для resolve)
    if (Math.abs(x) < 70 && z > -60 && z < 70) collision.addCircle(x, z, 0.5);
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // Сучья — на верхней трети СВОЕГО ствола (были на фиксированной высоте)
  const branchGeo = pixelBox(2.4, 0.16, 0.16);
  const branch = new THREE.InstancedMesh(branchGeo, trunkMat, Math.max(spots.length, 1));
  const m4 = new THREE.Matrix4();
  spots.forEach((_, i) => {
    mesh.getMatrixAt(i, m4);
    const s = scales[i];
    dummy.position.set(m4.elements[12], m4.elements[13] + 4.6 * s, m4.elements[14]);
    dummy.rotation.set(0, (i * 2.2) % Math.PI, 0.5);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    branch.setMatrixAt(i, dummy.matrix);
  });
  branch.count = spots.length;
  branch.instanceMatrix.needsUpdate = true;
  scene.add(branch);
}
