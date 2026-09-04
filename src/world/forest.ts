import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight, riverZAt } from './ground';
import { makePixelBark } from './pixel';

/** Мертвый лес — стена вокруг мира + рощи. Не лезет на карту. */
export function createDeadForest(scene: THREE.Scene, collision: CollisionWorld): void {
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.45, 7, 6);
  trunkGeo.translate(0, 3.5, 0);
  const trunkMat = new THREE.MeshLambertMaterial({ map: makePixelBark() });

  function clearOfMap(x: number, z: number): boolean {
    if (Math.abs(x) < 4 && z > -26 && z < 34) return false; // коридор тропы
    if (Math.abs(x) < 15 && z > 11 && z < 37) return false; // деревня+поля
    if (Math.abs(x) < 11 && z > -31 && z < -11) return false; // замок
    if (Math.abs(x) < 13 && z > -8 && z < 6.5) return false; // кладбище+часовня
    if (Math.abs(z - riverZAt(x)) < 5) return false; // река и берега
    return true;
  }

  const spots: Array<[number, number]> = [];
  // внешнее кольцо
  const COUNT = 120;
  for (let i = 0; i < COUNT; i++) {
    const ang = (i / COUNT) * Math.PI * 2 + (i % 7) * 0.09;
    const r = 32 + ((i * 29) % 16);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r - 2;
    if (clearOfMap(x, z)) spots.push([x, z]);
  }
  // рощи по бокам средней зоны
  for (let i = 0; i < 26; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (15 + ((i * 37) % 10));
    const z = 8 - ((i * 23) % 22);
    if (clearOfMap(x, z)) spots.push([x, z]);
  }

  const mesh = new THREE.InstancedMesh(trunkGeo, trunkMat, Math.max(spots.length, 1));
  mesh.castShadow = true;
  const dummy = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    dummy.position.set(x, getGroundHeight(x, z) - 0.2, z);
    dummy.rotation.y = (i * 1.3) % Math.PI;
    dummy.rotation.z = ((i * 7) % 10) / 10 * 0.2 - 0.1;
    const s = 0.9 + ((i * 11) % 10) / 12;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    if (Math.abs(x) < 30) collision.addCircle(x, z, 0.5); // толстые стволы Near-path — твердые
  });
  mesh.count = spots.length;
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);

  // Сучья
  const branchGeo = new THREE.BoxGeometry(2.4, 0.16, 0.16);
  const branch = new THREE.InstancedMesh(branchGeo, trunkMat, Math.max(spots.length, 1));
  const m4 = new THREE.Matrix4();
  spots.forEach((_, i) => {
    mesh.getMatrixAt(i, m4);
    dummy.position.set(m4.elements[12], m4.elements[13] + 4.4, m4.elements[14]);
    dummy.rotation.set(0, (i * 2.2) % Math.PI, 0.5);
    dummy.scale.setScalar(0.9);
    dummy.updateMatrix();
    branch.setMatrixAt(i, dummy.matrix);
  });
  branch.count = spots.length;
  branch.instanceMatrix.needsUpdate = true;
  scene.add(branch);
}
