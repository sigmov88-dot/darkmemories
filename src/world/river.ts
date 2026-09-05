import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight, riverZAt, FORDS } from './ground';
import { makePixelWater, makePixelSand, makePixelWood } from './pixel';

export interface RiverRig {
  update: (t: number, dt: number) => void;
}

/**
 * Река: лента воды вдоль riverZAt(x), песчаные берега, мост на x=0.
 * Вброд не перейти: берега перекрыты коллайдерами, проход только по мосту.
 */
export function createRiver(scene: THREE.Scene, collision: CollisionWorld): RiverRig {
  const waterTex = makePixelWater();
  const waterMat = new THREE.MeshLambertMaterial({
    map: waterTex,
    transparent: true,
    opacity: 0.92
  });

  // Лента воды из сегментов 2м — повторяет изгиб русла.
  // Запад — до края карты (река уходит за мир), восток — до конца русла (x=42).
  const SEG = 96;
  const X0 = -150;
  const X1 = 42;
  const waterGeo = new THREE.PlaneGeometry((X1 - X0) / SEG, 7.6, 1, 4);
  waterGeo.rotateX(-Math.PI / 2);
  const water = new THREE.InstancedMesh(waterGeo, waterMat, SEG);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < SEG; i++) {
    const x = X0 + (i + 0.5) * ((X1 - X0) / SEG);
    dummy.position.set(x, -0.55, riverZAt(x));
    dummy.rotation.y = Math.atan2(
      riverZAt(x + 1) - riverZAt(x - 1),
      2
    );
    dummy.updateMatrix();
    water.setMatrixAt(i, dummy.matrix);
  }
  water.instanceMatrix.needsUpdate = true;
  scene.add(water);

  // Песчаные берега — две ленты по краям русла
  const sandMat = new THREE.MeshLambertMaterial({ map: makePixelSand() });
  for (const side of [-1, 1]) {
    const bankGeo = new THREE.PlaneGeometry((X1 - X0) / SEG, 1.6, 1, 1);
    bankGeo.rotateX(-Math.PI / 2);
    const bank = new THREE.InstancedMesh(bankGeo, sandMat, SEG);
    for (let i = 0; i < SEG; i++) {
      const x = X0 + (i + 0.5) * ((X1 - X0) / SEG);
      const rz = riverZAt(x);
      dummy.position.set(x, getGroundHeight(x, rz + side * 3.6) + 0.05, rz + side * 3.6);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bank.setMatrixAt(i, dummy.matrix);
    }
    bank.instanceMatrix.needsUpdate = true;
    bank.receiveShadow = true;
    scene.add(bank);
  }

  // --- Мост: настил + перила + сваи ---
  const woodMat = new THREE.MeshLambertMaterial({ map: makePixelWood() });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x2e2114 });
  const bridge = new THREE.Group();
  scene.add(bridge);

  const deckY = 0.3; // верх досок 0.35 = физическая земля в getGroundHeight
  // доски настила
  for (let z = -7.6; z >= -14.4; z -= 0.62) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.1, 0.55), woodMat);
    plank.position.set(0, deckY, z);
    plank.castShadow = plank.receiveShadow = true;
    bridge.add(plank);
  }
  // продольные балки
  for (const x of [-1.35, 1.35]) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.22, 7.4), darkWood);
    beam.position.set(x, deckY - 0.12, -11);
    beam.castShadow = true;
    bridge.add(beam);
  }
  // перила
  for (const x of [-1.55, 1.55]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 7.4), darkWood);
    rail.position.set(x, deckY + 0.95, -11);
    rail.castShadow = true;
    bridge.add(rail);
    for (let z = -7.8; z >= -14.2; z -= 1.6) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.0, 0.16), darkWood);
      post.position.set(x, deckY + 0.5, z);
      post.castShadow = true;
      bridge.add(post);
    }
  }
  // сваи в воду
  for (const x of [-1.2, 1.2]) {
    for (const z of [-9.2, -11, -12.8]) {
      const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 2.2, 6), darkWood);
      pile.position.set(x, -0.7, z);
      bridge.add(pile);
    }
  }

  // --- Коллизии реки: цепочка блоков вдоль всего русла ---
  // Разрывы: мост (x=0) и броды. Обход конца на востоке легален.
  const isGap = (x: number): boolean => {
    if (Math.abs(x) < 2.4) return true; // проем моста
    for (const fx of FORDS) {
      if (Math.abs(x - fx) < 2.5) return true; // броды
    }
    return false;
  };
  for (let x = -150; x <= 44; x += 2) {
    if (isGap(x)) continue;
    const rz = riverZAt(x);
    collision.addBox(x, rz + 2.6, 2.2, 1.2); // южный край
    collision.addBox(x, rz - 2.6, 2.2, 1.2); // северный край
  }
  // Сузить проем до ширины моста, чтобы нельзя было обойти по мелководью
  for (const sx of [-2.2, 2.2]) {
    const rz = riverZAt(sx);
    collision.addBox(sx, rz + 2.6, 1.0, 1.2);
    collision.addBox(sx, rz - 2.6, 1.0, 1.2);
  }
  // Перила моста — коридор 2.6м
  collision.addBox(-1.75, -11, 0.3, 7.6);
  collision.addBox(1.75, -11, 0.3, 7.6);

  // Маркеры бродов: столбики-пирамидки по сторонам (без коллизий — низкие)
  const cairnMat = new THREE.MeshLambertMaterial({ color: 0x4a4d5c });
  for (const fx of FORDS) {
    for (const side of [-3.5, 3.5]) {
      for (const bank of [-1, 1]) {
        const cx = fx + side;
        const cz = riverZAt(fx) + bank * 3.4;
        const gy = getGroundHeight(cx, cz);
        const cairn = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.9, 7), cairnMat);
        cairn.position.set(cx, gy + 0.45, cz);
        cairn.castShadow = true;
        scene.add(cairn);
      }
    }
  }

  return {
    update: (_t: number, dt: number) => {
      waterTex.offset.x -= dt * 0.03;
      waterTex.offset.y = Math.sin(_t * 0.6) * 0.05;
    }
  };
}
