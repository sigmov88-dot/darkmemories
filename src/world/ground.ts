import * as THREE from 'three';
import { makePixelGround, makePixelCobble } from './pixel';

/**
 * Карта v4 — открытый регион (юг → север, запад → восток):
 *
 *   ВОСТОК: скальный кряж (x≈40) + тропа-серпантин на смотровую (38,-8)
 *   ЦЕНТР: деревня → поля → врата → кладбище/часовня → река/мост → замок
 *   ЗАПАД: Черное озеро (центр -50,-2) + остров с руиной + дамба с берега
 *
 * Старая центральная зона не тронута шейпами: новые термы влияют
 * только на |x|>20, поэтому старые тесты проходимости валидны.
 */

export function riverZAt(x: number): number {
  return -11 + Math.sin(x * 0.08) * 2.0;
}

// --- Границы открытого мира (один источник для клампа игрока) ---
export const WORLD = {
  minX: -105, maxX: 105, minZ: -92, maxZ: 92,
  wallR: 100, wallGain: 0.45
} as const;

// --- Северные пики и западный хребет (граница мира, за контентом) ---
export const PEAKS: Array<readonly [number, number, number, number]> = [
  // x, z, высота, радиус
  [-30, -82, 14, 18],
  [20, -88, 18, 20],
  [62, -72, 12, 15],
  [-75, -60, 10, 14]
];

// --- Черное озеро ---
export const LAKE = { x: -50, z: -2, rx: 24, rz: 17, depth: 2.4, waterY: -0.7 };
export const ISLAND = { x: -46, z: -4, r: 7 };
export const CAUSEWAY = { z: -4, x0: -41, x1: -25 };

/** 0 вне эллипса → 1 в центре */
export function lakeNorm(x: number, z: number): number {
  const u = (x - LAKE.x) / LAKE.rx;
  const v = (z - LAKE.z) / LAKE.rz;
  return Math.max(0, 1 - (u * u + v * v));
}

// --- Скальный кряж ---
export function ridgeXAt(z: number): number {
  return 40 + Math.sin(z * 0.1) * 3;
}
/** Серпантин: поля → смотровая */
export const CRAG_PATH: Array<readonly [number, number]> = [
  [18, 12],
  [28, 6],
  [34, -2],
  [38, -8]
];
export const VIEWPOINT = { x: 38, z: -8, h: 2.8 };

function distToSeg(
  px: number, pz: number,
  ax: number, az: number, bx: number, bz: number
): { d: number; t: number } {
  const dx = bx - ax;
  const dz = bz - az;
  const len2 = dx * dx + dz * dz;
  let t = len2 > 0 ? ((px - ax) * dx + (pz - az) * dz) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const qx = ax + dx * t;
  const qz = az + dz * t;
  return { d: Math.hypot(px - qx, pz - qz), t };
}

/** Расстояние до тропы + прогресс 0..1 (для высоты подъема) */
export function cragPathInfo(x: number, z: number): { d: number; prog: number } {
  let best = { d: Infinity, prog: 0 };
  for (let i = 0; i < CRAG_PATH.length - 1; i++) {
    const [ax, az] = CRAG_PATH[i];
    const [bx, bz] = CRAG_PATH[i + 1];
    const r = distToSeg(x, z, ax, az, bx, bz);
    if (r.d < best.d) best = { d: r.d, prog: (i + r.t) / (CRAG_PATH.length - 1) };
  }
  return best;
}

function smooth01(x: number): number {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

/** Высота земли — ЕДИНСТВЕННЫЙ источник правды (меш + физика игрока) */
export function getGroundHeight(x: number, z: number): number {
  // Дамба через озеро (верх досок)
  if (Math.abs(z - CAUSEWAY.z) < 1.7 && x < CAUSEWAY.x1 && x > CAUSEWAY.x0) return 0.35;
  // Мост через реку (верх досок)
  if (Math.abs(x) < 1.7 && z < -7.5 && z > -14.5) return 0.35;

  let h = 0;

  // Русло реки. На востоке сходит на нет к |x|=44 — дальше сухая земля,
  // а не каньон без воды: обход конца реки легален, брод — нет.
  const rz = riverZAt(x);
  const dRiver = Math.abs(z - rz);
  if (dRiver < 3.4) {
    const k = Math.cos((dRiver / 3.4) * (Math.PI / 2));
    const taper = 1 - smooth01((Math.abs(x) - 36) / 8);
    h -= 1.35 * k * k * taper;
  }

  // Озерная котловина (не действует на островной купол)
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  const islandMask = 1 - smooth01((di - 3) / 4); // 1 внутри r3 → 0 снаружи r7
  const ln = lakeNorm(x, z);
  if (ln > 0) h -= LAKE.depth * ln * ln * (1 - islandMask);
  // Купол острова
  h += islandMask * 1.4;

  // Холм замка
  if (z < -14) {
    h += Math.min((-14 - z) * 0.09, 1.3);
  }

  // Скальный кряж: плато на востоке
  const rx = ridgeXAt(z);
  if (x > rx - 2) {
    h += 7 * smooth01((x - (rx - 2)) / 7);
  }
  // Серпантин врезан в склон
  const cp = cragPathInfo(x, z);
  if (cp.d < 4) {
    const target = 0.2 + cp.prog * 2.6;
    h = target + (h - target) * smooth01((cp.d - 2.2) / 1.8);
  }
  // Площадка смотровой
  const dv = Math.hypot(x - VIEWPOINT.x, z - VIEWPOINT.z);
  if (dv < 5.5) {
    h = VIEWPOINT.h + (h - VIEWPOINT.h) * smooth01((dv - 3.5) / 2);
  }

  // Северные пики и западный хребет
  for (const [px, pz, ph, pr] of PEAKS) {
    const d = Math.hypot(x - px, z - pz);
    if (d < pr * 2.2) {
      const k = d / pr;
      h += ph * Math.exp(-k * k);
    }
  }

  // Вал по краю мира (далеко, старые зоны не задевает)
  const d = Math.sqrt(x * x + (z + 2) * (z + 2));
  if (d > WORLD.wallR) h += (d - WORLD.wallR) * WORLD.wallGain;

  return h;
}

export function createGround(scene: THREE.Scene): void {
  const geo = new THREE.PlaneGeometry(320, 300, 228, 214);
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
  // Ответвления: к дамбе (запад) и серпантин (восток, плотно по сегментам)
  for (let x = -2; x >= -25; x -= 0.72) {
    positions.push([x, -4 + Math.sin(x * 0.5) * 0.15]);
  }
  for (let s = 0; s < CRAG_PATH.length - 1; s++) {
    const [ax, az] = CRAG_PATH[s];
    const [bx, bz] = CRAG_PATH[s + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(2, Math.floor(len / 0.72));
    for (let i = 0; i <= n; i++) {
      positions.push([ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n]);
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

  // --- Площади повторяют рельеф ---
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
