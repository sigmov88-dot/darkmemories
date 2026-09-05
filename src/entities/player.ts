import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { Input } from '../core/input';
import { CollisionWorld, ResolveOut } from '../systems/collision';
import { getGroundHeight, WORLD } from '../world/ground';
import { makePixelFlame } from '../world/pixel';
import { WEAPONS, WeaponId, SWING_LEN, SWING_HIT_WINDOW } from './weapons';

const EYE = 1.7;
const EYE_CROUCH = 1.05;
const RADIUS = 0.42;
const GRAVITY = 22;
const JUMP_SPEED = 7.4;
const WALK_SPEED = 4.2;
const RUN_SPEED = 7.2;
const CROUCH_SPEED = 2.2;
const FLY_SPEED = 8;

/** FPS-ходьба: WASD + Space + PointerLock, в руках факел или меч (1/2) */
export class Player {
  controls!: PointerLockControls;
  private vel = new THREE.Vector3();
  private handLight!: THREE.PointLight;
  private torchGroup!: THREE.Group;
  private swordGroup!: THREE.Group;
  private handFlame!: THREE.Sprite;
  private weapon: WeaponId = 'torch';
  private lightLevel = WEAPONS.torch.light;
  private bob = 0;
  private locked = false;
  private feetY = 0;
  private vy = 0;
  private grounded = true;
  private wantJump = false;
  private stamina = 100;
  private exhausted = false;
  // бой
  private hp = 6;
  private maxHp = 6;
  private invuln = 0;
  private attackCd = 0;
  private swingT = 0;
  private swingId = 0;
  private resolveOut: ResolveOut = { x: 0, z: 0 };
  private eyeH = EYE;
  /** Dev-режимы из панели (` — показать). Меняются снаружи без перезагрузки. */
  readonly dev = { fly: false, noclip: false, speedMul: 1, god: false };

  currentWeapon(): WeaponId {
    return this.weapon;
  }

  weaponLabel(): string {
    return WEAPONS[this.weapon].label;
  }

  stamina01(): number {
    return this.stamina / 100;
  }

  isExhausted(): boolean {
    return this.exhausted;
  }

  hpNow(): number {
    return this.hp;
  }

  hpMax(): number {
    return this.maxHp;
  }

  /** Урон по игроку: 'ignored' — неуязвимость/годмод, 'hit' — ранен, 'dead' — убит. */
  damage(n: number): 'ignored' | 'hit' | 'dead' {
    if (this.dev.god) {
      this.hp = this.maxHp;
      return 'ignored';
    }
    if (this.invuln > 0) return 'ignored';
    this.hp -= n;
    this.invuln = 1.2;
    return this.hp <= 0 ? 'dead' : 'hit';
  }

  heal(n: number): void {
    this.hp = Math.min(this.maxHp, this.hp + n);
  }

  respawn(x: number, z: number): void {
    this.camera.position.set(x, getGroundHeight(x, z) + EYE, z);
    this.feetY = getGroundHeight(x, z);
    this.vel.set(0, 0, 0);
    this.vy = 0;
    this.grounded = true;
    this.hp = this.maxHp;
    this.invuln = 1.5;
    this.stamina = 100;
    this.exhausted = false;
    this.eyeH = EYE;
    // сброс всего ввода/анимаций, чтобы не стрелял старый замах
    this.attackCd = 0;
    this.swingT = 0;
    this.wantJump = false;
    this.bob = 0;
    this.torchGroup.rotation.set(0, 0, 0);
    this.torchGroup.position.set(0.35, -0.3, -0.7);
    this.swordGroup.rotation.set(-0.15, 0, 0);
    this.swordGroup.position.set(0.35, -0.34, -0.7);
  }

  /** Активен ли удар прямо сейчас (для попадания по врагам) */
  attackActive(): boolean {
    return this.swingT > SWING_LEN - SWING_HIT_WINDOW;
  }

  attackId(): number {
    return this.swingId;
  }

  attackDir(out: THREE.Vector3): THREE.Vector3 {
    return this.camera.getWorldDirection(out);
  }

  constructor(
    private camera: THREE.Camera,
    private dom: HTMLElement,
    private scene: THREE.Scene,
    private input: Input,
    private collision: CollisionWorld
  ) {}

  init(onLockChange: (locked: boolean) => void): void {
    this.controls = new PointerLockControls(this.camera, this.dom);
    this.controls.addEventListener('lock', () => {
      this.locked = true;
      onLockChange(true);
    });
    this.controls.addEventListener('unlock', () => {
      this.locked = false;
      onLockChange(false);
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !e.repeat) {
        this.wantJump = true;
        e.preventDefault();
      }
      // 1 — меч, 2 — факел
      if (e.code === 'Digit1') this.setWeapon('sword');
      if (e.code === 'Digit2') this.setWeapon('torch');
    });
    // ЛКМ — удар текущим оружием (только в игре)
    window.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || !this.locked) return;
      if (this.attackCd <= 0) {
        this.attackCd = WEAPONS[this.weapon].cooldown;
        this.swingT = SWING_LEN;
        this.swingId++;
      }
    });

    this.feetY = getGroundHeight(this.camera.position.x, this.camera.position.z);

    this.handLight = new THREE.PointLight(0xff8a3a, 9, 14, 1.7);
    this.handLight.position.set(0.35, -0.15, -0.4);
    this.camera.add(this.handLight);
    this.scene.add(this.camera);

    this.handFlame = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makePixelFlame(),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 1.0
      })
    );
    // Группа факела
    this.torchGroup = new THREE.Group();
    this.torchGroup.position.set(0.35, -0.3, -0.7);
    this.handFlame.position.set(0, 0.08, 0);
    this.handFlame.scale.set(0.14, 0.2, 1);
    this.torchGroup.add(this.handFlame);

    const handle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.02, 0.5, 6),
      new THREE.MeshLambertMaterial({ color: 0x2a1a0c })
    );
    handle.position.set(0, -0.12, 0);
    handle.rotation.x = 0.25;
    this.torchGroup.add(handle);
    this.camera.add(this.torchGroup);

    // Группа меча: клинок + гарда + рукоять + навершие (пиксельные боксы)
    this.swordGroup = new THREE.Group();
    this.swordGroup.position.set(0.35, -0.34, -0.7);
    this.swordGroup.rotation.x = -0.15;
    const steel = new THREE.MeshLambertMaterial({ color: 0x9aa2b0, emissive: 0x1a1e28 });
    const ironDark = new THREE.MeshLambertMaterial({ color: 0x3a3f4a });
    const leather = new THREE.MeshLambertMaterial({ color: 0x4a2f1a });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.0, 0.025), steel);
    blade.position.y = 0.68;
    this.swordGroup.add(blade);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.064, 0.18, 4), steel);
    tip.position.y = 1.27;
    tip.rotation.y = Math.PI / 4;
    this.swordGroup.add(tip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.07, 0.08), ironDark);
    guard.position.y = 0.16;
    this.swordGroup.add(guard);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.26, 6), leather);
    grip.position.y = 0.0;
    this.swordGroup.add(grip);
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.09), ironDark);
    pommel.position.y = -0.16;
    this.swordGroup.add(pommel);
    this.swordGroup.visible = false;
    this.camera.add(this.swordGroup);
  }

  private setWeapon(w: WeaponId): void {
    if (this.weapon === w) return;
    this.weapon = w;
    this.swingT = 0; // смена отменяет замах
    this.torchGroup.visible = w === 'torch';
    this.swordGroup.visible = w === 'sword';
  }

  lock(): void {
    this.controls.lock();
  }

  update(dt: number, t: number): void {
    const n = Math.sin(t * 12.3) * 0.5 + Math.sin(t * 27.7) * 0.3 + Math.sin(t * 47.1) * 0.2;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.attackCd > 0) this.attackCd -= dt;

    // свет руки плавно идет к уровню текущего оружия + мерцание
    const targetLight = WEAPONS[this.weapon].light;
    this.lightLevel += (targetLight - this.lightLevel) * Math.min(dt * 6, 1);

    // взмахи: факел — колющий выпад вперед, меч — горизонтальная рубка
    let swingBoost = 0;
    if (this.swingT > 0) {
      this.swingT -= dt;
      const p = 1 - Math.max(this.swingT, 0) / SWING_LEN; // 0→1
      const curve = Math.sin(p * Math.PI);
      if (this.weapon === 'torch') {
        this.torchGroup.rotation.x = -curve * 1.15;
        this.torchGroup.position.z = -0.7 - curve * 0.28;
      } else {
        const e = 1 - Math.pow(1 - p, 2); // easeOut
        this.swordGroup.rotation.y = 0.85 - 1.8 * e;
        this.swordGroup.rotation.x = -0.15 - curve * 0.25;
        this.swordGroup.position.x = 0.35 - curve * 0.15;
      }
      swingBoost = curve * 7;
    } else {
      this.torchGroup.rotation.x *= 0.8;
      this.torchGroup.position.z += (-0.7 - this.torchGroup.position.z) * Math.min(dt * 10, 1);
      this.swordGroup.rotation.y *= 0.8;
      this.swordGroup.rotation.x += (-0.15 - this.swordGroup.rotation.x) * Math.min(dt * 10, 1);
      this.swordGroup.position.x += (0.35 - this.swordGroup.position.x) * Math.min(dt * 10, 1);
    }

    this.handLight.intensity = this.lightLevel + n * 1.6 + swingBoost;
    this.handFlame.scale.set(0.14 * (1 + n * 0.06), 0.2 * (1 - n * 0.05), 1);

    if (!this.locked) {
      this.wantJump = false;
      return;
    }

    // --- Горизонталь: нормализованный ввод (диагональ не быстрее) ---
    let ix = this.input.strafe;
    let iz = this.input.forward;
    const ilen = Math.hypot(ix, iz);
    if (ilen > 1) {
      ix /= ilen;
      iz /= ilen;
    }
    const pressingMove = ilen > 0.1;
    // приседание: Ctrl (удерживать), только на земле и не в полете
    const crouching = (this.input.isDown('ControlLeft') || this.input.isDown('ControlRight')) && !this.dev.fly && this.grounded;
    const eyeTarget = crouching ? EYE_CROUCH : EYE;
    this.eyeH += (eyeTarget - this.eyeH) * Math.min(dt * 10, 1);
    // бег только по земле и не присев: в воздухе — скорость шага, стамина заморожена
    const canRun = this.grounded && !crouching && this.input.run && !this.exhausted && this.stamina > 1;
    const baseSpeed = this.dev.fly ? FLY_SPEED : crouching ? CROUCH_SPEED : canRun ? RUN_SPEED : WALK_SPEED;
    const speed = baseSpeed * this.dev.speedMul;
    // в воздухе управление слабее
    const grip = this.grounded || this.dev.fly ? 8 : 2.5;
    this.vel.x += (ix * speed - this.vel.x) * Math.min(dt * grip, 1);
    this.vel.z += (iz * speed - this.vel.z) * Math.min(dt * grip, 1);

    this.controls.moveRight(this.vel.x * dt);
    this.controls.moveForward(this.vel.z * dt);

    const p = this.camera.position;
    // край мира (открытый регион, константы из ground.ts)
    p.x = Math.max(WORLD.minX, Math.min(WORLD.maxX, p.x));
    p.z = Math.max(WORLD.minZ, Math.min(WORLD.maxZ, p.z));
    if (!this.dev.noclip) {
      // коллизии (без аллокаций)
      this.collision.resolve(p.x, p.z, RADIUS, this.resolveOut);
      p.x = this.resolveOut.x;
      p.z = this.resolveOut.z;
    }

    // --- Вертикаль: прыжок + гравитация + ступени ---
    // На низкое (≤0.55 над ногами) забираемся шагом или прыжком
    const terrain = getGroundHeight(p.x, p.z);
    const stepTop = this.collision.surfaceTop(p.x, p.z);
    let ground = terrain;
    if (
      stepTop > -Infinity &&
      this.feetY >= stepTop - 0.6 &&
      this.feetY <= stepTop + 0.35
    ) {
      ground = Math.max(terrain, stepTop);
    }
    if (this.grounded && this.wantJump) {
      this.vy = JUMP_SPEED;
      this.grounded = false;
    }
    this.wantJump = false;

    if (this.dev.fly) {
      // полет: Space вверх, C вниз, земля только ловит приземление
      const up = (this.input.isDown('Space') ? 1 : 0) - (this.input.isDown('KeyC') ? 1 : 0);
      this.feetY += up * FLY_SPEED * this.dev.speedMul * dt;
      if (this.feetY <= ground) {
        this.feetY = ground;
        this.grounded = true;
      } else if (up !== 0) {
        this.grounded = false;
      }
    } else if (!this.grounded) {
      this.vy -= GRAVITY * dt;
      this.feetY += this.vy * dt;
      if (this.feetY <= ground) {
        this.feetY = ground;
        this.vy = 0;
        this.grounded = true;
      }
    } else {
      // земля ушла из-под ног (мост/холм) — падать
      if (this.feetY > ground + 0.01) {
        this.grounded = false;
        this.vy = 0;
      } else {
        this.feetY = ground;
      }
    }

    // --- Стамина: только на земле, расход только за реальное движение ---
    // (бег в стену и полеты bunny-hop стамину не жгут и не копят)
    if (this.grounded) {
      const realSpeed = Math.hypot(this.vel.x, this.vel.z);
      if (canRun && pressingMove && realSpeed > 1.0) {
        this.stamina -= 20 * dt;
        if (this.stamina <= 0) {
          this.stamina = 0;
          this.exhausted = true;
        }
      } else {
        this.stamina += (pressingMove ? 14 : 24) * dt;
        if (this.stamina > 100) this.stamina = 100;
        if (this.exhausted && this.stamina > 25) this.exhausted = false;
      }
    }

    // покачивание только на земле при движении (присев — ниже и тише)
    const moving = Math.abs(this.vel.x) + Math.abs(this.vel.z);
    if (this.grounded && moving > 0.5) this.bob += dt * (this.input.run ? 11 : 8);
    const targetY = this.feetY + this.eyeH + (this.grounded ? Math.sin(this.bob) * 0.045 * Math.min(moving / 4, 1) : 0);
    p.y += (targetY - p.y) * Math.min(dt * 14, 1);
  }
}
