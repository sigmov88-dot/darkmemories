import * as THREE from 'three';

/** Все пиксель-текстуры: Nearest, без мипмапов, low-res canvas */

export function toPixel(tex: THREE.CanvasTexture, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
  tex.magFilter = THREE.NearestFilter;
  // Мипмапы с Nearest-семплированием: близко — четкие пиксели,
  // вдали — без мерцания и «рванины»
  tex.minFilter = THREE.NearestMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Плотность текстуры: 1 тайл на TILE метров — одинаково на всех стенах */
export const PIXEL_TILE = 1.25;

/**
 * Box с UV под реальный размер: кирпичи везде одного масштаба,
 * а не тянутся на всю стену. Материал можно шарить.
 */
export function pixelBox(w: number, h: number, d: number, tile = PIXEL_TILE): THREE.BoxGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  // порядок граней: +x, -x, +y, -y, +z, -z; по 4 вершины
  const dims: Array<[number, number]> = [
    [d, h], [d, h], [w, d], [w, d], [w, h], [w, h]
  ];
  for (let f = 0; f < 6; f++) {
    const [su, sv] = dims[f];
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * su) / tile, (uv.getY(i) * sv) / tile);
    }
  }
  return g;
}

/** Цилиндр с UV под реальный размер (башни, колонны, колодцы) */
export function pixelCylinder(
  rt: number, rb: number, h: number, seg = 8, tile = PIXEL_TILE, open = false
): THREE.CylinderGeometry {
  const g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open);
  const uv = g.attributes.uv as THREE.BufferAttribute;
  const circ = Math.PI * (rt + rb);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (uv.getX(i) * circ) / tile, (uv.getY(i) * h) / tile);
  }
  return g;
}

function cv(s: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  return [c, c.getContext('2d')!];
}

// deterministic pseudo-random чтобы карта не менялась каждый рефреш
let _s = 1337;
export function srand(seed: number): void {
  _s = seed;
}
function rnd(): number {
  _s = (_s * 16807) % 2147483647;
  return (_s - 1) / 2147483646;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)];
}

/** Земля: темный мох + грязь, палитра 5 цветов, 64px */
export function makePixelGround(): THREE.CanvasTexture {
  srand(1337);
  const [c, ctx] = cv(64);
  const base = ['#1a1f2b', '#1e2431', '#161b26', '#222839'];
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      ctx.fillStyle = pick(base);
      ctx.fillRect(x, y, 1, 1);
    }
  }
  // вкрапления мха и костей
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = pick(['#2c3a2a', '#31402e', '#3d4a33', '#4a4a3a']);
    ctx.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 1, 1);
  }
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = '#0d0f16';
    ctx.fillRect(Math.floor(rnd() * 64), Math.floor(rnd() * 64), 2, 1);
  }
  return toPixel(new THREE.CanvasTexture(c), 96, 88);
}

/** Камень руин: кирпичи 32px */
export function makePixelStone(): THREE.CanvasTexture {
  srand(42);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#4a4f5e';
  ctx.fillRect(0, 0, 32, 32);
  // ряды кирпичей
  for (let row = 0; row < 4; row++) {
    const y = row * 8;
    ctx.fillStyle = '#2c2f3a';
    ctx.fillRect(0, y + 7, 32, 1);
    for (let x = (row % 2) * 8; x < 32; x += 16) {
      ctx.fillRect(x, y, 1, 8);
    }
  }
  // шум
  for (let i = 0; i < 130; i++) {
    ctx.fillStyle = pick(['#565b6c', '#3e434f', '#60667a', '#343845']);
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1);
  }
  // мох снизу
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = pick(['#2e4429', '#3a5230']);
    ctx.fillRect(Math.floor(rnd() * 32), 24 + Math.floor(rnd() * 8), 2, 1);
  }
  return toPixel(new THREE.CanvasTexture(c), 1, 1);
}

/** Темный камень (пилоны, алтарь) */
export function makePixelDarkStone(): THREE.CanvasTexture {
  srand(7);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#2e323e';
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 150; i++) {
    ctx.fillStyle = pick(['#363b48', '#272b35', '#3f4452']);
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1);
  }
  // трещина
  ctx.fillStyle = '#14161d';
  let x = 6;
  for (let y = 0; y < 32; y += 2) {
    ctx.fillRect(x, y, 1, 2);
    x += Math.floor(rnd() * 3) - 1;
  }
  return toPixel(new THREE.CanvasTexture(c), 1, 1);
}

/** Булыжник тропы 32px */
export function makePixelCobble(): THREE.CanvasTexture {
  srand(99);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#1c1e26';
  ctx.fillRect(0, 0, 32, 32);
  const stones = ['#4d4438', '#57493a', '#453d33', '#5e5142'];
  for (let by = 0; by < 4; by++) {
    for (let bx = 0; bx < 4; bx++) {
      const x = bx * 8 + (by % 2) * 2;
      const y = by * 8;
      ctx.fillStyle = stones[(bx + by) % stones.length];
      ctx.fillRect(x + 1, y + 1, 6, 6);
      ctx.fillStyle = 'rgba(255,230,180,0.16)';
      ctx.fillRect(x + 1, y + 1, 6, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x + 1, y + 6, 6, 1);
    }
  }
  return toPixel(new THREE.CanvasTexture(c), 2, 16);
}

/** Кора мертвого дерева 16px */
export function makePixelBark(): THREE.CanvasTexture {
  srand(5);
  const [c, ctx] = cv(16);
  ctx.fillStyle = '#241c14';
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pick(['#2e2418', '#1a140e', '#3a2d1e']);
    ctx.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 2);
  }
  return toPixel(new THREE.CanvasTexture(c), 1, 1);
}

/** Трава-пучок 16x16 со сквозным фоном */
export function makePixelGrass(): THREE.CanvasTexture {
  const [c, ctx] = cv(16);
  ctx.clearRect(0, 0, 16, 16);
  const greens = ['#2e4429', '#3a5230', '#46582f'];
  for (let i = 0; i < 9; i++) {
    const x = 2 + i;
    const h = 4 + ((i * 7) % 6);
    ctx.fillStyle = greens[i % 3];
    ctx.fillRect(x, 16 - h, 1, h);
    ctx.fillStyle = '#1c2a1a';
    ctx.fillRect(x, 16 - h, 1, 1);
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Крест могилы 16x16 */
export function makePixelGrave(): THREE.CanvasTexture {
  const [c, ctx] = cv(16);
  ctx.fillStyle = '#3d414e';
  ctx.fillRect(0, 0, 16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      if ((x + y * 3) % 9 === 0) {
        ctx.fillStyle = '#333743';
        ctx.fillRect(x, y, 1, 1);
      }
    }
  ctx.fillStyle = '#14161d';
  ctx.fillRect(0, 15, 16, 1);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Пиксельное пламя 16x16, кадры сдвигом палитры */
export function makePixelFlame(): THREE.CanvasTexture {
  const [c, ctx] = cv(16);
  ctx.clearRect(0, 0, 16, 16);
  // ядро
  ctx.fillStyle = '#ffedb0';
  ctx.fillRect(7, 10, 2, 4);
  ctx.fillRect(6, 9, 4, 2);
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(6, 8, 4, 3);
  ctx.fillRect(5, 6, 6, 3);
  ctx.fillStyle = '#c33d0e';
  ctx.fillRect(5, 5, 6, 2);
  ctx.fillRect(4, 7, 8, 2);
  ctx.fillStyle = '#7a1e05';
  ctx.fillRect(4, 9, 1, 3);
  ctx.fillRect(11, 9, 1, 3);
  // язык
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(7, 2, 2, 4);
  ctx.fillStyle = '#ffedb0';
  ctx.fillRect(7, 3, 1, 2);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Мягкое вертикальное свечение-спрайт (порталы, маяки). Без жестких краев. */
export function makeGlowSprite(color: string, w: number, h: number): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 34, 2, 16, 34, 30);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 64);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: t, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false
    })
  );
  s.scale.set(w, h, 1);
  return s;
}

/** Руна на алтаре 32x32 */
export function makePixelRune(): THREE.CanvasTexture {
  const [c, ctx] = cv(32);
  ctx.clearRect(0, 0, 32, 32);
  ctx.strokeStyle = '#ff7a26';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, 24, 24);
  ctx.beginPath();
  ctx.moveTo(16, 4);
  ctx.lineTo(16, 28);
  ctx.moveTo(4, 16);
  ctx.lineTo(28, 16);
  ctx.stroke();
  ctx.fillStyle = '#ffd9a0';
  ctx.fillRect(15, 15, 2, 2);
  ctx.fillRect(7, 7, 2, 2);
  ctx.fillRect(23, 7, 2, 2);
  ctx.fillRect(7, 23, 2, 2);
  ctx.fillRect(23, 23, 2, 2);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Дерево досок 32px — дома, мост, заборы */
export function makePixelWood(): THREE.CanvasTexture {
  srand(11);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#4a3421';
  ctx.fillRect(0, 0, 32, 32);
  for (let p = 0; p < 4; p++) {
    const y = p * 8;
    ctx.fillStyle = '#2e1f12';
    ctx.fillRect(0, y + 7, 32, 1);
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = pick(['#5a4229', '#3e2c1b', '#6b5136']);
      ctx.fillRect(Math.floor(rnd() * 32), y + Math.floor(rnd() * 7), 2, 1);
    }
  }
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, 1, 32);
  return toPixel(new THREE.CanvasTexture(c), 1, 1);
}

/** Солома крыши 32px */
export function makePixelThatch(): THREE.CanvasTexture {
  srand(21);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#5e4a26';
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = pick(['#6f5a30', '#4d3d20', '#7d683a', '#3e3018']);
    const x = Math.floor(rnd() * 32);
    const y = Math.floor(rnd() * 32);
    ctx.fillRect(x, y, 1, 2);
  }
  for (let y = 6; y < 32; y += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, y, 32, 1);
  }
  return toPixel(new THREE.CanvasTexture(c), 1, 1);
}

/** Штукатурка стен деревни 32px */
export function makePixelPlaster(): THREE.CanvasTexture {
  srand(31);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#6b6252';
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = pick(['#746b59', '#5e5648', '#7d7462']);
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 1, 1);
  }
  // подтеки снизу
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = '#4a4438';
    ctx.fillRect(Math.floor(rnd() * 32), 26 + Math.floor(rnd() * 6), 1, 2);
  }
  return toPixel(new THREE.CanvasTexture(c), 1, 1);
}

/** Вода 32px — тайлится, анимируется сдвигом offset */
export function makePixelWater(): THREE.CanvasTexture {
  srand(55);
  const [c, ctx] = cv(32);
  ctx.fillStyle = '#16283e';
  ctx.fillRect(0, 0, 32, 32);
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = pick(['#1d3550', '#122033', '#24445f']);
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 2, 1);
  }
  // блики
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = '#7fb8d8';
    ctx.fillRect(Math.floor(rnd() * 32), Math.floor(rnd() * 32), 2, 1);
  }
  return toPixel(new THREE.CanvasTexture(c), 8, 2);
}

/** Песок/ил берега 16px */
export function makePixelSand(): THREE.CanvasTexture {
  srand(77);
  const [c, ctx] = cv(16);
  ctx.fillStyle = '#4a4132';
  ctx.fillRect(0, 0, 16, 16);
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pick(['#57493a', '#3e362a', '#63553f']);
    ctx.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
  }
  return toPixel(new THREE.CanvasTexture(c), 12, 2);
}
