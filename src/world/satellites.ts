import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight } from './ground';
import { makePixelWood, makePixelThatch, makePixelPlaster, makePixelStone, makePixelDarkStone } from './pixel';
import { pixelBox, pixelCylinder } from './pixel';

export interface SatellitesRig {
  update: (t: number, dt: number) => void;
}

/**
 * Спутники открытого мира (все опционально, квест не требуют):
 *  - ферма с ветряком на юге (10, 44);
 *  - осадный лагерь на севере (0, -40);
 *  - сторожевая башня на восточном плато (48, -12).
 */
export function createSatellites(scene: THREE.Scene, collision: CollisionWorld): SatellitesRig {
  const woodMat = new THREE.MeshLambertMaterial({ map: makePixelWood() });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x2a1e12 });
  const thatchMat = new THREE.MeshLambertMaterial({ map: makePixelThatch() });
  const plasterMat = new THREE.MeshLambertMaterial({ map: makePixelPlaster() });
  const stoneMat = new THREE.MeshLambertMaterial({ map: makePixelStone() });
  const darkMat = new THREE.MeshLambertMaterial({ map: makePixelDarkStone() });
  const canvasMat = new THREE.MeshLambertMaterial({ color: 0x5a5142 });

  // ---------- Ферма ----------
  const millX = 10;
  const millZ = 44;
  const millY = getGroundHeight(millX, millZ);
  const millTower = new THREE.Mesh(pixelCylinder(1.6, 2.2, 7, 8), stoneMat);
  millTower.position.set(millX, millY + 3.5, millZ);
  millTower.castShadow = millTower.receiveShadow = true;
  scene.add(millTower);
  const millCap = new THREE.Mesh(new THREE.ConeGeometry(2.0, 1.6, 8), thatchMat);
  millCap.position.set(millX, millY + 7.8, millZ);
  millCap.castShadow = true;
  scene.add(millCap);
  // крест крыльев, смотрит на север (к деревне)
  const hub = new THREE.Group();
  hub.position.set(millX, millY + 6.2, millZ - 2.1);
  for (let i = 0; i < 4; i++) {
    const blade = new THREE.Mesh(pixelBox(0.5, 3.6, 0.08), woodMat);
    blade.position.y = 1.9;
    const arm = new THREE.Group();
    arm.rotation.z = (i * Math.PI) / 2;
    arm.add(blade);
    hub.add(arm);
  }
  const hubNose = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8), darkWood);
  hubNose.rotation.x = Math.PI / 2;
  hub.add(hubNose);
  scene.add(hub);
  collision.addCircle(millX, millZ, 2.3);

  // домик фермера
  const fhX = 2;
  const fhZ = 46;
  const fhY = getGroundHeight(fhX, fhZ);
  const fh = new THREE.Mesh(pixelBox(3.6, 2.2, 3.2), plasterMat);
  fh.position.set(fhX, fhY + 1.1, fhZ);
  fh.castShadow = fh.receiveShadow = true;
  scene.add(fh);
  const fhRoof = new THREE.Mesh(new THREE.ConeGeometry(3.0, 1.5, 4), thatchMat);
  fhRoof.position.set(fhX, fhY + 2.95, fhZ);
  fhRoof.rotation.y = Math.PI / 4;
  fhRoof.castShadow = true;
  scene.add(fhRoof);
  const fhDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 1.6),
    new THREE.MeshBasicMaterial({ color: 0x0d0906 })
  );
  fhDoor.position.set(fhX, fhY + 0.8, fhZ - 1.62);
  fhDoor.rotation.y = Math.PI;
  scene.add(fhDoor);
  collision.addBox(fhX, fhZ, 3.9, 3.5);

  // грядки
  const soilMat = new THREE.MeshLambertMaterial({ color: 0x2e2118 });
  for (let i = 0; i < 5; i++) {
    const row = new THREE.Mesh(pixelBox(6.5, 0.18, 0.8), soilMat);
    const rx = -4;
    const rz = 40 + i * 1.3;
    row.position.set(rx, getGroundHeight(rx, rz) + 0.09, rz);
    row.receiveShadow = true;
    scene.add(row);
  }
  // пугало
  const scX = -4;
  const scZ = 43.5;
  const scY = getGroundHeight(scX, scZ);
  const scPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.0, 6), darkWood);
  scPole.position.set(scX, scY + 1.0, scZ);
  scene.add(scPole);
  const scArm = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), darkWood);
  scArm.position.set(scX, scY + 1.5, scZ);
  scene.add(scArm);
  const scHead = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), thatchMat);
  scHead.position.set(scX, scY + 1.95, scZ);
  scHead.rotation.y = 0.5;
  scene.add(scHead);
  collision.addCircle(scX, scZ, 0.3);

  // ---------- Осадный лагерь ----------
  const campZ = -40;
  // частокол дугой: выпуклость на север, вход с юга (от замка)
  const stakeGeo = pixelCylinder(0.09, 0.12, 2.6, 6);
  const stakePos: Array<[number, number]> = [];
  for (let i = 0; i <= 20; i++) {
    const a = Math.PI * 0.15 + (i / 20) * Math.PI * 0.7;
    const x = Math.cos(a) * 9;
    const z = campZ - Math.sin(a) * 9 * 0.7 + 2;
    stakePos.push([x, z]);
  }
  const stakes = new THREE.InstancedMesh(stakeGeo, darkWood, stakePos.length);
  const dummy = new THREE.Object3D();
  stakePos.forEach(([x, z], i) => {
    dummy.position.set(x, getGroundHeight(x, z) + 1.0, z);
    dummy.rotation.set(((i * 7) % 10) / 40, 0, ((i * 13) % 10) / 40 - 0.125);
    dummy.updateMatrix();
    stakes.setMatrixAt(i, dummy.matrix);
  });
  stakes.instanceMatrix.needsUpdate = true;
  stakes.castShadow = true;
  scene.add(stakes);
  // частокол твердый (юг открыт — вход), 9 блоков по дуге
  for (let i = 0; i <= 8; i++) {
    const a = Math.PI * 0.15 + (i / 8) * Math.PI * 0.7;
    collision.addBox(Math.cos(a) * 9, campZ - Math.sin(a) * 9 * 0.7 + 2, 2.4, 2.4);
  }
  // катапульта внутри лагеря
  const cat = new THREE.Group();
  const catY = getGroundHeight(0, -42.5);
  cat.position.set(0, catY, -42.5);
  cat.rotation.y = 0.15;
  const frame = new THREE.Mesh(pixelBox(1.6, 0.5, 3.0), woodMat);
  frame.position.y = 0.7;
  frame.castShadow = true;
  cat.add(frame);
  const armMesh = new THREE.Mesh(pixelBox(0.25, 0.25, 3.4), darkWood);
  armMesh.position.set(0, 1.6, -0.4);
  armMesh.rotation.x = -0.7;
  armMesh.castShadow = true;
  cat.add(armMesh);
  for (const sx of [-1.0, 1.0]) {
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.18, 10), darkWood);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx, 0.65, 0.6);
    wheel.castShadow = true;
    cat.add(wheel);
  }
  scene.add(cat);
  collision.addBox(0, -42.5, 2.4, 3.6);
  // палатки-пирамиды внутри
  for (const [tx, tz] of [[-5.5, -42.0], [5.5, -42.0]] as Array<[number, number]>) {
    const tent = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.1, 4), canvasMat);
    tent.position.set(tx, getGroundHeight(tx, tz) + 1.05, tz);
    tent.rotation.y = Math.PI / 4 + tx;
    tent.castShadow = true;
    scene.add(tent);
    collision.addCircle(tx, tz, 1.6);
  }
  // холодное кострище
  const ash = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 0.25, 8), darkMat);
  ash.position.set(0, getGroundHeight(0, -36.5) + 0.12, -36.5);
  scene.add(ash);

  // ---------- Сторожевая башня на плато ----------
  const twX = 48;
  const twZ = -12;
  const twY = getGroundHeight(twX, twZ);
  const tower = new THREE.Mesh(pixelCylinder(1.8, 2.1, 8, 8), stoneMat);
  tower.position.set(twX, twY + 4, twZ);
  tower.castShadow = tower.receiveShadow = true;
  scene.add(tower);
  const platform = new THREE.Mesh(pixelCylinder(2.3, 2.3, 0.4, 8), darkMat);
  platform.position.set(twX, twY + 8.2, twZ);
  platform.castShadow = true;
  scene.add(platform);
  const brazier = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.3, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x2a1c10, emissive: 0xff6a1a, emissiveIntensity: 1.4 })
  );
  brazier.position.set(twX, twY + 8.6, twZ);
  scene.add(brazier);
  // приставная лестница (вид)
  for (let i = 0; i < 6; i++) {
    const rung = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 0.08), darkWood);
    rung.position.set(twX, twY + 1 + i * 1.1, twZ + 2.0 - i * 0.06);
    scene.add(rung);
  }
  for (const sx of [-0.35, 0.35]) {
    const railPole = new THREE.Mesh(new THREE.BoxGeometry(0.08, 7.2, 0.08), darkWood);
    railPole.position.set(twX + sx, twY + 4, twZ + 1.85);
    scene.add(railPole);
  }
  collision.addCircle(twX, twZ, 2.2);

  return {
    update: (_t: number, dt: number) => {
      hub.rotation.z += dt * 0.5; // крылья мельницы
    }
  };
}
