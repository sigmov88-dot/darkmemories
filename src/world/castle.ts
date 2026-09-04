import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight } from './ground';
import { makePixelStone, makePixelDarkStone } from './pixel';
import { pixelBox, pixelCylinder } from './pixel';

/**
 * Замок Воронья Пасть — двор вокруг алтаря:
 *
 *        [башня]  ДОНЖОН  [башня]      z -24..-29
 *           [башня] портал [башня]     z -24
 *           |  алтарь (0,-18)  |       z -18  ← двор
 *        западная стена  восточная
 *           [башня] ВОРОТА [башня]     z -13  ← вход с моста
 */
export function createCastle(scene: THREE.Scene, collision: CollisionWorld): void {
  const stoneMat = new THREE.MeshLambertMaterial({ map: makePixelStone() });
  const darkMat = new THREE.MeshLambertMaterial({ map: makePixelDarkStone() });
  const bannerMat = new THREE.MeshLambertMaterial({ color: 0x6e1a1a, side: THREE.DoubleSide });

  const g = new THREE.Group();
  scene.add(g);

  function wall(cx: number, cz: number, w: number, h: number, d: number, dark = false): void {
    const gy = getGroundHeight(cx, cz);
    const m = new THREE.Mesh(pixelBox(w, h, d), dark ? darkMat : stoneMat);
    m.position.set(cx, gy + h / 2, cz);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    // зубцы
    const n = Math.floor(Math.max(w, d) / 1.1);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i / n;
      const merlon = new THREE.Mesh(pixelBox(0.5, 0.5, 0.5), dark ? stoneMat : darkMat);
      if (w >= d) merlon.position.set(cx - w / 2 + t * w, gy + h + 0.25, cz);
      else merlon.position.set(cx, gy + h + 0.25, cz - d / 2 + t * d);
      merlon.castShadow = true;
      g.add(merlon);
    }
    collision.addBox(cx, cz, w + 0.2, d + 0.2);
  }

  function tower(cx: number, cz: number, h = 7): void {
    const gy = getGroundHeight(cx, cz);
    const t = new THREE.Mesh(pixelCylinder(1.5, 1.7, h, 8), stoneMat);
    t.position.set(cx, gy + h / 2, cz);
    t.castShadow = t.receiveShadow = true;
    g.add(t);
    const cap = new THREE.Mesh(pixelCylinder(1.8, 1.5, 0.8, 8), darkMat);
    cap.position.set(cx, gy + h + 0.4, cz);
    cap.castShadow = true;
    g.add(cap);
    // знамя
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.6), bannerMat);
    banner.position.set(cx, gy + h - 1.2, cz + 1.65);
    g.add(banner);
    collision.addCircle(cx, cz, 1.85);
  }

  // Южная стена с воротами (проем |x|<1.8)
  wall(-4.1, -13, 4.6, 3.4, 1.1, true);
  wall(4.1, -13, 4.6, 3.4, 1.1, true);
  // пилоны ворот
  for (const sx of [-2.3, 2.3]) {
    const gy = getGroundHeight(sx, -13);
    const p = new THREE.Mesh(pixelBox(1.0, 4.6, 1.2), darkMat);
    p.position.set(sx, gy + 2.3, -13);
    p.castShadow = true;
    g.add(p);
    collision.addBox(sx, -13, 1.1, 1.3);
  }
  const lintel = new THREE.Mesh(pixelBox(5.6, 0.9, 1.3), darkMat);
  lintel.position.set(0, getGroundHeight(0, -13) + 4.85, -13);
  lintel.castShadow = true;
  g.add(lintel);

  // Надвратный проход: боковые стены + потолок, коридор |x|<2.6
  const gateGy = getGroundHeight(0, -13);
  for (const sx of [-2.95, 2.95]) {
    const w = new THREE.Mesh(pixelBox(0.7, 4.9, 3.4), darkMat);
    w.position.set(sx, gateGy + 2.45, -13);
    w.castShadow = w.receiveShadow = true;
    g.add(w);
    collision.addBox(sx, -13, 0.9, 3.6);
    // бойницы-щели внутрь прохода
    for (const sz of [-12.2, -13.8]) {
      const slit = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.9, 0.3),
        new THREE.MeshBasicMaterial({ color: 0x05060c })
      );
      slit.position.set(sx + (sx < 0 ? 0.36 : -0.36), gateGy + 2.8, sz);
      g.add(slit);
    }
  }
  const ceiling = new THREE.Mesh(pixelBox(6.6, 0.5, 3.4), darkMat);
  ceiling.position.set(0, gateGy + 4.55, -13);
  ceiling.castShadow = true;
  g.add(ceiling);

  // Боковые стены двора
  wall(-6, -18.5, 1.1, 3.2, 11);
  wall(6, -18.5, 1.1, 3.2, 11);

  // Башни
  tower(-6, -13);
  tower(6, -13);
  tower(-6, -24);
  tower(6, -24);

  // Донжон: полый, с залом, троном и крышей. Вход с юга (|x|<1.1).
  const keepZ = -27.5;
  const keepGy = getGroundHeight(0, keepZ);
  const floorY = keepGy + 0.35;
  // пол + порог-ступень
  const floor = new THREE.Mesh(pixelBox(9.2, 0.3, 5.2), darkMat);
  floor.position.set(0, floorY - 0.15, keepZ);
  floor.receiveShadow = true;
  g.add(floor);
  collision.addStep(0, keepZ, 8.6, 4.6, floorY);
  // стены: юг из двух сегментов (проем двери), остальные цельные
  const wallH = 5.5;
  const wallY = floorY - 0.2 + wallH / 2;
  const keepWalls: Array<[number, number, number, number]> = [
    [-2.8, -25, 3.4, 1.0], [2.8, -25, 3.4, 1.0], // юг с проемом
    [0, -30, 9.2, 1.0], // север
    [-4.1, -27.5, 1.0, 5.0], [4.1, -27.5, 1.0, 5.0] // бока
  ];
  for (const [wx, wz, ww, wd] of keepWalls) {
    const m = new THREE.Mesh(pixelBox(ww, wallH, wd), stoneMat);
    m.position.set(wx, wallY, wz);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    collision.addBox(wx, wz, ww + 0.15, wd + 0.15);
  }
  // перемычка над дверью + окно
  const doorLintel = new THREE.Mesh(pixelBox(3.2, 0.8, 1.1), darkMat);
  doorLintel.position.set(0, floorY + 3.0, -25);
  g.add(doorLintel);
  const doorSlit = new THREE.Mesh(
    new THREE.PlaneGeometry(0.4, 1.0),
    new THREE.MeshBasicMaterial({ color: 0x3a5a9a })
  );
  doorSlit.position.set(0, floorY + 4.2, -24.48);
  g.add(doorSlit);
  // крыша + парапет
  const roof = new THREE.Mesh(pixelBox(9.4, 0.5, 5.4), darkMat);
  roof.position.set(0, floorY + wallH - 0.2 + 0.25, keepZ);
  roof.castShadow = true;
  g.add(roof);
  const parY = floorY + wallH + 0.15;
  const parapets: Array<[number, number, number, number]> = [
    [0, -24.9, 9.4, 0.3], [0, -30.1, 9.4, 0.3],
    [-4.55, -27.5, 0.3, 5.5], [4.55, -27.5, 0.3, 5.5]
  ];
  for (const [px, pz, pw, pd] of parapets) {
    const m = new THREE.Mesh(pixelBox(pw, 0.9, pd), stoneMat);
    m.position.set(px, parY, pz);
    g.add(m);
  }
  // интерьер: колонны, трон, ковер, жаровни (свет только emissive)
  for (const [px, pz] of [[-2.2, -26.6], [2.2, -26.6], [-2.2, -28.4], [2.2, -28.4]] as Array<[number, number]>) {
    const pil = new THREE.Mesh(pixelCylinder(0.32, 0.38, wallH - 0.4, 8), stoneMat);
    pil.position.set(px, floorY + (wallH - 0.4) / 2, pz);
    pil.castShadow = true;
    g.add(pil);
    collision.addCircle(px, pz, 0.5);
  }
  const throne = new THREE.Mesh(pixelBox(1.3, 0.7, 0.9), darkMat);
  throne.position.set(0, floorY + 0.35, -29.2);
  throne.castShadow = true;
  g.add(throne);
  const throneBack = new THREE.Mesh(pixelBox(1.3, 1.7, 0.3), darkMat);
  throneBack.position.set(0, floorY + 0.85, -29.55);
  g.add(throneBack);
  collision.addBox(0, -29.3, 1.5, 1.0);
  const throneBanner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.0), bannerMat);
  throneBanner.position.set(0, floorY + 2.6, -29.44);
  g.add(throneBanner);
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 3.6),
    new THREE.MeshLambertMaterial({ color: 0x4a1620 })
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, floorY + 0.02, -27.2);
  carpet.receiveShadow = true;
  g.add(carpet);
  const brazMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c10, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.8
  });
  for (const sx of [-3.1, 3.1]) {
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.25, 0.5, 8), darkMat);
    bowl.position.set(sx, floorY + 0.25, -26.0);
    bowl.castShadow = true;
    g.add(bowl);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.18, 0.55), brazMat);
    coals.position.set(sx, floorY + 0.55, -26.0);
    g.add(coals);
    collision.addCircle(sx, -26.0, 0.55);
  }

  // Балкон на южном фасаде + лестница вдоль восточной стены двора.
  // Первая ступень +0.35 (влезает в лимит шага 0.6), дальше по +0.35.
  const stairX = 4.8;
  const stairBase = getGroundHeight(stairX, -15.5);
  const NSTEPS = 9;
  const RISE = 0.35;
  for (let i = 0; i < NSTEPS; i++) {
    const sz = -15.95 - i * 0.89;
    const top = stairBase + RISE * (i + 1);
    const step = new THREE.Mesh(pixelBox(1.2, 0.18, 0.95), stoneMat);
    step.position.set(stairX, top - 0.09, sz);
    step.castShadow = step.receiveShadow = true;
    g.add(step);
    collision.addStep(stairX, sz, 1.2, 0.95, top);
  }
  const slabTop = stairBase + RISE * NSTEPS;
  const slab = new THREE.Mesh(pixelBox(9.9, 0.3, 1.8), stoneMat);
  slab.position.set(0.45, slabTop - 0.15, -24.1);
  slab.castShadow = slab.receiveShadow = true;
  g.add(slab);
  collision.addStep(0.45, -24.1, 9.9, 1.8, slabTop);
  // кронштейны под балконом
  for (const cx of [-3.5, 0.45, 4.0]) {
    const corbel = new THREE.Mesh(pixelBox(0.5, 0.7, 0.5), darkMat);
    corbel.position.set(cx, slabTop - 0.65, -23.5);
    g.add(corbel);
  }
  // перила: юг с проемом под лестницу, запад и восток
  const railY = slabTop + 0.45;
  const railS = new THREE.Mesh(pixelBox(8.6, 0.9, 0.15), darkMat);
  railS.position.set(-0.2, railY, -23.3);
  railS.castShadow = true;
  g.add(railS);
  collision.addBox(-0.2, -23.3, 8.6, 0.3);
  const railW = new THREE.Mesh(pixelBox(0.15, 0.9, 1.8), darkMat);
  railW.position.set(-4.4, railY, -24.1);
  g.add(railW);
  collision.addBox(-4.4, -24.1, 0.3, 1.8);
  const railE = new THREE.Mesh(pixelBox(0.15, 0.9, 1.1), darkMat);
  railE.position.set(5.3, railY, -24.55);
  g.add(railE);
  collision.addBox(5.3, -24.55, 0.3, 1.1);
}
