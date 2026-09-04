import * as THREE from 'three';
import { getGroundHeight } from '../world/ground';
import type { Ruins } from '../world/ruins';

interface Shard {
  group: THREE.Group;
  taken: boolean;
}

/** Позиции осколков [x, z, подсказка]. Единый источник правды и для тестов. */
export const SHARD_SPOTS: ReadonlyArray<readonly [number, number, string]> = [
  [-8.6, -4.2, 'дальняя могила'],
  [5.5, 2.5, 'часовня'],
  [-10.5, 34.2, 'за амбаром'],
  [9.5, -3.0, 'за часовней'],
  [3.9, -21.2, 'двор замка']
];

export const ALTAR_POS = { x: 0, z: -18, interactR: 4.6 } as const;
export const PORTAL_POS = { x: 0, z: -21.5, triggerR: 1.7 } as const;
export const SHARD_TAKE_R = 1.6;

/** Румб от вектора (dx, dz): север — это -z. Чистая функция, покрыта тестом. */
export function compassTo(dx: number, dz: number): string {
  const points = [
    'севере', 'северо-востоке', 'востоке', 'юго-востоке',
    'юге', 'юго-западе', 'западе', 'северо-западе'
  ];
  let deg = (Math.atan2(dx, -dz) * 180) / Math.PI;
  deg = ((deg % 360) + 360) % 360;
  return points[Math.floor((deg + 22.5) / 45) % 8];
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 1, 16, 16, 16);
  g.addColorStop(0, 'rgba(180,230,255,1)');
  g.addColorStop(0.4, 'rgba(120,180,255,0.5)');
  g.addColorStop(1, 'rgba(120,180,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface Quest {
  start: () => void;
  /** Возвращает true в кадре победы. Состояниями владеет GameState. */
  update: (dt: number, t: number, playerPos: THREE.Vector3, active: boolean) => boolean;
  collectedCount: () => number;
  totalCount: () => number;
  isPortalOpen: () => boolean;
  elapsedActive: () => number;
}

/**
 * Цель игры: 5 осколков → алтарь (E) → портал → победа.
 * Таймер копит только активное игровое время (паузы/свернутое окно не в счет).
 */
export function createQuest(scene: THREE.Scene, ruins: Ruins, onPickup?: () => void): Quest {
  const glowTex = glowTexture();
  const shards: Shard[] = SHARD_SPOTS.map(([x, z]) => {
    const y = getGroundHeight(x, z);
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.22),
      new THREE.MeshBasicMaterial({ color: 0xbfe6ff })
    );
    core.position.y = 1.0;
    grp.add(core);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTex, transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0.8
      })
    );
    halo.scale.set(1.4, 1.4, 1);
    halo.position.y = 1.0;
    grp.add(halo);
    scene.add(grp);
    return { group: grp, taken: false };
  });

  let collected = 0;
  const total = shards.length;
  let portalOpen = false;
  let won = false;
  let started = false;
  let elapsed = 0;
  let interactPressed = false;

  const shardsEl = document.getElementById('shards');
  const promptEl = document.getElementById('prompt');
  const endStatsEl = document.getElementById('end-stats');
  const againBtn = document.getElementById('again');

  window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') interactPressed = true;
  });
  againBtn?.addEventListener('click', () => window.location.reload());

  const setPrompt = (text: string): void => {
    if (!promptEl) return;
    promptEl.textContent = text;
    promptEl.style.opacity = text ? '1' : '0';
  };
  const refreshHud = (): void => {
    if (shardsEl) {
      shardsEl.textContent = `◆ ${collected}/${total}`;
      shardsEl.classList.remove('flash');
      void shardsEl.offsetWidth; // перезапуск анимации
      shardsEl.classList.add('flash');
    }
  };
  refreshHud();

  const fmtTime = (s: number): string => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${ss.toString().padStart(2, '0')}`;
  };

  function distXZ(a: THREE.Vector3, x: number, z: number): number {
    const dx = a.x - x;
    const dz = a.z - z;
    return Math.sqrt(dx * dx + dz * dz);
  }

  return {
    start: () => {
      started = true;
    },
    collectedCount: () => collected,
    totalCount: () => total,
    isPortalOpen: () => portalOpen,
    elapsedActive: () => elapsed,
    update: (dt, t, pp, active) => {
      // анимация осколков
      shards.forEach((s, i) => {
        if (s.taken) return;
        s.group.rotation.y = t * 1.5 + i;
        const core = s.group.children[0];
        core.position.y = 1.0 + Math.sin(t * 2 + i * 1.7) * 0.15;
        s.group.children[1].position.y = core.position.y;
      });

      if (!active || won) {
        if (!active) interactPressed = false;
        return false;
      }
      if (started) elapsed += dt;

      // --- сбор осколка ---
      let nearShard: Shard | null = null;
      for (const s of shards) {
        if (!s.taken && distXZ(pp, s.group.position.x, s.group.position.z) < SHARD_TAKE_R) {
          nearShard = s;
          break;
        }
      }

      const nearAltar = distXZ(pp, ALTAR_POS.x, ALTAR_POS.z) < ALTAR_POS.interactR;
      const nearPortal = portalOpen && distXZ(pp, PORTAL_POS.x, PORTAL_POS.z) < PORTAL_POS.triggerR;

      if (nearPortal) {
        won = true;
        if (endStatsEl) {
          endStatsEl.textContent = `Осколки ${collected}/${total} · Время ${fmtTime(elapsed)}`;
        }
        setPrompt('');
        return true;
      }

      if (interactPressed) {
        interactPressed = false;
        if (nearShard) {
          nearShard.taken = true;
          scene.remove(nearShard.group);
          collected++;
          onPickup?.();
          refreshHud();
          if (collected >= total) {
            setPrompt('Неси их к алтарю во дворе замка');
          } else {
            // подсказка-компас до ближайшего оставшегося
            let bx = 0;
            let bz = 0;
            let bd = Infinity;
            for (const s of shards) {
              if (s.taken) continue;
              const d = distXZ(pp, s.group.position.x, s.group.position.z);
              if (d < bd) {
                bd = d;
                bx = s.group.position.x;
                bz = s.group.position.z;
              }
            }
            setPrompt(`Следующий осколок — на ${compassTo(bx - pp.x, bz - pp.z)}`);
          }
          return false;
        }
        if (nearAltar && collected >= total && !portalOpen) {
          portalOpen = true;
          ruins.setPortalOpen(true);
          setPrompt('Портал открыт. Иди в свет.');
          return false;
        }
      }

      // подсказки
      if (nearShard) setPrompt('E — взять осколок света');
      else if (nearAltar && !portalOpen) {
        setPrompt(
          collected >= total
            ? 'E — возложить осколки на алтарь'
            : `Алтарь ждет ${total - collected} оск. (ищи в стороне от тропы)`
        );
      } else if (nearAltar && portalOpen) setPrompt('Портал открыт. Иди в свет.');
      else setPrompt('');
      return false;
    }
  };
}
