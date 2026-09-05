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

  // Предмостный форт на южном берегу: ворота по оси моста, коридор |x|<2.5
  tower(-3.5, -6, 6);
  tower(3.5, -6, 6);
  const foreLintel = new THREE.Mesh(pixelBox(8.6, 0.9, 1.2), darkMat);
  foreLintel.position.set(0, getGroundHeight(0, -6) + 5.6, -6);
  foreLintel.castShadow = true;
  g.add(foreLintel);
  wall(-5.4, -6, 3.2, 4, 1.0, true);
  wall(5.4, -6, 3.2, 4, 1.0, true);

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

  // Боковые стены двора начинаются СЕВЕРНЕЕ реки (z=-18):
  // южный конец не должен смыкаться с береговой цепью — иначе лабиринт
  // из допусков. Проем z -16..-18 ведет в боковые цвингеры.
  // Берег у моста открыт — западный обход к осаде легален.
  wall(-6, -21, 1.1, 3.2, 6);
  wall(6, -21, 1.1, 3.2, 6);

  // Башни
  tower(-6, -13);
  tower(6, -13);
  tower(-6, -24);
  tower(6, -24);

  // Внешнее кольцо: цвингер между стенами. Река с юга служит рвом,
  // поэтому южной стены нет — только боковые, поперечные и угловые башни.
  wall(-12, -20, 1.1, 4, 12);
  wall(12, -20, 1.1, 4, 12);
  wall(-8.5, -25, 7.4, 3.6, 1.1);
  wall(8.5, -25, 7.4, 3.6, 1.1);
  tower(-12, -14, 8);
  tower(12, -14, 8);
  tower(-12, -26, 8);
  tower(12, -26, 8);

  // Третье кольцо: наружный вал. Вход только с юга через предмостный форт
  // и по верху — патрульный обход между стенами свободен.
  wall(-20, -24, 1.2, 4.5, 20);
  wall(20, -24, 1.2, 4.5, 20);
  wall(-16.2, -33, 8.4, 4, 1.2);
  wall(16.2, -33, 8.4, 4, 1.2);
  tower(-20, -14, 9);
  tower(20, -14, 9);
  tower(-20, -34, 9);
  tower(20, -34, 9);

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
  // стены: юг из двух сегментов (проем двери), остальные цельные.
  // Донжон высокий (7м) — доминанта центра карты, видно отовсюду.
  const wallH = 7;
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
  // перемычка над дверью + окно + кладка выше проема (иначе дыра в фасаде)
  const doorLintel = new THREE.Mesh(pixelBox(3.2, 0.8, 1.1), darkMat);
  doorLintel.position.set(0, floorY + 3.0, -25);
  g.add(doorLintel);
  const doorTop = new THREE.Mesh(pixelBox(2.2, 3.6, 1.0), stoneMat);
  doorTop.position.set(0, floorY + 5.2, -25);
  doorTop.castShadow = true;
  g.add(doorTop);
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
  // угловые башенки на крыше — силуэт донжона
  for (const [tx, tz] of [[-4.2, -25.3], [4.2, -25.3], [-4.2, -29.7], [4.2, -29.7]] as Array<[number, number]>) {
    const tur = new THREE.Mesh(pixelCylinder(0.9, 1.0, 2.2, 8), stoneMat);
    tur.position.set(tx, parY + 1.1, tz);
    tur.castShadow = true;
    g.add(tur);
    const turCap = new THREE.Mesh(new THREE.ConeGeometry(1.2, 1.0, 8), darkMat);
    turCap.position.set(tx, parY + 2.7, tz);
    g.add(turCap);
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
  // перила только визуальные (на высоте 4м): коллайдеров нет,
  // иначе невидимая стена перегораживает двор на уровне земли.
  // Упасть с балкона можно — урона от падения нет.
  const railY = slabTop + 0.45;
  const railS = new THREE.Mesh(pixelBox(8.6, 0.9, 0.15), darkMat);
  railS.position.set(-0.2, railY, -23.3);
  railS.castShadow = true;
  g.add(railS);
  const railW = new THREE.Mesh(pixelBox(0.15, 0.9, 1.8), darkMat);
  railW.position.set(-4.4, railY, -24.1);
  g.add(railW);
  const railE = new THREE.Mesh(pixelBox(0.15, 0.9, 1.1), darkMat);
  railE.position.set(5.3, railY, -24.55);
  g.add(railE);

  // ================= ОБЖИТЫЙ ЗАМОК =================
  const coalMat = new THREE.MeshStandardMaterial({
    color: 0x2a1c10, emissive: 0xff6a1a, emissiveIntensity: 1.6, roughness: 0.8
  });
  const darkWoodLike = new THREE.MeshLambertMaterial({ color: 0x2e2114 });
  const woodMatLike = new THREE.MeshLambertMaterial({ color: 0x4a3421 });
  const steelLike = new THREE.MeshLambertMaterial({ color: 0x9aa2b0 });
  const soilLike = new THREE.MeshLambertMaterial({ color: 0x2e2118 });
  const strawMat = new THREE.MeshLambertMaterial({ color: 0x8a7134 });

  // --- Надвратный проход: полуподнятая решетка + бойницы в потолке ---
  for (let i = -2; i <= 2; i++) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.4, 0.09), darkMat);
    bar.position.set(i * 0.55, gateGy + 3.4, -13);
    g.add(bar);
  }
  for (let i = 0; i < 3; i++) {
    const cross = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.09, 0.09), darkMat);
    cross.position.set(0, gateGy + 2.6 + i * 0.8, -13);
    g.add(cross);
  }
  for (const mx of [-1.2, 0, 1.2]) {
    const hole = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x020304 })
    );
    hole.rotation.x = Math.PI / 2;
    hole.position.set(mx, gateGy + 4.28, -13);
    g.add(hole);
  }
  // жаровни у предмостного форта (свет только emissive)
  for (const sx of [-5.6, 5.6]) {
    const bgy = getGroundHeight(sx, -4.2);
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.25, 0.4, 8), darkMat);
    bowl.position.set(sx, bgy + 0.7, -4.2);
    bowl.castShadow = true;
    g.add(bowl);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.55), coalMat);
    coals.position.set(sx, bgy + 0.95, -4.2);
    g.add(coals);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 6), darkMat);
    pole.position.set(sx, bgy + 0.35, -4.2);
    g.add(pole);
    collision.addCircle(sx, -4.2, 0.45);
  }

  // --- Двор: тренировочная площадка ---
  function dummy(dx: number, dz: number): void {
    const gy = getGroundHeight(dx, dz);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.6, 7), darkWoodLike);
    post.position.set(dx, gy + 0.8, dz);
    post.castShadow = true;
    g.add(post);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.1, 0.1), darkWoodLike);
    arm.position.set(dx, gy + 1.25, dz);
    arm.rotation.y = dx;
    g.add(arm);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), strawMat);
    head.position.set(dx, gy + 1.75, dz);
    head.rotation.y = dx * 2;
    head.castShadow = true;
    g.add(head);
    collision.addCircle(dx, dz, 0.35);
  }
  dummy(-4, -15);
  dummy(-4, -16.6);
  // стойка оружия у западной стены (ось двери свободна)
  {
    const rx = -4.6;
    const rz = -20;
    const ry = getGroundHeight(rx, rz);
    for (const px of [-0.5, 0.5]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.3, 0.12), darkWoodLike);
      post.position.set(rx + px, ry + 0.65, rz);
      post.castShadow = true;
      g.add(post);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.1), darkWoodLike);
    bar.position.set(rx, ry + 1.2, rz);
    g.add(bar);
    for (let i = -1; i <= 1; i++) {
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.03), steelLike);
      sword.position.set(rx + i * 0.35, ry + 0.75, rz + 0.12);
      sword.rotation.x = -0.25;
      g.add(sword);
    }
    collision.addBox(rx, rz, 1.3, 0.5);
  }
  // знамена на стенах двора, лицом внутрь
  for (const [bx, bz, ry] of [[-5.38, -19, Math.PI / 2], [-5.38, -22.5, Math.PI / 2], [5.38, -19, -Math.PI / 2], [5.38, -22.5, -Math.PI / 2]] as Array<[number, number, number]>) {
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 1.8), bannerMat);
    ban.position.set(bx, getGroundHeight(bx, bz) + 2.2, bz);
    ban.rotation.y = ry;
    g.add(ban);
  }

  // --- Кузница (западный цвингер, вход с юга) ---
  {
    const kx = -9;
    const kz = -19;
    const ky = getGroundHeight(kx, kz);
    const back = new THREE.Mesh(pixelBox(5, 2.6, 0.8), stoneMat);
    back.position.set(kx, ky + 1.3, kz - 2.1);
    back.castShadow = back.receiveShadow = true;
    g.add(back);
    collision.addBox(kx, kz - 2.1, 5.2, 1.0);
    const roof = new THREE.Mesh(pixelBox(5.4, 0.15, 4.6), darkWoodLike);
    roof.position.set(kx, ky + 2.75, kz - 0.6);
    roof.rotation.x = 0.16;
    roof.castShadow = true;
    g.add(roof);
    for (const [px, pz] of [[-11, -17.2], [-7, -17.2]] as Array<[number, number]>) {
      const post = new THREE.Mesh(pixelBox(0.18, 2.6, 0.18), darkWoodLike);
      post.position.set(px, getGroundHeight(px, pz) + 1.3, pz);
      post.castShadow = true;
      g.add(post);
      // без коллайдера: тонкие стойки, проход под навес свободен
    }
    const forge = new THREE.Mesh(pixelBox(1.2, 0.9, 1.2), stoneMat);
    forge.position.set(kx - 1, ky + 0.45, kz - 1);
    forge.castShadow = true;
    g.add(forge);
    const coals = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.15, 0.9), coalMat);
    coals.position.set(kx - 1, ky + 0.95, kz - 1);
    g.add(coals);
    collision.addBox(kx - 1, kz - 1, 1.4, 1.4);
    const anvilBase = new THREE.Mesh(pixelBox(0.4, 0.5, 0.4), darkMat);
    anvilBase.position.set(kx + 0.6, ky + 0.25, kz - 0.5);
    g.add(anvilBase);
    const anvilTop = new THREE.Mesh(pixelBox(0.9, 0.25, 0.4), steelLike);
    anvilTop.position.set(kx + 0.6, ky + 0.6, kz - 0.5);
    anvilTop.castShadow = true;
    g.add(anvilTop);
    collision.addCircle(kx + 0.6, kz - 0.5, 0.45);
    const quench = new THREE.Mesh(pixelCylinder(0.35, 0.3, 0.8, 8), darkWoodLike);
    quench.position.set(kx + 1.4, ky + 0.4, kz - 1.6);
    g.add(quench);
    collision.addCircle(kx + 1.4, kz - 1.6, 0.45);
  }

  // --- Конюшня (восточный цвингер, вход с юга) ---
  {
    const kx = 9;
    const kz = -19;
    const ky = getGroundHeight(kx, kz);
    const back = new THREE.Mesh(pixelBox(5, 2.2, 0.8), woodMatLike);
    back.position.set(kx, ky + 1.1, kz - 2.1);
    back.castShadow = back.receiveShadow = true;
    g.add(back);
    collision.addBox(kx, kz - 2.1, 5.2, 1.0);
    const roof = new THREE.Mesh(pixelBox(5.4, 0.15, 4.6), darkWoodLike);
    roof.position.set(kx, ky + 2.45, kz - 0.6);
    roof.rotation.x = 0.16;
    roof.castShadow = true;
    g.add(roof);
    for (const [px, pz] of [[7, -17.2], [11, -17.2]] as Array<[number, number]>) {
      const post = new THREE.Mesh(pixelBox(0.18, 2.3, 0.18), darkWoodLike);
      post.position.set(px, getGroundHeight(px, pz) + 1.15, pz);
      post.castShadow = true;
      g.add(post);
      // без коллайдера: тонкие стойки, проход свободен
    }
    // денники-перегородки
    for (const dx of [-1.2, 1.2]) {
      const div = new THREE.Mesh(pixelBox(0.14, 1.1, 2.0), woodMatLike);
      div.position.set(kx + dx, ky + 0.55, kz - 1);
      div.castShadow = true;
      g.add(div);
      collision.addBox(kx + dx, kz - 1, 0.3, 2.0);
    }
    // сено и поилка
    const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.6, 0.9, 8), strawMat);
    hay.position.set(kx - 1.6, ky + 0.45, kz - 0.4);
    hay.castShadow = true;
    g.add(hay);
    collision.addCircle(kx - 1.6, kz - 0.4, 0.7);
    const trough = new THREE.Mesh(pixelBox(1.4, 0.4, 0.5), darkWoodLike);
    trough.position.set(kx + 1.6, ky + 0.2, kz - 0.2);
    g.add(trough);
    collision.addBox(kx + 1.6, kz - 0.2, 1.5, 0.6);
  }

  // --- Западный сад и восточные дрова (внешний цвингер) ---
  for (let i = 0; i < 3; i++) {
    const bed = new THREE.Mesh(pixelBox(2.6, 0.18, 0.9), soilLike);
    const bx = -16;
    const bz = -21 + i * 1.6;
    bed.position.set(bx, getGroundHeight(bx, bz) + 0.09, bz);
    bed.receiveShadow = true;
    g.add(bed);
  }
  for (const [hx, hz] of [[-17.5, -17.5], [-14.5, -17.5]] as Array<[number, number]>) {
    const hive = new THREE.Mesh(pixelBox(0.55, 0.7, 0.55), strawMat);
    hive.position.set(hx, getGroundHeight(hx, hz) + 0.35, hz);
    hive.castShadow = true;
    g.add(hive);
    collision.addCircle(hx, hz, 0.4);
  }
  // поленница пирамидой + колода с топором
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 5 - row; i++) {
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.1, 7), darkWoodLike);
      log.rotation.z = Math.PI / 2;
      log.position.set(16 + i * 0.3 + row * 0.15, getGroundHeight(16, -19) + 0.15 + row * 0.26, -19);
      log.castShadow = true;
      g.add(log);
    }
  }
  collision.addBox(16, -19, 2.0, 1.2);
  const chopBlock = new THREE.Mesh(pixelCylinder(0.3, 0.33, 0.5, 8), darkWoodLike);
  chopBlock.position.set(17.8, getGroundHeight(17.8, -19) + 0.25, -19);
  chopBlock.castShadow = true;
  g.add(chopBlock);
  collision.addCircle(17.8, -19, 0.4);
  const axeHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), darkWoodLike);
  axeHandle.position.set(17.8, getGroundHeight(17.8, -19) + 0.8, -19);
  axeHandle.rotation.z = 0.3;
  g.add(axeHandle);
  const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.04), steelLike);
  axeHead.position.set(17.95, getGroundHeight(17.8, -19) + 1.1, -19);
  g.add(axeHead);

  // --- Донжон: пиршественный стол, припасы, люстра ---
  const table = new THREE.Mesh(pixelBox(2.2, 0.12, 1.0), woodMatLike);
  table.position.set(2.2, floorY + 0.75, -26.3);
  table.castShadow = true;
  g.add(table);
  for (const [lx, lz] of [[1.3, -26.6], [3.1, -26.6], [1.3, -26.0], [3.1, -26.0]] as Array<[number, number]>) {
    const leg = new THREE.Mesh(pixelBox(0.12, 0.75, 0.12), darkWoodLike);
    leg.position.set(lx, floorY + 0.37, lz);
    g.add(leg);
  }
  for (const bz of [-25.6, -27.0]) {
    const bench = new THREE.Mesh(pixelBox(1.8, 0.35, 0.3), darkWoodLike);
    bench.position.set(2.2, floorY + 0.17, bz);
    g.add(bench);
  }
  collision.addBox(2.2, -26.3, 2.4, 1.2);
  // ящики с припасами — на них запрыгивают
  const crateSpots: Array<[number, number, number]> = [
    [-2.8, -27.3, 0], [-2.1, -27.3, 0], [-2.45, -27.3, 0.55]
  ];
  for (const [cx, cz, lift] of crateSpots) {
    const crate = new THREE.Mesh(pixelBox(0.55, 0.55, 0.55), woodMatLike);
    crate.position.set(cx, floorY + 0.28 + lift, cz);
    crate.rotation.y = cx;
    crate.castShadow = true;
    g.add(crate);
    collision.addStep(cx, cz, 0.55, 0.55, floorY + 0.55 + lift);
  }
  // бочки в юго-западном углу зала
  for (const [bx, bz] of [[-3.0, -29.0], [-2.3, -29.0]] as Array<[number, number]>) {
    const barrel = new THREE.Mesh(pixelCylinder(0.32, 0.36, 0.9, 8), woodMatLike);
    barrel.position.set(bx, floorY + 0.45, bz);
    barrel.castShadow = true;
    g.add(barrel);
    collision.addCircle(bx, bz, 0.45);
  }
  // люстра-кольцо со свечами над залом
  const chand = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.07, 6, 14), darkMat);
  chand.rotation.x = Math.PI / 2;
  chand.position.set(0, floorY + 3.4, -27.3);
  g.add(chand);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const candle = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.22, 0.09),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 })
    );
    candle.position.set(Math.cos(a) * 0.7, floorY + 3.55, -27.3 + Math.sin(a) * 0.7);
    g.add(candle);
  }
  const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.4, 5), darkMat);
  chain.position.set(0, floorY + 5.1, -27.3);
  g.add(chain);
  // знамена на боковых стенах зала
  for (const [bx, ry] of [[-3.54, Math.PI / 2], [3.54, -Math.PI / 2]] as Array<[number, number]>) {
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 2.0), bannerMat);
    ban.position.set(bx, floorY + 2.6, -27.3);
    ban.rotation.y = ry;
    g.add(ban);
  }
}
