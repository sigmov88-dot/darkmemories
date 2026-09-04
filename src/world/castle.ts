import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight } from './ground';
import { makePixelStone, makePixelDarkStone } from './pixel';

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
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x080604 });

  const g = new THREE.Group();
  scene.add(g);

  function wall(cx: number, cz: number, w: number, h: number, d: number, dark = false): void {
    const gy = getGroundHeight(cx, cz);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), dark ? darkMat : stoneMat);
    m.position.set(cx, gy + h / 2, cz);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    // зубцы
    const n = Math.floor(Math.max(w, d) / 1.1);
    for (let i = 0; i <= n; i++) {
      const t = n === 0 ? 0.5 : i / n;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), dark ? stoneMat : darkMat);
      if (w >= d) merlon.position.set(cx - w / 2 + t * w, gy + h + 0.25, cz);
      else merlon.position.set(cx, gy + h + 0.25, cz - d / 2 + t * d);
      merlon.castShadow = true;
      g.add(merlon);
    }
    collision.addBox(cx, cz, w + 0.2, d + 0.2);
  }

  function tower(cx: number, cz: number, h = 7): void {
    const gy = getGroundHeight(cx, cz);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, h, 8), stoneMat);
    t.position.set(cx, gy + h / 2, cz);
    t.castShadow = t.receiveShadow = true;
    g.add(t);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.5, 0.8, 8), darkMat);
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
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.0, 4.6, 1.2), darkMat);
    p.position.set(sx, gy + 2.3, -13);
    p.castShadow = true;
    g.add(p);
    collision.addBox(sx, -13, 1.1, 1.3);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.9, 1.3), darkMat);
  lintel.position.set(0, getGroundHeight(0, -13) + 4.85, -13);
  lintel.castShadow = true;
  g.add(lintel);

  // Боковые стены двора
  wall(-6, -18.5, 1.1, 3.2, 11);
  wall(6, -18.5, 1.1, 3.2, 11);

  // Башни
  tower(-6, -13);
  tower(6, -13);
  tower(-6, -24);
  tower(6, -24);

  // Донжон за порталом
  const keepZ = -27.5;
  const keepGy = getGroundHeight(0, keepZ);
  const keep = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 5), stoneMat);
  keep.position.set(0, keepGy + 3.5, keepZ);
  keep.castShadow = keep.receiveShadow = true;
  g.add(keep);
  // зубцы донжона
  for (let i = 0; i < 6; i++) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), darkMat);
    m.position.set(-3.75 + i * 1.5, keepGy + 7.35, keepZ + 2.4);
    g.add(m);
  }
  // дверь донжона (темный провал) + ступени
  const door = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.6), doorMat);
  door.position.set(0, keepGy + 1.3, keepZ + 2.53);
  g.add(door);
  const steps = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.3, 1.4), darkMat);
  steps.position.set(0, keepGy + 0.15, keepZ + 3.2);
  steps.receiveShadow = true;
  g.add(steps);
  // окна-бойницы с тусклым светом
  const slitMat = new THREE.MeshBasicMaterial({ color: 0x3a5a9a });
  for (const sx of [-2.5, 2.5]) {
    const slit = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 1.0), slitMat);
    slit.position.set(sx, keepGy + 4.5, keepZ + 2.53);
    g.add(slit);
  }
  collision.addBox(0, keepZ, 9.2, 5.2);
}
