import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight, ridgeXAt, cragPathInfo, VIEWPOINT } from './ground';
import { beaconSprite } from './lake';

export interface CragsRig {
  update: (t: number) => void;
}

/**
 * Скальный кряж: инстансированные глыбы вдоль гребня,
 * тропа-серпантин с каирнами и знаменами, смотровая с костром-маяком.
 * Западный обрыв закрыт стеной коллайдеров с проемом под тропу.
 */
export function createCrags(scene: THREE.Scene, collision: CollisionWorld): CragsRig {
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4a4d5c });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2c2f3a });
  const bannerMat = new THREE.MeshLambertMaterial({ color: 0x6e1a1a, side: THREE.DoubleSide });

  // Глыбы вдоль гребня — два ряда со сдвигом
  const rockGeo = new THREE.DodecahedronGeometry(1.4, 0);
  const spots: Array<[number, number, number]> = [];
  for (let z = -34; z <= 26; z += 3) {
    const rx = ridgeXAt(z);
    // пропускаем там, где серпантин пересекает гребень
    if (cragPathInfo(rx - 3.5, z).d < 5) continue;
    spots.push([rx + 1.5, z, 0.8 + ((z * 13) % 10) / 12]);
    if ((z | 0) % 6 === 0) spots.push([rx + 6, z + 1.5, 1.2 + ((z * 7) % 8) / 10]);
  }
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, Math.max(spots.length, 1));
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z, s], i) => {
    dummy.position.set(x, getGroundHeight(x, z) + 0.4 * s, z);
    dummy.rotation.set((i * 1.1) % 3, (i * 2.3) % 3, 0);
    dummy.scale.set(s, s * 0.8, s);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
    if (cragPathInfo(x, z).d < 5) collision.addCircle(x, z, 1.3 * s);
  });
  rocks.count = spots.length;
  rocks.instanceMatrix.needsUpdate = true;
  scene.add(rocks);

  // Западный обрыв: стена с проемом под тропу
  for (let z = -32; z <= 24; z += 2) {
    const lx = ridgeXAt(z) - 3.5;
    if (cragPathInfo(lx, z).d < 4.5) continue; // проем серпантина
    collision.addBox(lx, z, 3.0, 2.4);
  }

  // Маркеры поворотов: каирны (пирамидки из плоских камней)
  const cairnSpots: Array<[number, number]> = [[26, 7.5], [31.5, 1.5], [36, -5]];
  for (const [cx, cz] of cairnSpots) {
    const cy = getGroundHeight(cx, cz);
    let r = 0.55;
    let y = cy;
    for (let i = 0; i < 4; i++) {
      const stone = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.08, 0.28, 7), rockMat);
      stone.position.set(cx, y + 0.14, cz);
      stone.rotation.y = i * 0.7;
      stone.castShadow = true;
      scene.add(stone);
      y += 0.28;
      r *= 0.72;
    }
    collision.addCircle(cx, cz, 0.6);
  }

  // Знамена на шестах вдоль тропы — видно издалека, ведут вверх
  const bannerSpots: Array<[number, number]> = [[22, 9.5], [30.5, 3], [35.5, -4.5]];
  const banners: THREE.Mesh[] = [];
  for (const [bx, bz] of bannerSpots) {
    const by = getGroundHeight(bx, bz);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), darkMat);
    pole.position.set(bx, by + 1.3, bz);
    pole.castShadow = true;
    scene.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.0), bannerMat);
    flag.position.set(bx + 0.3, by + 2.0, bz);
    scene.add(flag);
    banners.push(flag);
    collision.addCircle(bx, bz, 0.2);
  }
  const vx = VIEWPOINT.x;
  const vz = VIEWPOINT.z;
  const vy = getGroundHeight(vx, vz);
  const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.0, 0.4, 8), darkMat);
  pit.position.set(vx, vy + 0.2, vz);
  pit.receiveShadow = true;
  scene.add(pit);
  const emberMat = new THREE.MeshBasicMaterial({ color: 0xff7a26 });
  const ember = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.9), emberMat);
  ember.position.set(vx, vy + 0.42, vz);
  scene.add(ember);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.2, 6), darkMat);
    log.position.set(vx + Math.cos(a) * 0.5, vy + 0.45, vz + Math.sin(a) * 0.5);
    log.rotation.z = Math.PI / 2.3;
    log.rotation.y = -a;
    scene.add(log);
  }
  const bench = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 2.4, 7), darkMat);
  bench.rotation.z = Math.PI / 2;
  bench.position.set(vx - 0.4, vy + 0.25, vz + 2.2);
  bench.castShadow = true;
  scene.add(bench);
  collision.addCircle(vx, vz, 1.1); // кострище
  const beacon = beaconSprite('rgba(255,150,60,0.85)', 2.5, 16);
  beacon.position.set(vx, vy + 9, vz);
  scene.add(beacon);

  return {
    update: (t: number) => {
      banners.forEach((f, i) => {
        f.rotation.y = Math.sin(t * 2.2 + i * 1.4) * 0.45;
      });
      emberMat.color.setHex(Math.floor(t * 3) % 2 === 0 ? 0xff7a26 : 0xd85a1a);
    }
  };
}
