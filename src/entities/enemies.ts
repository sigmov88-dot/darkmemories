import * as THREE from 'three';
import { CollisionWorld, ResolveOut } from '../systems/collision';
import { getGroundHeight } from '../world/ground';

// общий буфер для коллизий — ноль аллокаций в кадре
const resolveOut: ResolveOut = { x: 0, z: 0 };

export interface PlayerAttack {
  active: boolean;
  id: number;
  dmg: number;
  range: number;
  pos: THREE.Vector3;
  dir: THREE.Vector3;
}

export type EnemyKind = 'wraith' | 'goblin' | 'slime';

interface EnemyStats {
  hp: number;
  speed: number;
  aggroR: number;
  windup: number;
  idleEye: number;
  aggroEye: number;
  scale: number;
}

const STATS: Record<EnemyKind, EnemyStats> = {
  // страж: средний во всем, держит осколки и проходы
  wraith: { hp: 3, speed: 3.1, aggroR: 9, windup: 0.4, idleEye: 0x881508, aggroEye: 0xff5a1a, scale: 1 },
  // гоблин: быстрый, хилый, видит далеко — леса и лагерь
  goblin: { hp: 2, speed: 4.2, aggroR: 11, windup: 0.3, idleEye: 0x6a6a08, aggroEye: 0xffe94a, scale: 0.85 },
  // слизень: медленный танк у воды — меч валит за 2 удара, факел за 4
  slime: { hp: 4, speed: 2.3, aggroR: 7, windup: 0.55, idleEye: 0xd8e8d8, aggroEye: 0xaaffaa, scale: 1.15 }
};

interface Enemy {
  kind: EnemyKind;
  stats: EnemyStats;
  home: THREE.Vector3;
  pos: THREE.Vector3;
  group: THREE.Group;
  bodyMat: THREE.MeshLambertMaterial;
  eyeMat: THREE.MeshBasicMaterial;
  hp: number;
  maxHp: number;
  state: 'idle' | 'chase' | 'dead';
  attackCd: number;
  attackWindup: number;
  flash: number;
  deathT: number;
  bobPhase: number;
  active: boolean;
  lastHitId: number;
  baseScale: number;
}

const DEAGGRO_R = 16;
const ATTACK_R = 1.8;
const ENEMY_R = 0.5;

/** Пиксельный гоблин: зеленый, уши-лопасти, желтые глаза. Быстрый и наглый. */
function buildGoblin(): { group: THREE.Group; bodyMat: THREE.MeshLambertMaterial; eyeMat: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x3d5a24,
    emissive: 0x0d1a08,
    emissiveIntensity: 0.8
  });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), bodyMat);
  torso.position.y = 0.65;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.36, 0.36), bodyMat);
  head.position.y = 1.12;
  head.castShadow = true;
  group.add(head);
  for (const sx of [-0.32, 0.32]) {
    const ear = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.08), bodyMat);
    ear.position.set(sx, 1.16, 0);
    group.add(ear);
  }
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.4, 0.14), bodyMat);
    leg.position.set(sx, 0.2, 0);
    group.add(leg);
  }
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffe94a });
  const eyeGeo = new THREE.PlaneGeometry(0.09, 0.07);
  for (const sx of [-0.1, 0.1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx, 1.14, 0.19);
    group.add(eye);
  }
  return { group, bodyMat, eyeMat };
}

/** Пиксельный слизень: два куба слизи с ядром. Прыгает, а не ходит. */
function buildSlime(): { group: THREE.Group; bodyMat: THREE.MeshLambertMaterial; eyeMat: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x3a7a3a,
    emissive: 0x0d2a0d,
    emissiveIntensity: 0.9,
    transparent: true,
    opacity: 0.92
  });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.42, 0.85), bodyMat);
  bottom.position.y = 0.21;
  bottom.castShadow = true;
  group.add(bottom);
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.38, 0.58), bodyMat);
  top.position.y = 0.6;
  top.castShadow = true;
  group.add(top);
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.2, 0.2, 0.1),
    new THREE.MeshBasicMaterial({ color: 0xd8ff8a })
  );
  core.position.set(0, 0.55, 0.32);
  group.add(core);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xd8e8d8 });
  const eyeGeo = new THREE.PlaneGeometry(0.1, 0.12);
  for (const sx of [-0.16, 0.16]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx, 0.72, 0.3);
    group.add(eye);
  }
  return { group, bodyMat, eyeMat };
}

/** Пиксельная тень-стражник: рваный плащ, красные глаза */
function buildWraith(): { group: THREE.Group; bodyMat: THREE.MeshLambertMaterial; eyeMat: THREE.MeshBasicMaterial } {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({
    color: 0x11141f,
    emissive: 0x150a24,
    emissiveIntensity: 0.8
  });
  const cloak = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.7, 6), bodyMat);
  cloak.position.y = 0.85;
  cloak.castShadow = true;
  group.add(cloak);

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.42, 0.45), bodyMat);
  head.position.y = 1.75;
  head.castShadow = true;
  group.add(head);

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const eyeGeo = new THREE.PlaneGeometry(0.1, 0.08);
  for (const sx of [-0.12, 0.12]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    eye.position.set(sx, 1.78, 0.24);
    group.add(eye);
  }
  return { group, bodyMat, eyeMat };
}

export interface EnemyHits {
  toPlayer: number;
  toEnemy: number;
}

export interface EnemyRig {
  update: (
    dt: number, t: number, playerPos: THREE.Vector3,
    attack: PlayerAttack | null, locked: boolean
  ) => EnemyHits;
  reset: () => void;
}

/**
 * 5 теней сторожат осколки и проходы; гоблины шарят по лесам и лагерю;
 * слизни сидят у воды. Всего 11 морд.
 */
export function createEnemies(scene: THREE.Scene, collision: CollisionWorld): EnemyRig {
  const homes: Array<[number, number, EnemyKind]> = [
    [-7.5, -1.5, 'wraith'], // кладбище
    [4.0, 0.8, 'wraith'], // часовня (внутри)
    [-4.2, -5.2, 'wraith'], // подход к мосту
    [3.2, -15.6, 'wraith'], // ворота замка
    [-3.4, -20.2, 'wraith'], // двор замка
    [-14, 10, 'goblin'], // опушка у полей
    [5, -38, 'goblin'], // осадный лагерь
    [22, 15, 'goblin'], // тропа к серпантину
    [-30, -6, 'slime'], // озерный берег
    [15, -8, 'slime'], // восточный берег реки
    [7, -3, 'slime'] // у часовни
  ];

  const builders: Record<EnemyKind, () => { group: THREE.Group; bodyMat: THREE.MeshLambertMaterial; eyeMat: THREE.MeshBasicMaterial }> = {
    wraith: buildWraith,
    goblin: buildGoblin,
    slime: buildSlime
  };

  const list: Enemy[] = homes.map(([x, z, kind], i) => {
    const stats = STATS[kind];
    const { group, bodyMat, eyeMat } = builders[kind]();
    const gy = getGroundHeight(x, z);
    group.position.set(x, gy, z);
    group.scale.setScalar(stats.scale);
    scene.add(group);
    return {
      kind,
      stats,
      home: new THREE.Vector3(x, gy, z),
      pos: new THREE.Vector3(x, gy, z),
      group, bodyMat, eyeMat,
      hp: stats.hp, maxHp: stats.hp,
      state: 'idle' as const,
      attackCd: 0,
      attackWindup: 0,
      flash: 0,
      deathT: 0,
      bobPhase: i * 1.7,
      active: true,
      lastHitId: -1,
      baseScale: stats.scale
    };
  });

  function facePlayer(e: Enemy, px: number, pz: number): void {
    e.group.rotation.y = Math.atan2(px - e.pos.x, pz - e.pos.z);
  }

  return {
    update: (dt, t, pp, attack, locked) => {
      const hits: EnemyHits = { toPlayer: 0, toEnemy: 0 };

      for (const e of list) {
        if (!e.active) continue;

        // --- смерть: осесть и исчезнуть ---
        if (e.state === 'dead') {
          e.deathT += dt;
          const k = Math.min(e.deathT / 0.6, 1);
          e.group.scale.setScalar(Math.max(e.baseScale * (1 - k), 0.01));
          e.group.position.y = e.pos.y - k * 0.8;
          if (k >= 1) {
            e.active = false;
            e.group.visible = false;
          }
          continue;
        }

        const dx = pp.x - e.pos.x;
        const dz = pp.z - e.pos.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // --- удар игрока (одно попадание на замах) ---
        if (attack?.active && e.lastHitId !== attack.id) {
          const ax = e.pos.x - attack.pos.x;
          const az = e.pos.z - attack.pos.z;
          const ad = Math.sqrt(ax * ax + az * az);
          if (ad < attack.range) {
            const dot = (ax * attack.dir.x + az * attack.dir.z) / Math.max(ad, 0.001);
            // вертикаль (с балкона вниз не достать) + прямая видимость
            const vOk = Math.abs(e.pos.y + 1.2 - attack.pos.y) < 2.6;
            if (
              dot > 0.45 && vOk &&
              !collision.segBlocked(attack.pos.x, attack.pos.z, e.pos.x, e.pos.z)
            ) {
              e.lastHitId = attack.id;
              e.hp -= attack.dmg;
              hits.toEnemy++;
              e.flash = 0.12;
              // нокбэк от игрока
              const nx = e.pos.x + (ax / Math.max(ad, 0.001)) * 0.9;
              const nz = e.pos.z + (az / Math.max(ad, 0.001)) * 0.9;
              collision.resolve(nx, nz, ENEMY_R, resolveOut);
              e.pos.x = resolveOut.x;
              e.pos.z = resolveOut.z;
              if (e.hp <= 0) {
                e.state = 'dead';
                e.deathT = 0;
                continue;
              }
            }
          }
        }

        if (e.flash > 0) {
          e.flash -= dt;
          e.bodyMat.emissive.setHex(0xffffff);
          e.bodyMat.emissiveIntensity = 1.5;
        } else {
          const aggro = e.state === 'chase';
          e.bodyMat.emissive.setHex(aggro ? 0x3a0a1a : 0x150a24);
          e.bodyMat.emissiveIntensity = aggro ? 1.4 : 0.8;
        }

        if (!locked) continue;

        // --- AI: агро только по прямой видимости (в упор — слух) ---
        if (
          e.state === 'idle' && dist < e.stats.aggroR &&
          (dist < 2.5 || !collision.segBlocked(e.pos.x, e.pos.z, pp.x, pp.z))
        ) {
          e.state = 'chase';
        } else if (e.state === 'chase' && dist > DEAGGRO_R) {
          e.state = 'idle';
        }

        if (e.state === 'chase') {
          facePlayer(e, pp.x, pp.z);
          e.eyeMat.color.setHex(e.stats.aggroEye);
          if (dist > ATTACK_R) {
            // погоня
            const nx = e.pos.x + (dx / dist) * e.stats.speed * dt;
            const nz = e.pos.z + (dz / dist) * e.stats.speed * dt;
            collision.resolve(nx, nz, ENEMY_R, resolveOut);
            e.pos.x = resolveOut.x;
            e.pos.z = resolveOut.z;
          } else if (e.attackWindup <= 0 && e.attackCd <= 0) {
            // начало замаха: телеграф (наклон + глаза)
            e.attackWindup = e.stats.windup;
          }
        } else {
          // idle: сброс незавершенного замаха + дрейф у поста
          if (e.attackWindup > 0) {
            e.attackWindup = 0;
            e.group.rotation.x = 0;
          }
          e.eyeMat.color.setHex(e.stats.idleEye);
          const hx = e.home.x - e.pos.x;
          const hz = e.home.z - e.pos.z;
          const hd = Math.sqrt(hx * hx + hz * hz);
          if (hd > 0.5) {
            const nx = e.pos.x + (hx / hd) * 1.2 * dt;
            const nz = e.pos.z + (hz / hd) * 1.2 * dt;
            collision.resolve(nx, nz, ENEMY_R, resolveOut);
            e.pos.x = resolveOut.x;
            e.pos.z = resolveOut.z;
          }
          e.group.rotation.y = Math.sin(t * 0.5 + e.bobPhase) * 0.8;
        }

        // тиканье замаха — независимо от состояния (деагро его сбрасывает выше)
        if (e.attackWindup > 0) {
          e.attackWindup -= dt;
          const k = Math.max(e.attackWindup, 0) / e.stats.windup;
          e.group.rotation.x = -0.3 * k;
          e.eyeMat.color.setHex(0xffcc00);
          if (e.attackWindup <= 0) {
            e.group.rotation.x = 0;
            // удар: дистанция + вертикаль + видимость заново — можно отпрыгнуть
            const sx = pp.x - e.pos.x;
            const sz = pp.z - e.pos.z;
            const vDist = Math.abs(e.pos.y - (pp.y - 1.7));
            if (
              e.state === 'chase' &&
              Math.hypot(sx, sz) < ATTACK_R + 0.35 &&
              vDist < 2.2 &&
              !collision.segBlocked(e.pos.x, e.pos.z, pp.x, pp.z)
            ) {
              hits.toPlayer++;
              e.attackCd = 1.3;
            } else {
              e.attackCd = 0.4; // промах — короткая пауза
            }
          }
        }

        if (e.attackCd > 0) e.attackCd -= dt;

        // земля под ногами + походка вида:
        // тень парит, гоблин вихляется, слизень прыгает блином
        const gy = getGroundHeight(e.pos.x, e.pos.z);
        e.pos.y += (gy - e.pos.y) * Math.min(dt * 5, 1);
        if (e.kind === 'slime') {
          const hopping = e.state === 'chase' ? 1 : 0.3;
          const sq = Math.sin(t * 6 + e.bobPhase) * 0.18 * hopping;
          e.group.scale.set(e.baseScale * (1 - sq), e.baseScale * (1 + sq), e.baseScale * (1 - sq));
          e.group.position.set(
            e.pos.x,
            e.pos.y + Math.abs(Math.sin(t * 6 + e.bobPhase)) * 0.3 * hopping,
            e.pos.z
          );
        } else {
          e.group.position.set(
            e.pos.x,
            e.pos.y + 0.15 + Math.sin(t * 3 + e.bobPhase) * 0.12,
            e.pos.z
          );
          if (e.kind === 'goblin') {
            e.group.rotation.z = Math.sin(t * 9 + e.bobPhase) * (e.state === 'chase' ? 0.09 : 0.03);
          }
        }
      }

      // расталкивание друг от друга + повторная проверка стен,
      // чтобы separation не затолкал врага в архитектуру
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = list[i];
          const b = list[j];
          if (!a.active || !b.active || a.state === 'dead' || b.state === 'dead') continue;
          const dx = b.pos.x - a.pos.x;
          const dz = b.pos.z - a.pos.z;
          const d = Math.sqrt(dx * dx + dz * dz);
          if (d < 1.0 && d > 0.001) {
            const push = ((1.0 - d) / 2) * 0.5;
            a.pos.x -= (dx / d) * push;
            a.pos.z -= (dz / d) * push;
            b.pos.x += (dx / d) * push;
            b.pos.z += (dz / d) * push;
          }
        }
      }
      for (const e of list) {
        if (!e.active || e.state === 'dead') continue;
        collision.resolve(e.pos.x, e.pos.z, ENEMY_R, resolveOut);
        e.pos.x = resolveOut.x;
        e.pos.z = resolveOut.z;
      }

      return hits;
    },

    reset: () => {
      for (const e of list) {
        e.hp = e.maxHp;
        e.lastHitId = -1;
        e.state = 'idle';
        e.pos.copy(e.home);
        e.active = true;
        e.deathT = 0;
        e.flash = 0;
        e.attackCd = 0;
        e.attackWindup = 0;
        e.group.visible = true;
        e.group.scale.setScalar(e.baseScale);
        e.group.rotation.x = 0;
        e.group.rotation.z = 0;
        e.group.position.copy(e.home);
      }
    }
  };
}
