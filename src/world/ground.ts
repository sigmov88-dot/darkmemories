import * as THREE from 'three';
import { makePixelGround, makePixelCobble } from './pixel';

/**
 * Карта v3 — полноценный мир (юг → север):
 *
 *   z +34..+20  ДЕРЕВНЯ (дома вокруг площади, spawn 0,+26)
 *   z +20..+12  ПОЛЯ (заборы, сено)
 *   z +8        ВРАТА (арка)
 *   z +6..-6    КЛАДБИЩЕ (запад) / ЧАСОВНЯ (восток), тропа по центру
 *   z ≈ -11     РЕКА (мост на x=0, вброд не перейти)
 *   z -16..-24  ЗАМОК (двор, алтарь -18, донжон/портал -22)
 *   r > 44      Край мира (вал + лес-стена)
 */

export function riverZAt(x: number): number {
  return -11 + Math.sin(x * 0.08) * 2.0;
}

/** Высота земли — ЕДИНСТВЕННЫЙ источник правды (меш + физика игрока) */
export function getGroundHeight(x: number, z: number): number {
  // Мост: настил над рекой
  if (Math.abs(x) < 1.7 && z < -7.5 && z > -14.5) return 0.28;

  let h = 0;

  // Русло реки: канава глубиной 1.3, ширина ~4.4
  const rz = riverZAt(x);
  const dRiver = Math.abs(z - rz);
  if (dRiver < 3.4) {
    const k = Math.cos((dRiver / 3.4) * (Math.PI / 2)); // 1 в центре → 0 на краю
    h -= 1.35 * k * k;
  }

  // Холм замка: подъем к северу от реки
  if (z < -14) {
    h += Math.min((-14 - z) * 0.09, 1.3);
  }

  // Вал по краю мира
  const d = Math.sqrt(x * x + (z + 2) * (z + 2));
  if (d > 40) h += (d - 40) * 0.35;

  return h;
}

export function createGround(scene: THREE.Scene): void {
  const geo = new THREE.PlaneGeometry(150, 150, 110, 110);
  geo.rotateX(-Math.PI / 2);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, getGroundHeight(p.getX(i), p.getZ(i)));
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({ map: makePixelGround() });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);

  // --- Главная тропа: деревня → врата → мост → замок ---
  const stoneGeo = new THREE.BoxGeometry(0.55, 0.14, 0.55);
  const stoneMat = new THREE.MeshLambertMaterial({ map: makePixelCobble() });
  const positions: Array<[number, number]> = [];
  for (let z = 30; z >= -22; z -= 0.72) {
    // разрыв на реке — там мост
    const rz = riverZAt(0);
    if (z < rz + 3.2 && z > rz - 3.2) continue;
    const wobble = Math.sin(z * 0.5) * 0.18;
    positions.push([-0.62 + wobble, z]);
    positions.push([0.05 + wobble, z - 0.36]);
    positions.push([0.68 + wobble, z]);
    if (z < -14 || z > 22) {
      positions.push([-1.3 + wobble, z]);
      positions.push([1.32 + wobble, z]);
    }
  }
  const inst = new THREE.InstancedMesh(stoneGeo, stoneMat, positions.length);
  const dummy = new THREE.Object3D();
  positions.forEach(([x, z], i) => {
    dummy.position.set(x, getGroundHeight(x, z) + 0.07, z);
    dummy.rotation.y = (i * 0.37) % 0.5 - 0.25;
    const s = 0.85 + ((i * 13) % 10) / 28;
    dummy.scale.set(s, 1, s);
    dummy.updateMatrix();
    inst.setMatrixAt(i, dummy.matrix);
  });
  inst.instanceMatrix.needsUpdate = true;
  inst.receiveShadow = true;
  scene.add(inst);

  // --- Площади повторяют рельеф (иначе края тонут/висят на склоне) ---
  const plazaMat = new THREE.MeshLambertMaterial({ color: 0x33363f });
  const mkPlaza = (x: number, z: number, r: number): void => {
    const g = new THREE.CircleGeometry(r, 24);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const wx = x + pos.getX(i);
      const wz = z + pos.getZ(i);
      pos.setY(i, getGroundHeight(wx, wz) + 0.04 - getGroundHeight(x, z));
    }
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, plazaMat);
    m.position.set(x, getGroundHeight(x, z), z);
    m.receiveShadow = true;
    scene.add(m);
  };
  mkPlaza(0, 26, 5.5); // деревня
  mkPlaza(0, -18, 5.5); // двор замка
}
