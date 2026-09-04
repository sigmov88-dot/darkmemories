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

export interface ResolveOut {
  x: number;
  z: number;
}

/** Низкое препятствие, на которое можно забраться (обломки, даис, ступени) */
export interface StepVolume {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  top: number;
}

export class CollisionWorld {
  boxes: BoxCollider[] = [];
  circles: CircleCollider[] = [];
  steps: StepVolume[] = [];

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

  /** Ступень: верхняя поверхность, на которую встают (без бокового блока) */
  addStep(cx: number, cz: number, w: number, d: number, top: number): void {
    this.steps.push({
      minX: cx - w / 2,
      maxX: cx + w / 2,
      minZ: cz - d / 2,
      maxZ: cz + d / 2,
      top
    });
  }

  /** Верх ступеней под точкой, иначе -Infinity */
  surfaceTop(x: number, z: number): number {
    let top = -Infinity;
    for (const s of this.steps) {
      if (x >= s.minX && x <= s.maxX && z >= s.minZ && z <= s.maxZ && s.top > top) {
        top = s.top;
      }
    }
    return top;
  }

  /**
   * Пересекает ли отрезок (ax,az)-(bx,bz) какой-либо коллайдер.
   * r — зазор (толщина луча). Для проверок видимости атак и агро.
   */
  segBlocked(ax: number, az: number, bx: number, bz: number, r = 0.3): boolean {
    const dx = bx - ax;
    const dz = bz - az;
    const len2 = dx * dx + dz * dz;
    for (const c of this.circles) {
      let t = len2 > 0 ? ((c.x - ax) * dx + (c.z - az) * dz) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = ax + dx * t - c.x;
      const pz = az + dz * t - c.z;
      const rr = c.r + r;
      if (px * px + pz * pz < rr * rr) return true;
    }
    for (const b of this.boxes) {
      if (segHitsAabb(ax, az, dx, dz, b.minX - r, b.minZ - r, b.maxX + r, b.maxZ + r)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Вытолкнуть круг (px,pz,r) из всех коллайдеров.
   * Результат пишется в out — ноль аллокаций в кадре.
   * Вызывать 2 итерации для углов (внутри).
   */
  resolve(px: number, pz: number, r: number, out: ResolveOut): ResolveOut {
    out.x = px;
    out.z = pz;
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
        if (d2 < rr * rr) {
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            x = c.x + (dx / d) * rr;
            z = c.z + (dz / d) * rr;
          } else {
            // точное попадание в центр — выталкиваем на +X детерминированно
            x = c.x + rr;
            z = c.z;
          }
        }
      }
    }
    out.x = x;
    out.z = z;
    return out;
  }
}

/** Пересечение луча (origin + dir, dir не нормирован) с AABB (slab-метод) */
function segHitsAabb(
  ox: number, oz: number, dx: number, dz: number,
  minX: number, minZ: number, maxX: number, maxZ: number
): boolean {
  let tmin = 0;
  let tmax = 1;
  if (Math.abs(dx) < 1e-9) {
    if (ox < minX || ox > maxX) return false;
  } else {
    let t1 = (minX - ox) / dx;
    let t2 = (maxX - ox) / dx;
    if (t1 > t2) {
      const tt = t1;
      t1 = t2;
      t2 = tt;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (oz < minZ || oz > maxZ) return false;
  } else {
    let t1 = (minZ - oz) / dz;
    let t2 = (maxZ - oz) / dz;
    if (t1 > t2) {
      const tt = t1;
      t1 = t2;
      t2 = tt;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}
