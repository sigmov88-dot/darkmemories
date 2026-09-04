import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight, LAKE, ISLAND, CAUSEWAY } from './ground';
import {
  makePixelWater, makePixelSand, makePixelWood,
  makePixelStone, makePixelDarkStone, makePixelGrass
} from './pixel';

export interface LakeRig {
  update: (t: number, dt: number) => void;
}

export function beaconSprite(color: string, w: number, h: number): THREE.Sprite {
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

interface Bird {
  group: THREE.Group;
  wingL: THREE.Mesh;
  wingR: THREE.Mesh;
  r: number;
  h: number;
  speed: number;
  phase: number;
}

/**
 * Черное озеро: зеркало воды, отмель, остров с затонувшей часовней,
 * дамба с перилами, камыш, кувшинки, брошенная лодка, птицы.
 * Мелководье проходимо вброд, глубь закрыта кольцом (кроме прохода к острову).
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
      const wx = LAKE.x + pos.getX(i) * LAKE.rx;
      const wz = LAKE.z + pos.getZ(i) * LAKE.rz;
      pos.setY(i, getGroundHeight(wx, wz) + 0.05);
    }
    sandGeo.computeVertexNormals();
  }
  const sand = new THREE.Mesh(sandGeo, sandMat);
  sand.receiveShadow = true;
  scene.add(sand);

  const woodMat = new THREE.MeshLambertMaterial({ map: makePixelWood() });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x2e2114 });

  // --- Дамба: доски + сваи + перила ---
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
  for (const dz of [-1.62, 1.62]) {
    const rail = new THREE.Mesh(
      new THREE.BoxGeometry(CAUSEWAY.x1 - CAUSEWAY.x0, 0.12, 0.12), darkWood
    );
    rail.position.set((CAUSEWAY.x0 + CAUSEWAY.x1) / 2, 1.15, CAUSEWAY.z + dz);
    rail.castShadow = true;
    scene.add(rail);
    for (let x = CAUSEWAY.x1 - 0.5; x >= CAUSEWAY.x0 + 0.5; x -= 2.5) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.14), darkWood);
      post.position.set(x, 0.72, CAUSEWAY.z + dz);
      scene.add(post);
    }
    collision.addBox((CAUSEWAY.x0 + CAUSEWAY.x1) / 2, CAUSEWAY.z + dz, CAUSEWAY.x1 - CAUSEWAY.x0, 0.28);
  }

  // --- Остров: затонувшая часовня ---
  const stoneMat = new THREE.MeshLambertMaterial({ map: makePixelStone() });
  const darkMat = new THREE.MeshLambertMaterial({ map: makePixelDarkStone() });
  const iy = getGroundHeight(ISLAND.x, ISLAND.z);
  const wallN = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3.0, 0.9), stoneMat);
  wallN.position.set(ISLAND.x, iy + 1.3, ISLAND.z - 2.2);
  wallN.castShadow = wallN.receiveShadow = true;
  scene.add(wallN);
  const wallW = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.2, 4.5), stoneMat);
  wallW.position.set(ISLAND.x - 2.4, iy + 0.95, ISLAND.z - 0.2);
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
  collision.addBox(ISLAND.x, ISLAND.z - 2.2, 5.7, 1.1);
  collision.addBox(ISLAND.x - 2.4, ISLAND.z - 0.2, 1.1, 4.7);
  collision.addCircle(ISLAND.x + 1.8, ISLAND.z + 0.6, 0.6);
  collision.addBox(ISLAND.x, ISLAND.z - 0.5, 1.0, 1.0);

  // Зеленый маяк острова — видно с берега и тракта
  const beacon = beaconSprite('rgba(110,255,190,0.85)', 2, 14);
  beacon.position.set(ISLAND.x, iy + 8, ISLAND.z - 0.5);
  scene.add(beacon);

  // --- Камыш по мелководью (кроме прохода к дамбе) ---
  const reedMat = new THREE.MeshLambertMaterial({
    map: makePixelGrass(), alphaTest: 0.5, side: THREE.DoubleSide, color: 0x5a7a6a
  });
  const reedGeo = new THREE.PlaneGeometry(0.8, 1.0);
  const REEDS = 70;
  const reeds = new THREE.InstancedMesh(reedGeo, reedMat, REEDS * 2);
  const dummy = new THREE.Object3D();
  let ri = 0;
  for (let i = 0; i < REEDS; i++) {
    const a = (i / REEDS) * Math.PI * 2 + (i % 5) * 0.07;
    // углы у дамбы (восток) оставляем чистыми
    const da = Math.abs(((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 0.3) continue;
    const edge = 0.72 + ((i * 37) % 10) / 60;
    const x = LAKE.x + Math.cos(a) * LAKE.rx * edge;
    const z = LAKE.z + Math.sin(a) * LAKE.rz * edge;
    for (let k = 0; k < 2; k++) {
      dummy.position.set(x, getGroundHeight(x, z) + 0.45, z);
      dummy.rotation.y = (i % 3) + (k * Math.PI) / 2;
      dummy.scale.setScalar(1.1);
      dummy.updateMatrix();
      reeds.setMatrixAt(ri++, dummy.matrix);
    }
  }
  reeds.count = ri;
  reeds.instanceMatrix.needsUpdate = true;
  scene.add(reeds);

  // --- Кувшинки на глади ---
  const lilyMat = new THREE.MeshLambertMaterial({ color: 0x2e4a33 });
  const lilyGeo = new THREE.CircleGeometry(0.35, 7);
  lilyGeo.rotateX(-Math.PI / 2);
  const LILIES = 16;
  const lilies = new THREE.InstancedMesh(lilyGeo, lilyMat, LILIES);
  for (let i = 0; i < LILIES; i++) {
    const a = (i / LILIES) * Math.PI * 2 + 0.4;
    const edge = 0.55 + ((i * 53) % 10) / 50;
    dummy.position.set(
      LAKE.x + Math.cos(a) * LAKE.rx * edge,
      LAKE.waterY + 0.02,
      LAKE.z + Math.sin(a) * LAKE.rz * edge
    );
    dummy.rotation.set(0, i * 1.3, 0);
    dummy.scale.setScalar(0.7 + (i % 4) / 5);
    dummy.updateMatrix();
    lilies.setMatrixAt(i, dummy.matrix);
  }
  lilies.instanceMatrix.needsUpdate = true;
  scene.add(lilies);

  // --- Брошенная лодка у восточного берега: кто-то плыл — не доплыл ---
  const boat = new THREE.Group();
  const bx = -30;
  const bz = -9.5;
  boat.position.set(bx, getGroundHeight(bx, bz) + 0.25, bz);
  boat.rotation.y = 0.7;
  boat.rotation.z = 0.12;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 3.2), darkWood);
  hull.castShadow = true;
  boat.add(hull);
  for (const sx of [-0.65, 0.65]) {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.7, 3.0), woodMat);
    side.position.set(sx, 0.3, 0);
    side.rotation.z = -sx * 0.25;
    boat.add(side);
  }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 2.6, 6), darkWood);
  mast.position.set(0, 1.2, 0.3);
  mast.rotation.z = 0.35;
  boat.add(mast);
  scene.add(boat);
  collision.addBox(bx, bz, 1.8, 3.4);

  // --- Птицы над озером ---
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x0d0f16 });
  const birds: Bird[] = [];
  for (let i = 0; i < 5; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.12), birdMat);
    group.add(body);
    const wingGeo = new THREE.PlaneGeometry(0.55, 0.22);
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x0d0f16, side: THREE.DoubleSide });
    const wingL = new THREE.Mesh(wingGeo, wingMat);
    wingL.position.x = -0.28;
    group.add(wingL);
    const wingR = new THREE.Mesh(wingGeo, wingMat);
    wingR.position.x = 0.28;
    group.add(wingR);
    scene.add(group);
    birds.push({
      group, wingL, wingR,
      r: 11 + (i % 3) * 4,
      h: 6 + (i % 4) * 1.5,
      speed: 0.25 + (i % 3) * 0.07,
      phase: i * 1.9
    });
  }

  // --- Береговые коллизии: кольцо с проемом под дамбу ---
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    const edge = 0.67;
    const x = LAKE.x + Math.cos(a) * LAKE.rx * edge;
    const z = LAKE.z + Math.sin(a) * LAKE.rz * edge;
    if (Math.abs(z - CAUSEWAY.z) < 3.5 && x > CAUSEWAY.x0 - 2) continue;
    collision.addBox(x, z, 3.2, 1.6);
  }
  // --- Глубь: второе кольцо, чтобы камера не уходила под воду ---
  // Проем на восток — проход к острову со стороны дамбы.
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const da = Math.abs(((a + 0.46 + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (da < 0.6) continue;
    const edge = 0.447;
    collision.addBox(
      LAKE.x + Math.cos(a) * LAKE.rx * edge,
      LAKE.z + Math.sin(a) * LAKE.rz * edge,
      3.0, 1.6
    );
  }

  return {
    update: (t: number, dt: number) => {
      waterTex.offset.x -= dt * 0.02;
      waterTex.offset.y = Math.sin(t * 0.5) * 0.04;
      for (const b of birds) {
        const a = t * b.speed + b.phase;
        b.group.position.set(
          LAKE.x + Math.cos(a) * b.r,
          b.h + Math.sin(t * 0.7 + b.phase) * 0.8,
          LAKE.z + Math.sin(a) * b.r * 0.7
        );
        b.group.rotation.y = -a;
        const flap = Math.sin(t * 9 + b.phase) * 0.55;
        b.wingL.rotation.y = flap;
        b.wingR.rotation.y = -flap;
      }
    }
  };
}
