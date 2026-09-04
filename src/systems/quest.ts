import * as THREE from 'three';
import { getGroundHeight } from '../world/ground';
import type { Ruins } from '../world/ruins';

interface Shard {
  pos: THREE.Vector3;
  group: THREE.Group;
  taken: boolean;
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
  update: (dt: number, t: number, playerPos: THREE.Vector3, locked: boolean) => void;
}

/**
 * Фаза 2 — цель игры:
 * найти 5 осколков света → принести к алтарю (E) → портал откроется →
 * войти в портал = победа.
 */
export function createQuest(scene: THREE.Scene, ruins: Ruins, onPickup?: () => void): Quest {
  // Осколки лежат в стороне от тропы — за исследование
  const spots: Array<[number, number, string]> = [
    [-8.6, -4.2, 'дальняя могила'],
    [5.5, 2.5, 'часовня'],
    [-10.5, 34.2, 'за амбаром'],
    [5.5, -6.4, 'южный берег'],
    [3.9, -21.2, 'двор замка']
  ];

  const glowTex = glowTexture();
  const shards: Shard[] = spots.map(([x, z]) => {
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
    return { pos: new THREE.Vector3(x, y, -0), group: grp, taken: false };
  });
  // pos.y не важен — дистанция по XZ
  for (const s of shards) s.pos.y = 0;

  let collected = 0;
  const total = shards.length;
  let portalOpen = false;
  let won = false;
  let started = false;
  let startTime = 0;
  let interactPressed = false;

  const shardsEl = document.getElementById('shards');
  const promptEl = document.getElementById('prompt');
  const endEl = document.getElementById('end');
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
      if (!started) {
        started = true;
        startTime = performance.now();
      }
    },
    update: (dt: number, t: number, pp: THREE.Vector3, locked: boolean) => {
      void dt;
      // анимация осколков
      shards.forEach((s, i) => {
        if (s.taken) return;
        s.group.rotation.y = t * 1.5 + i;
        s.group.position.y = s.group.position.y; // база на земле
        const core = s.group.children[0];
        core.position.y = 1.0 + Math.sin(t * 2 + i * 1.7) * 0.15;
        s.group.children[1].position.y = core.position.y;
      });

      if (!locked || won) {
        if (!locked) interactPressed = false;
        return;
      }

      // --- сбор осколка ---
      let nearShard: Shard | null = null;
      for (const s of shards) {
        if (!s.taken && distXZ(pp, s.group.position.x, s.group.position.z) < 1.6) {
          nearShard = s;
          break;
        }
      }

      // --- алтарь ---
      const nearAltar = distXZ(pp, 0, -18) < 4.6;
      // --- портал ---
      const nearPortal = portalOpen && distXZ(pp, 0, -21.5) < 1.7;

      if (nearPortal) {
        won = true;
        document.exitPointerLock?.();
        document.body.classList.remove('playing');
        document.body.classList.add('won');
        if (endEl && endStatsEl) {
          const secs = (performance.now() - startTime) / 1000;
          endStatsEl.textContent = `Осколки ${collected}/${total} · Время ${fmtTime(secs)}`;
        }
        setPrompt('');
        return;
      }

      if (interactPressed) {
        interactPressed = false;
        if (nearShard) {
          nearShard.taken = true;
          scene.remove(nearShard.group);
          collected++;
          onPickup?.();
          refreshHud();
          setPrompt(collected >= total ? 'Неси их к алтарю во дворе замка' : '');
          return;
        }
        if (nearAltar && collected >= total && !portalOpen) {
          portalOpen = true;
          ruins.setPortalOpen(true);
          setPrompt('Портал открыт. Иди в свет.');
          return;
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
    }
  };
}
