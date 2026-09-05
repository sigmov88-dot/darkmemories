import * as THREE from 'three';
import { getGroundHeight, riverZAt, lakeNorm, ISLAND, CAUSEWAY, cragPathInfo, VIEWPOINT } from './ground';
import { makePixelGrass, makePixelFlower } from './pixel';

/** Луга с цветами: центр, радиус */
const MEADOWS: Array<readonly [number, number, number]> = [
  [0, 132, 30], // спавн-луг
  [-30, 60, 25], // западные поля
  [40, 40, 25] // восточные поля
];

/** Детали: трава, камыш у реки, светогрибы. Все — пиксель-билборды. */
export function createProps(scene: THREE.Scene): void {
  const grassTex = makePixelGrass();

  function clearForGrass(x: number, z: number): boolean {
    if (Math.abs(x) < 1.9 && z > -24 && z < 32) return false; // тропа
    if (Math.abs(z - riverZAt(x)) < 2.6) return false; // вода
    if (Math.abs(x) < 11 && z > 21 && z < 36) return false; // деревня (дома)
    if (Math.abs(x) < 8 && z > -26 && z < -12) return false; // двор замка
    if (Math.abs(x) < 9 && z > -7 && z < 7) return false; // кладбище/часовня интерьеры
    if (lakeNorm(x, z) > 0.5 && Math.hypot(x - ISLAND.x, z - ISLAND.z) > 5.5) return false; // озеро
    if (Math.abs(z - CAUSEWAY.z) < 2.2 && x < CAUSEWAY.x1 && x > CAUSEWAY.x0) return false; // дамба
    if (cragPathInfo(x, z).d < 1.4) return false; // серпантин
    if (Math.hypot(x - VIEWPOINT.x, z - VIEWPOINT.z) < 6) return false; // смотровая
    return true;
  }

  const bladeGeo = new THREE.PlaneGeometry(0.7, 0.5);
  const bladeMat = new THREE.MeshLambertMaterial({
    map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide
  });

  const spots: Array<[number, number]> = [];
  for (let i = 0; i < 800 && spots.length < 360; i++) {
    const x = ((i * 73) % 142) - 80;
    const z = 64 - ((i * 57) % 126);
    if (x > -4 && x < 22 && z > 36 && z < 56) continue; // ферма (грядки/дом)
    if (Math.hypot(x - 48, z + 12) < 8) continue; // башня
    if (clearForGrass(x, z)) spots.push([x, z]);
  }
  const inst = new THREE.InstancedMesh(bladeGeo, bladeMat, Math.max(spots.length * 2, 1));
  const dummy = new THREE.Object3D();
  let idx = 0;
  spots.forEach(([x, z], i) => {
    for (let k = 0; k < 2; k++) {
      dummy.position.set(x, getGroundHeight(x, z) + 0.22, z);
      dummy.rotation.y = (i % 4) * 0.78 + (k * Math.PI) / 2;
      const s = 0.7 + ((i + k) % 5) / 6;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      inst.setMatrixAt(idx++, dummy.matrix);
    }
  });
  inst.count = idx;
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  // Камыш вдоль берегов (по всей длине воды)
  const reedMat = new THREE.MeshLambertMaterial({
    map: grassTex, alphaTest: 0.5, side: THREE.DoubleSide, color: 0x6a8a7a
  });
  const reeds: Array<[number, number]> = [];
  for (let x = -60; x <= 40; x += 1.7) {
    const rz = riverZAt(x);
    if (Math.abs(x) < 2.6) continue; // проем моста
    reeds.push([x + 0.4, rz + 4.1]);
    reeds.push([x - 0.5, rz - 4.1]);
  }
  const reedInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.8, 0.9), reedMat, reeds.length * 2);
  let ri = 0;
  reeds.forEach(([x, z], i) => {
    for (let k = 0; k < 2; k++) {
      dummy.position.set(x, getGroundHeight(x, z) + 0.35, z);
      dummy.rotation.y = (i % 3) + (k * Math.PI) / 2;
      dummy.scale.setScalar(1.2);
      dummy.updateMatrix();
      reedInst.setMatrixAt(ri++, dummy.matrix);
    }
  });
  reedInst.count = ri;
  reedInst.instanceMatrix.needsUpdate = true;
  scene.add(reedInst);

  // Светогрибы у леса
  const mushGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const mushMat = new THREE.MeshLambertMaterial({
    color: 0x7a9ac8, emissive: 0x1a2a4a, emissiveIntensity: 0.7
  });
  const mush = new THREE.InstancedMesh(mushGeo, mushMat, 40);
  for (let i = 0; i < 40; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (12 + ((i * 53) % 14));
    const z = 6 - ((i * 31) % 26);
    dummy.position.set(x, getGroundHeight(x, z) + 0.08, z);
    dummy.rotation.set(0, i, 0);
    dummy.scale.setScalar(0.6 + (i % 4) / 4);
    dummy.updateMatrix();
    mush.setMatrixAt(i, dummy.matrix);
  }
  mush.instanceMatrix.needsUpdate = true;
  scene.add(mush);

  // Цветы лугов: 4 цвета, крест-билборды. Тропы и дома не зарастают.
  const blossoms = ['#d84a4a', '#e8e4d0', '#5a7ad8', '#e8c84a'];
  const flowerGeo = new THREE.PlaneGeometry(0.45, 0.55);
  for (const blossom of blossoms) {
    const fmat = new THREE.MeshLambertMaterial({
      map: makePixelFlower(blossom), alphaTest: 0.5, side: THREE.DoubleSide
    });
    const fspots: Array<[number, number]> = [];
    for (let i = 0; i < 300 && fspots.length < 90; i++) {
      const m = MEADOWS[(i + blossoms.indexOf(blossom)) % MEADOWS.length];
      const a = (i * 2.39996) % (Math.PI * 2);
      const r = 4 + ((i * 37) % Math.floor(m[2] * 10)) / 10;
      const x = m[0] + Math.cos(a) * r;
      const z = m[1] + Math.sin(a) * r;
      if (Math.abs(x) < 2.2 && z > 28 && z < 150) continue; // главная тропа
      if (getGroundHeight(x, z) < -0.15) continue; // не в воде
      fspots.push([x, z]);
    }
    const finst = new THREE.InstancedMesh(flowerGeo, fmat, Math.max(fspots.length * 2, 1));
    let fi = 0;
    fspots.forEach(([x, z], i) => {
      for (let k = 0; k < 2; k++) {
        dummy.position.set(x, getGroundHeight(x, z) + 0.26, z);
        dummy.rotation.set(0, (i % 4) * 0.78 + (k * Math.PI) / 2, 0);
        const s = 0.8 + ((i + k) % 4) / 5;
        dummy.scale.set(s, s, s);
        dummy.updateMatrix();
        finst.setMatrixAt(fi++, dummy.matrix);
      }
    });
    finst.count = fi;
    finst.instanceMatrix.needsUpdate = true;
    scene.add(finst);
  }
}
