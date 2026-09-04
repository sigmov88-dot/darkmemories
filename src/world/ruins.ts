import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight } from './ground';
import { makePixelStone, makePixelDarkStone, makePixelGrave, makePixelRune, makeGlowSprite } from './pixel';
import { pixelBox, pixelCylinder } from './pixel';
import { ALTAR_POS, PORTAL_POS } from './landmarks';

export interface Ruins {
  altarPos: THREE.Vector3;
  portalPos: THREE.Vector3;
  setPortalOpen: (open: boolean) => void;
  update: (t: number) => void;
}

/**
 * Средняя зона (z +8..-6): врата, колоннада, кладбище, часовня.
 * Алтарь и портал — во дворе замка (z -16..-19.5).
 * Каждый твердый объект регистрирует коллайдер.
 * Все хелперы — замыкания внутри createRuins: функция реентерабельна.
 */
export function createRuins(scene: THREE.Scene, col: CollisionWorld): Ruins {
  const collision = col;
  const stoneMat = new THREE.MeshLambertMaterial({ map: makePixelStone() });
  const darkMat = new THREE.MeshLambertMaterial({ map: makePixelDarkStone() });
  const graveTex = makePixelGrave();

  const g = new THREE.Group();
  scene.add(g);
  let portalOpen = false;

  function block(
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    ry = 0, dark = false, tilt = 0, solid = false
  ): THREE.Mesh {
    const m = new THREE.Mesh(pixelBox(w, h, d), dark ? darkMat : stoneMat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.rotation.z = tilt;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    if (solid && Math.abs(ry) < 0.01) collision.addBox(x, z, w + 0.15, d + 0.15);
    return m;
  }

  function column(x: number, z: number, full: boolean): void {
    const gy = getGroundHeight(x, z);
    const base = new THREE.Mesh(pixelBox(1.2, 0.5, 1.2), darkMat);
    base.position.set(x, gy + 0.25, z);
    base.castShadow = base.receiveShadow = true;
    g.add(base);
    const n = full ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const seg = new THREE.Mesh(pixelCylinder(0.42, 0.48, 1.3, 8), stoneMat);
      seg.position.set(x, gy + 0.5 + 0.65 + i * 1.3, z);
      if (!full && i === n - 1) seg.rotation.z = 0.14;
      seg.castShadow = seg.receiveShadow = true;
      g.add(seg);
    }
    collision.addCircle(x, z, 0.75);
  }

  function grave(x: number, z: number, ry: number): void {
    const gy = getGroundHeight(x, z);
    const mound = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 1.9), darkMat);
    mound.position.set(x, gy + 0.15, z);
    mound.rotation.y = ry;
    mound.castShadow = mound.receiveShadow = true;
    g.add(mound);
    const slab = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 1.0, 0.18),
      new THREE.MeshLambertMaterial({ map: graveTex })
    );
    slab.position.set(x - Math.sin(ry) * 1.0, gy + 0.6, z - Math.cos(ry) * 1.0);
    slab.rotation.y = ry;
    slab.rotation.x = -0.12;
    slab.castShadow = true;
    g.add(slab);
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), darkMat);
    v.position.set(x + 0.4, gy + 0.55, z + 0.3);
    v.rotation.z = 0.08;
    v.castShadow = true;
    g.add(v);
    const hbar = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, 0.14), darkMat);
    hbar.position.set(x + 0.4, gy + 0.8, z + 0.3);
    hbar.rotation.z = 0.08;
    g.add(hbar);
    collision.addCircle(x, z, 0.9);
  }

  // --- Арка входа (z=8) ---
  column(-2.2, 8, true);
  column(2.2, 8, true);
  block(6.0, 0.9, 1.2, 0, 5.35, 8, 0, true);
  block(1.4, 0.7, 1.0, 3.4, 4.6, 8.2, 0.5, false, 0.2);

  // --- Колоннада вдоль тропы ---
  column(-2.8, 3, true);
  column(2.8, 3, false);
  column(-3.0, -2.5, false);
  column(3.0, -2.5, true);
  column(-3.2, -6.5, true);
  column(3.2, -6.5, false);

  // --- Кладбище слева (за сломанным забором) ---
  grave(-6.5, 4.5, 0.3);
  grave(-8.2, 2.2, -0.2);
  grave(-6.2, 0.0, 0.5);
  grave(-8.6, -2.6, 0.1);
  grave(-6.4, -5.0, -0.4);
  grave(-9.0, -6.8, 0.35);
  for (let i = 0; i < 7; i++) {
    const fx = -4.6 - i * 0.85;
    const fz = 6.2 - i * 1.9;
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.1 + (i % 2) * 0.15, 0.16), darkMat);
    f.position.set(fx, getGroundHeight(fx, fz) + 0.5, fz);
    f.rotation.z = i % 3 === 0 ? 0.14 : -0.06;
    f.castShadow = true;
    g.add(f);
  }
  // Перекладина строго вдоль линии столбов (была поперек — «кривой забор»)
  const railDir = new THREE.Vector2(-5.1, -11.5);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, railDir.length()), darkMat);
  rail.position.set(-7.15, 0.8, 0.45);
  rail.rotation.y = Math.atan2(railDir.x, railDir.y);
  g.add(rail);

  // --- Часовня справа: П-образные стены, вход с запада (от тропы) ---
  block(0.9, 3.4, 7.0, 7.6, 1.7, 2.5, 0, false, 0, true); // восточная
  block(6.5, 2.6, 0.9, 5.0, 1.3, -1.0, 0, false, 0, true); // северная
  block(6.0, 3.8, 0.9, 5.2, 1.9, 5.8, 0, true, 0, true); // южная
  const winHole = new THREE.Mesh(
    new THREE.BoxGeometry(0.95, 1.6, 0.5),
    new THREE.MeshBasicMaterial({ color: 0x05060c })
  );
  winHole.position.set(7.6, 2.2, 2.5);
  g.add(winHole);
  block(1.2, 0.8, 1.0, 4.2, 0.4, 2.2, 0.7, true);
  block(0.9, 0.6, 0.9, 5.6, 0.3, 3.4, 1.2, false);

  // колодец часовни: закрытое кольцо + темная вода внутри
  const well = new THREE.Mesh(pixelCylinder(1.0, 1.1, 0.9, 10), stoneMat);
  well.position.set(6.0, 0.45, -5.5);
  well.castShadow = well.receiveShadow = true;
  g.add(well);
  const wellWater = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 10),
    new THREE.MeshBasicMaterial({ color: 0x0a1420 })
  );
  wellWater.rotation.x = -Math.PI / 2;
  wellWater.position.set(6.0, 0.72, -5.5);
  g.add(wellWater);
  block(0.18, 1.8, 0.18, 5.2, 1.2, -5.5, 0, true);
  block(0.18, 1.8, 0.18, 6.8, 1.2, -5.5, 0, true);
  block(2.0, 0.18, 0.4, 6.0, 2.05, -5.5, 0, true, 0.06);
  collision.addCircle(6.0, -5.5, 1.15);

  // --- Обломки у краев тропы (не на проходе!) ---
  const rubbleSpots: Array<[number, number, number]> = [
    [-2.6, 5.5, 0.8], [2.8, 5.2, 0.5], [-3.6, 0.5, 1.0],
    [3.8, -1.5, 0.7], [-2.8, -4.5, 0.6], [4.4, 1.0, 0.55]
  ];
  for (const [rx, rz, s] of rubbleSpots) {
    const rgy = getGroundHeight(rx, rz);
    block(s, s * 0.6, s, rx, rgy + s * 0.25, rz, rx * 1.7, (rx + rz) % 2 === 0);
    // обломки низкие — на них запрыгивают, а не бьются лбом
    collision.addStep(rx, rz, s, s, rgy + s * 0.55);
  }

  // --- Алтарь во дворе замка ---
  const altarPos = new THREE.Vector3(0, 0, ALTAR_POS.z);
  const agy = getGroundHeight(0, ALTAR_POS.z);
  const dais = new THREE.Mesh(pixelCylinder(3.2, 3.6, 0.5, 12), darkMat);
  dais.position.set(0, agy + 0.25, ALTAR_POS.z);
  dais.receiveShadow = dais.castShadow = true;
  g.add(dais);

  const altar = new THREE.Mesh(pixelBox(1.6, 1.1, 0.9), stoneMat);
  altar.position.set(0, agy + 0.5 + 0.55, ALTAR_POS.z);
  altar.castShadow = altar.receiveShadow = true;
  g.add(altar);

  const runeTex = makePixelRune();
  const runeMat = new THREE.MeshBasicMaterial({
    map: runeTex,
    transparent: true,
    color: 0xff8a2a
  });
  const rune = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), runeMat);
  rune.rotation.x = -Math.PI / 2;
  rune.position.set(0, agy + 0.52, ALTAR_POS.z);
  g.add(rune);
  // Коллайдер только вокруг самого алтаря; даис — ступень, на него встают
  collision.addStep(0, ALTAR_POS.z, 6.4, 6.4, agy + 0.5);
  collision.addBox(0, ALTAR_POS.z, 1.9, 1.2);

  // --- Портал-врата: до ритуала видна только темная арка ---
  const pgy = getGroundHeight(0, PORTAL_POS.z);
  const portalMat = new THREE.MeshBasicMaterial({ color: 0x0a0d16, fog: false });
  const portal = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.8), portalMat);
  portal.position.set(0, pgy + 2.4, PORTAL_POS.z);
  g.add(portal);
  // Мягкое свечение без жестких краев (бывший плоский прямоугольник)
  const glow = makeGlowSprite('rgba(70,110,220,1)', 5, 7);
  const glowMat = glow.material as THREE.SpriteMaterial;
  glowMat.opacity = 0.22; // до ритуала — едва тлеет
  glow.position.set(0, pgy + 2.8, -21.6);
  g.add(glow);

  block(1.0, 5.2, 1.0, -1.9, pgy + 2.6, PORTAL_POS.z, 0, true, 0, true);
  block(1.0, 5.2, 1.0, 1.9, pgy + 2.6, PORTAL_POS.z, 0, true, 0, true);
  block(4.8, 0.8, 1.1, 0, pgy + 5.4, PORTAL_POS.z, 0, true);

  return {
    altarPos,
    portalPos: new THREE.Vector3(0, pgy, PORTAL_POS.z),
    setPortalOpen: (open: boolean) => {
      portalOpen = open;
      if (open) {
        portalMat.color.setHex(0x7dffc8);
        glowMat.color.setHex(0x1a8a5a);
        glowMat.opacity = 0.55;
        runeMat.color.setHex(0x7dffc8);
      }
    },
    update: (t: number) => {
      if (portalOpen) {
        // открытый портал дышит ярче, руна горит ровно
        const b = 0.85 + Math.sin(t * 5) * 0.15;
        portalMat.color.setRGB(0.49 * b + 0.2, 1.0 * b, 0.78 * b);
        glowMat.opacity = 0.5 + Math.sin(t * 5) * 0.1;
        return;
      }
      // закрыт: пульсирует только руна, портал темен
      const step = Math.floor(t * 4) % 4;
      const k = [1.0, 0.75, 1.0, 0.6][step];
      runeMat.color.setRGB(1.0 * k, 0.54 * k, 0.16 * k);
    }
  };
}
