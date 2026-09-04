/**
 * Простейшие коллизии для FPS: круги + AABB-блоки.
 * Игрок — круг радиуса r на плоскости XZ. Каждый кадр выталкиваем
 * его из всех пересекающихся коллайдеров. Дешево и достаточно для карты.
 */
export interface BoxCollider {
  kind: 'box';
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface CircleCollider {
  kind: 'circle';
  x: number;
  z: number;
  r: number;
}

export type Collider = BoxCollider | CircleCollider;

export class CollisionWorld {
  boxes: BoxCollider[] = [];
  circles: CircleCollider[] = [];

  /** Стена/дом как прямоугольник (центр + размер + опциональный поворот только 0/90) */
  addBox(cx: number, cz: number, w: number, d: number): BoxCollider {
    const b: BoxCollider = {
      kind: 'box',
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2
    };
    this.boxes.push(b);
    return b;
  }

  /** Дерево/колодец/колонна как круг */
  addCircle(x: number, z: number, r: number): CircleCollider {
    const c: CircleCollider = { kind: 'circle', x, z, r };
    this.circles.push(c);
    return c;
  }

  /**
   * Вытолкнуть круг (px,pz,r) из всех коллайдеров.
   * Возвращает исправленную позицию. Вызывать 2 итерации для углов.
   */
  resolve(px: number, pz: number, r: number): { x: number; z: number } {
    let x = px;
    let z = pz;
    for (let iter = 0; iter < 2; iter++) {
      for (const b of this.boxes) {
        const cx = Math.max(b.minX, Math.min(x, b.maxX));
        const cz = Math.max(b.minZ, Math.min(z, b.maxZ));
        let dx = x - cx;
        let dz = z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            x = cx + (dx / d) * r;
            z = cz + (dz / d) * r;
          } else {
            // центр внутри блока — вытолкнуть через ближайшую грань
            const pushL = x - b.minX + r;
            const pushR = b.maxX - x + r;
            const pushD = z - b.minZ + r;
            const pushU = b.maxZ - z + r;
            const m = Math.min(pushL, pushR, pushD, pushU);
            if (m === pushL) x = b.minX - r;
            else if (m === pushR) x = b.maxX + r;
            else if (m === pushD) z = b.minZ - r;
            else z = b.maxZ + r;
          }
        }
      }
      for (const c of this.circles) {
        const dx = x - c.x;
        const dz = z - c.z;
        const rr = r + c.r;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = c.x + (dx / d) * rr;
          z = c.z + (dz / d) * rr;
        }
      }
    }
    return { x, z };
  }
}
