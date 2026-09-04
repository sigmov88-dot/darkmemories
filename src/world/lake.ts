import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight, LAKE, ISLAND, CAUSEWAY } from './ground';
import { makePixelWater, makePixelSand, makePixelWood, makePixelStone, makePixelDarkStone } from './pixel';

export interface LakeRig {
  update: (t: number, dt: number) => void;
}

function beaconSprite(color: string, w: number, h: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 64, 0, 0);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(6, 0, 4, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: tex, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    })
  );
  s.scale.set(w, h, 1);
  return s;
}

/**
 * Черное озеро: зеркало воды, остров с затонувшей часовней,
 * дамба с берега, кольцо береговых коллайдеров с проемом под дамбу.
 */
export function createLake(scene: THREE.Scene, collision: CollisionWorld): LakeRig {
  const waterTex = makePixelWater();
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(LAKE.rx * 2 + 6, LAKE.rz * 2 + 6),
    new THREE.MeshLambertMaterial({
      map: waterTex, transparent: true, opacity: 0.94, color: 0x8a9ab0
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(LAKE.x, LAKE.waterY, LAKE.z);
  scene.add(water);

  // Песчаная отмель-кольцо у берега (повторяет рельеф)
  const sandMat = new THREE.MeshLambertMaterial({ map: makePixelSand() });
  const sandGeo = new THREE.RingGeometry(0.86, 1.02, 48, 1);
  sandGeo.rotateX(-Math.PI / 2);
  {
    const pos = sandGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      // локальные XZ кольца [-1.02..1.02] → мировые через масштаб эллипса
      const wx = LAKE.x + pos.getX(i) * LAKE.rx;
      const wz = LAKE.z + pos.getZ(i) * LAKE.rz;
      pos.setY(i, getGroundHeight(wx, wz) + 0.05);
    }
    sandGeo.computeVertexNormals();
  }
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.position.set(0, 0, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  // --- Дамба: доски + сваи ---
  const woodMat = new THREE.MeshLambertMaterial({ map: makePixelWood() });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x2e2114 });
  for (let x = CAUSEWAY.x1; x >= CAUSEWAY.x0; x -= 0.62) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.1, 3.0), woodMat);
    plank.position.set(x, 0.3, CAUSEWAY.z);
    plank.castShadow = plank.receiveShadow = true;
    scene.add(plank);
  }
  for (let x = CAUSEWAY.x1 - 1; x >= CAUSEWAY.x0 + 1; x -= 2.4) {
    for (const dz of [-1.3, 1.3]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 2.4, 6), darkWood);
      pile.position.set(x, -0.8, CAUSEWAY.z + dz);
      scene.add(pile);
    }
  }

  // --- Остров: затонувшая часовня ---
  const stoneMat = new THREE.MeshLambertMaterial({ map: makePixelStone() });
  const darkMat = new THREE.MeshLambertMaterial({ map: makePixelDarkStone() });
  const iy = getGroundHeight(ISLAND.x, ISLAND.z);
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.0, 0.9), stoneMat);
  wallN.position.set(ISLAND.x, iy + 1.5, ISLAND.z - 2.2);
  wallN.castShadow = wallN.receiveShadow = true;
  scene.add(wallN);
  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 4.5), stoneMat);
  wallW.position.set(ISLAND.x - 2.4, iy + 1.1, ISLAND.z - 0.2);
  wallW.rotation.z = 0.06;
  wallW.castShadow = true;
  scene.add(wallW);
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.46, 2.6, 8), stoneMat);
  col.position.set(ISLAND.x + 1.8, iy + 1.3, ISLAND.z + 0.6);
  col.castShadow = true;
  scene.add(col);
  // пьедестал под ключ (сам ключ — Фаза M3)
  const ped = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), darkMat);
  ped.position.set(ISLAND.x, iy + 0.5, ISLAND.z - 0.5);
  ped.castShadow = true;
  scene.add(ped);
  collision.addBox(ISLAND.x, ISLAND.z - 2.2, 5.7, 1.1); // северная стена
  collision.addBox(ISLAND.x - 2.4, ISLAND.z - 0.2, 1.1, 4.7); // западная стена
  collision.addCircle(ISLAND.x + 1.8, ISLAND.z + 0.6, 0.6); // колонна
  collision.addBox(ISLAND.x, ISLAND.z - 0.5, 1.0, 1.0); // пьедестал

  // Зеленый маяк острова — видно с берега и тракта
  const beacon = beaconSprite('rgba(110,255,190,0.85)', 3, 14);
  beacon.position.set(ISLAND.x, iy + 8, ISLAND.z - 0.5);
  scene.add(beacon);

  // --- Береговые коллизии: кольцо с проемом под дамбу ---
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const edge = 0.67; // norm ≈ 0.55 — по колено в воде
    const x = LAKE.x + Math.cos(a) * LAKE.rx * edge;
    const z = LAKE.z + Math.sin(a) * LAKE.rz * edge;
    if (Math.abs(z - CAUSEWAY.z) < 3.5 && x > CAUSEWAY.x0 - 2) continue; // проем дамбы
    collision.addBox(x, z, 3.2, 1.6);
  }

  return {
    update: (_t: number, dt: number) => {
      waterTex.offset.x -= dt * 0.02;
      waterTex.offset.y = Math.sin(_t * 0.5) * 0.04;
    }
  };
}

export { beaconSprite };
