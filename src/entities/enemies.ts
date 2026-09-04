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

interface Enemy {
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
}

const AGGRO_R = 9;
const DEAGGRO_R = 16;
const ATTACK_R = 1.8;
const CHASE_SPEED = 3.1;
const ENEMY_R = 0.5;

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
 * 5 стражей: кладбище, часовня, подход к мосту, ворота замка, двор.
 * Охраняют осколки и узкие места.
 */
export function createEnemies(scene: THREE.Scene, collision: CollisionWorld): EnemyRig {
  const homes: Array<[number, number]> = [
    [-7.5, -1.5], // кладбище
    [4.0, 0.8], // часовня (внутри)
    [-4.2, -5.2], // подход к мосту
    [3.2, -15.6], // ворота замка
    [-3.4, -20.2] // двор замка
  ];

  const list: Enemy[] = homes.map(([x, z], i) => {
    const { group, bodyMat, eyeMat } = buildWraith();
    const gy = getGroundHeight(x, z);
    group.position.set(x, gy, z);
    scene.add(group);
    return {
      home: new THREE.Vector3(x, gy, z),
      pos: new THREE.Vector3(x, gy, z),
      group, bodyMat, eyeMat,
      hp: 3, maxHp: 3,
      state: 'idle' as const,
      attackCd: 0,
      attackWindup: 0,
      flash: 0,
      deathT: 0,
      bobPhase: i * 1.7,
      active: true,
      lastHitId: -1
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
          e.group.scale.setScalar(Math.max(1 - k, 0.01));
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
            if (dot > 0.45) {
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

        // --- AI ---
        if (e.state === 'idle' && dist < AGGRO_R) {
          e.state = 'chase';
        } else if (e.state === 'chase' && dist > DEAGGRO_R) {
          e.state = 'idle';
        }

        if (e.state === 'chase') {
          facePlayer(e, pp.x, pp.z);
          e.eyeMat.color.setHex(0xff5a1a);
          if (dist > ATTACK_R) {
            // погоня
            const nx = e.pos.x + (dx / dist) * CHASE_SPEED * dt;
            const nz = e.pos.z + (dz / dist) * CHASE_SPEED * dt;
            collision.resolve(nx, nz, ENEMY_R, resolveOut);
            e.pos.x = resolveOut.x;
            e.pos.z = resolveOut.z;
          } else if (e.attackWindup <= 0 && e.attackCd <= 0) {
            // начало замаха: 0.4с телеграфа (наклон + глаза)
            e.attackWindup = 0.4;
          }
          if (e.attackWindup > 0) {
            e.attackWindup -= dt;
            const k = Math.max(e.attackWindup, 0) / 0.4;
            e.group.rotation.x = -0.3 * k;
            e.eyeMat.color.setHex(0xffcc00);
            if (e.attackWindup <= 0) {
              e.group.rotation.x = 0;
              // удар: дистанция проверяется заново — можно отпрыгнуть
              const sx = pp.x - e.pos.x;
              const sz = pp.z - e.pos.z;
              if (Math.hypot(sx, sz) < ATTACK_R + 0.35) {
                hits.toPlayer++;
                e.attackCd = 1.3;
              } else {
                e.attackCd = 0.4; // промах — короткая пауза
              }
            }
          }
        } else {
          // idle: дрейф у поста, глаза тусклые
          e.eyeMat.color.setHex(0x881508);
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

        if (e.attackCd > 0) e.attackCd -= dt;

        // парение + земля под ногами
        const gy = getGroundHeight(e.pos.x, e.pos.z);
        e.pos.y += (gy - e.pos.y) * Math.min(dt * 5, 1);
        e.group.position.set(
          e.pos.x,
          e.pos.y + 0.15 + Math.sin(t * 3 + e.bobPhase) * 0.12,
          e.pos.z
        );
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
        e.group.scale.setScalar(1);
        e.group.rotation.x = 0;
        e.group.position.copy(e.home);
      }
    }
  };
}
