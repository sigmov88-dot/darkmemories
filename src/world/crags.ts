import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight, ridgeXAt, cragPathInfo, VIEWPOINT } from './ground';
import { beaconSprite } from './lake';

/**
 * Скальный кряж: инстансированные глыбы вдоль гребня,
 * тропа-серпантин, смотровая с костром-маяком.
 * Западный обрыв закрыт стеной коллайдеров с проемом под тропу.
 */
export function createCrags(scene: THREE.Scene, collision: CollisionWorld): void {
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4a4d5c });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x2c2f3a });

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

  // Смотровая: кострище + скамья-бревно + оранжевый маяк
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
}
