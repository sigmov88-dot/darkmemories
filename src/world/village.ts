import * as THREE from 'three';
import { CollisionWorld } from '../systems/collision';
import { getGroundHeight } from './ground';
import { makePixelWood, makePixelThatch, makePixelPlaster, makePixelDarkStone } from './pixel';
import { pixelBox, pixelCylinder } from './pixel';

/**
 * Деревня Тленка (z +20..+34). Планировка вокруг площади (0,26):
 *
 *        [C]   [D]        — дома северного ряда, двери на площадь
 *     [A]  (площадь+колодец) [B]  — запад/восток, двери к центру
 *        тропа на север ↓ (x=0)
 *   поля запад      поля восток
 */
export function createVillage(scene: THREE.Scene, collision: CollisionWorld): void {
  const woodTex = makePixelWood();
  const thatchTex = makePixelThatch();
  const plasterTex = makePixelPlaster();
  const stoneTex = makePixelDarkStone();

  const woodMat = new THREE.MeshLambertMaterial({ map: woodTex });
  const darkWood = new THREE.MeshLambertMaterial({ color: 0x2a1e12 });
  const thatchMat = new THREE.MeshLambertMaterial({ map: thatchTex });
  const plasterMat = new THREE.MeshLambertMaterial({ map: plasterTex });
  const stoneMat = new THREE.MeshLambertMaterial({ map: stoneTex });
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xffb84d });
  const doorMat = new THREE.MeshBasicMaterial({ color: 0x0d0906 });

  function house(
    cx: number, cz: number, w: number, dpt: number, hgt: number,
    doorSide: 'N' | 'S' | 'E' | 'W'
  ): void {
    const gy = getGroundHeight(cx, cz);
    const g = new THREE.Group();
    g.position.set(cx, gy, cz);
    scene.add(g);

    // стены
    const walls = new THREE.Mesh(pixelBox(w, hgt, dpt), plasterMat);
    walls.position.y = hgt / 2;
    walls.castShadow = walls.receiveShadow = true;
    g.add(walls);
    // угловые балки
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const beam = new THREE.Mesh(pixelBox(0.28, hgt, 0.28), darkWood);
      beam.position.set((sx * w) / 2, hgt / 2, (sz * dpt) / 2);
      beam.castShadow = true;
      g.add(beam);
    }
    // крыша-пирамида со свесом
    const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, dpt) * 0.78, hgt * 0.9, 4), thatchMat);
    roof.position.y = hgt + hgt * 0.45;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    g.add(roof);
    // труба
    const chimney = new THREE.Mesh(pixelBox(0.5, 1.2, 0.5), stoneMat);
    chimney.position.set(w * 0.25, hgt + hgt * 0.5, 0);
    chimney.castShadow = true;
    g.add(chimney);

    // дверь — всегда на стороне, смотрящей к площади/тропе
    const door = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.6), doorMat);
    const off = 0.02;
    if (doorSide === 'E') {
      door.position.set(w / 2 + off, 0.8, 0);
      door.rotation.y = Math.PI / 2;
    } else if (doorSide === 'W') {
      door.position.set(-w / 2 - off, 0.8, 0);
      door.rotation.y = -Math.PI / 2;
    } else if (doorSide === 'S') {
      door.position.set(0, 0.8, dpt / 2 + off);
    } else {
      door.position.set(0, 0.8, -dpt / 2 - off);
    }
    g.add(door);

    // окна с теплым светом — по бокам от двери
    const winGeo = new THREE.PlaneGeometry(0.55, 0.55);
    const winOffsets: Array<[number, number, number]> = doorSide === 'E' || doorSide === 'W'
      ? [[0, 1.5, -1.3], [0, 1.5, 1.3]]
      : [[-1.4, 1.5, 0], [1.4, 1.5, 0]];
    for (const [ox, oy, oz] of winOffsets) {
      const win = new THREE.Mesh(winGeo, glowMat);
      if (doorSide === 'E') {
        win.position.set(w / 2 + off, oy, oz + 0);
        win.rotation.y = Math.PI / 2;
      } else if (doorSide === 'W') {
        win.position.set(-w / 2 - off, oy, oz);
        win.rotation.y = -Math.PI / 2;
      } else if (doorSide === 'S') {
        win.position.set(ox, oy, dpt / 2 + off);
      } else {
        win.position.set(ox, oy, -dpt / 2 - off);
      }
      g.add(win);
      // рама
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.06), darkWood);
      frame.position.copy(win.position);
      frame.rotation.copy(win.rotation);
      frame.position.y -= 0.0;
      g.add(frame);
      win.position.z += doorSide === 'S' ? 0.04 : doorSide === 'N' ? -0.04 : 0;
      win.position.x += doorSide === 'E' ? 0.04 : doorSide === 'W' ? -0.04 : 0;
    }

    collision.addBox(cx, cz, w + 0.3, dpt + 0.3);
  }

  house(-7.5, 26, 4.2, 3.6, 2.4, 'E'); // A запад — дверь к площади
  house(7.5, 25, 4.2, 3.6, 2.4, 'W'); // B восток — дверь к площади
  house(-5.5, 32.5, 3.8, 3.4, 2.2, 'N'); // C юг-запад — дверь к площади
  house(5.5, 32.5, 3.8, 3.4, 2.2, 'N'); // D юг-восток — дверь к площади

  // Амбар у западной околицы
  const barn = new THREE.Group();
  barn.position.set(-10.5, getGroundHeight(-10.5, 31), 31);
  scene.add(barn);
  const barnBody = new THREE.Mesh(pixelBox(3.4, 2.6, 4.4), woodMat);
  barnBody.position.y = 1.3;
  barnBody.castShadow = barnBody.receiveShadow = true;
  barn.add(barnBody);
  const barnRoof = new THREE.Mesh(new THREE.ConeGeometry(3.6, 1.6, 4), thatchMat);
  barnRoof.position.y = 3.4;
  barnRoof.rotation.y = Math.PI / 4;
  barnRoof.castShadow = true;
  barn.add(barnRoof);
  collision.addBox(-10.5, 31, 3.7, 4.7);

  // Колодец на площади (смещен с тропы!)
  const well = new THREE.Group();
  well.position.set(3.4, getGroundHeight(3.4, 28), 28);
  scene.add(well);
  const ring = new THREE.Mesh(pixelCylinder(0.9, 1.0, 0.9, 8), stoneMat);
  ring.position.y = 0.45;
  ring.castShadow = true;
  well.add(ring);
  const wellWater = new THREE.Mesh(
    new THREE.CircleGeometry(0.78, 8),
    new THREE.MeshBasicMaterial({ color: 0x0a1420 })
  );
  wellWater.rotation.x = -Math.PI / 2;
  wellWater.position.y = 0.72;
  well.add(wellWater);
  for (const sx of [-0.8, 0.8]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.7, 0.16), darkWood);
    post.position.set(sx, 1.1, 0);
    well.add(post);
  }
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.3, 0.7, 4), thatchMat);
  canopy.position.y = 2.2;
  canopy.rotation.y = Math.PI / 4;
  well.add(canopy);
  collision.addCircle(3.4, 28, 1.15);

  // Телега у дома B (сдвинута от угла дома D)
  const cart = new THREE.Group();
  cart.position.set(8.8, getGroundHeight(8.8, 28.8), 28.8);
  cart.rotation.y = 0.4;
  scene.add(cart);
  const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 2.4), woodMat);
  bed.position.y = 0.75;
  bed.castShadow = true;
  cart.add(bed);
  for (const sz of [-0.7, 0.7]) {
    for (const sx of [-0.85, 0.85]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 10), darkWood);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(sx, 0.5, sz);
      wheel.castShadow = true;
      cart.add(wheel);
    }
  }
  collision.addBox(8.8, 28.8, 2.0, 2.8);

  // Стога сена на полях
  const hayMat = new THREE.MeshLambertMaterial({ color: 0x8a7134 });
  for (const [hx, hz] of [[-7, 16], [8, 15.5], [-6, 18.5]] as Array<[number, number]>) {
    const hay = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.1, 8), hayMat);
    hay.position.set(hx, getGroundHeight(hx, hz) + 0.55, hz);
    hay.castShadow = true;
    scene.add(hay);
    collision.addCircle(hx, hz, 0.9);
  }

  // Заборы вдоль полей — lines с проемом под тропу |x|<2
  function fenceRun(x0: number, z0: number, x1: number, z1: number): void {
    const dx = x1 - x0;
    const dz = z1 - z0;
    const len = Math.sqrt(dx * dx + dz * dz);
    const n = Math.floor(len / 1.1);
    for (let i = 0; i <= n; i++) {
      const x = x0 + (dx * i) / n;
      const z = z0 + (dz * i) / n;
      if (Math.abs(x) < 2.1 && z > 10 && z < 22) continue; // проем тропы
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.0, 0.14), darkWood);
      post.position.set(x, getGroundHeight(x, z) + 0.5, z);
      post.castShadow = true;
      scene.add(post);
    }
    // перекладина
    const mid = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(dx) || 0.1, 0.1, Math.abs(dz) || 0.1), darkWood);
    mid.position.set((x0 + x1) / 2, getGroundHeight((x0 + x1) / 2, (z0 + z1) / 2) + 0.75, (z0 + z1) / 2);
    scene.add(mid);
    collision.addBox((x0 + x1) / 2, (z0 + z1) / 2, Math.abs(dx) + 0.3, Math.abs(dz) + 0.3);
  }
  fenceRun(-10, 13, -2.2, 13);
  fenceRun(2.2, 13, 10, 13);
  fenceRun(-10, 20, -10, 13.5);
  fenceRun(10, 20, 10, 13.5);
  fenceRun(-10, 20, -2.2, 20);
  fenceRun(2.2, 20, 10, 20);
}
