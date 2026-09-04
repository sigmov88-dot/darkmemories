import * as THREE from 'three';
import './style.css';
import { Engine } from './core/engine';
import { Input } from './core/input';
import { createPost } from './core/post';
import { CollisionWorld } from './systems/collision';
import { GameState } from './systems/gamestate';
import { setupAtmosphere } from './world/atmosphere';
import { createGround } from './world/ground';
import { createVillage } from './world/village';
import { createRuins } from './world/ruins';
import { createRiver } from './world/river';
import { createLake } from './world/lake';
import { createCrags } from './world/crags';
import { createCastle } from './world/castle';
import { createTorches } from './world/torches';
import { createDeadForest } from './world/forest';
import { createGroundFog } from './world/fog';
import { createProps } from './world/props';
import { createSatellites } from './world/satellites';
import { createQuest } from './systems/quest';
import { createEnemies, PlayerAttack } from './entities/enemies';
import { Player } from './entities/player';
import { WEAPONS } from './entities/weapons';
import { FpsMeter } from './systems/fps';

const canvas = document.getElementById('scene') as HTMLCanvasElement;
const enterBtn = document.getElementById('enter') as HTMLButtonElement;
const resumeBtn = document.getElementById('resume') as HTMLButtonElement;
const pixelLabel = document.getElementById('pixel') as HTMLElement | null;

const engine = new Engine(canvas);
engine.init();

// Порядок важен: сначала коллизии, потом все строители регистрируют в них твердые тела
const collision = new CollisionWorld();

const input = new Input();
input.init();

setupAtmosphere(engine.scene);
createGround(engine.scene);
createVillage(engine.scene, collision);
const ruins = createRuins(engine.scene, collision);
const river = createRiver(engine.scene, collision);
const lake = createLake(engine.scene, collision);
const crags = createCrags(engine.scene, collision);
createCastle(engine.scene, collision);
const torches = createTorches(engine.scene, collision);
createDeadForest(engine.scene, collision);
createProps(engine.scene);
const satellites = createSatellites(engine.scene, collision);
const fog = createGroundFog(engine.scene);

// Прогрев шейдеров ПОСЛЕ создания мира, иначе греется пустая сцена
engine.renderer.compile(engine.scene, engine.camera);

let pixelSize = 4;
const post = createPost(engine.renderer, engine.scene, engine.camera, pixelSize);
const applyPixel = (): void => {
  post.setPixelSize(pixelSize);
  if (pixelLabel) pixelLabel.textContent = `pixel x${pixelSize}`;
};
applyPixel();

window.addEventListener('resize', () => {
  post.setSize(window.innerWidth, window.innerHeight);
});
window.addEventListener('keydown', (e) => {
  if (e.code === 'BracketLeft') {
    pixelSize = Math.max(1, pixelSize - 1);
    applyPixel();
  }
  if (e.code === 'BracketRight') {
    pixelSize = Math.min(8, pixelSize + 1);
    applyPixel();
  }
});

// Единая машина состояний: dead и won взаимоисключающи по построению
const state = new GameState();
const syncBody = (): void => state.syncBody(document.body);

const player = new Player(engine.camera, document.body, engine.scene, input, collision);
const quest = createQuest(engine.scene, ruins, () => player.heal(1));
const enemies = createEnemies(engine.scene, collision);
player.init((locked) => {
  if (locked) state.onLock();
  else state.onUnlock();
  syncBody();
  if (state.playing) quest.start();
});
syncBody();

enterBtn.addEventListener('click', () => player.lock());
resumeBtn.addEventListener('click', () => player.lock());

const fps = new FpsMeter();
const clock = new THREE.Clock();
const staminaFill = document.getElementById('stamina-fill');
const hpEl = document.getElementById('hp');
const weaponEl = document.getElementById('weapon');
const dmgEl = document.getElementById('dmg');
const drawsEl = document.getElementById('draws');
const attackDir = new THREE.Vector3();
let dmgFlash = 0;
let drawTimer = 0;

document.getElementById('respawn')?.addEventListener('click', () => {
  enemies.reset();
  player.respawn(0, 26);
  player.lock(); // клик — жест, lock разрешен; onLock переведет dead → playing
});

function animate(): void {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  const active = state.playing;

  ruins.update(t);
  river.update(t, dt);
  lake.update(t, dt);
  crags.update(t);
  satellites.update(t, dt);
  torches.update(t);
  fog.update(t, dt);
  player.update(dt, t);

  // бой: удар игрока → враги; враги → игрок
  let attack: PlayerAttack | null = null;
  if (active && player.attackActive()) {
    player.attackDir(attackDir);
    const stats = WEAPONS[player.currentWeapon()];
    attack = {
      active: true, id: player.attackId(), dmg: stats.dmg, range: stats.range,
      pos: engine.camera.position, dir: attackDir
    };
  }
  const hits = enemies.update(dt, t, engine.camera.position, attack, active);
  if (hits > 0 && active) {
    const res = player.damage(1);
    if (res === 'dead') {
      state.die();
      syncBody();
      document.exitPointerLock?.();
    } else if (res === 'hit') {
      dmgFlash = 1;
    }
    // 'ignored' — ни вспышки, ни урона
  }

  // победа возможна только из playing — dead+won исключены состоянием
  if (quest.update(dt, t, engine.camera.position, active)) {
    state.win();
    syncBody();
    document.exitPointerLock?.();
  }

  if (staminaFill) {
    const s = player.stamina01();
    staminaFill.style.width = `${Math.round(s * 100)}%`;
    staminaFill.classList.toggle('low', player.isExhausted() || s < 0.25);
  }
  if (hpEl) {
    const hp = Math.max(player.hpNow(), 0);
    hpEl.textContent = '♥'.repeat(hp) + '♡'.repeat(Math.max(player.hpMax() - hp, 0));
  }
  if (weaponEl) {
    const w = player.currentWeapon();
    weaponEl.textContent = w === 'sword' ? '[1 МЕЧ]' : '[2 ФАКЕЛ]';
    weaponEl.style.color = w === 'sword' ? '#c8d2e8' : '#ffb84d';
  }
  if (dmgEl) {
    dmgFlash = Math.max(dmgFlash - dt * 2.2, 0);
    dmgEl.style.opacity = dmgFlash.toFixed(2);
  }

  post.composer.render();

  // замер из гайдов: draw calls + треугольники + программы, раз в полсекунды
  drawTimer += dt;
  if (drawsEl && drawTimer > 0.5) {
    drawTimer = 0;
    const info = engine.renderer.info;
    drawsEl.textContent =
      `${info.render.calls} calls · ${(info.render.triangles / 1000).toFixed(0)}k tris · ${info.programs?.length ?? 0} prog`;
  }

  fps.update(dt, engine.camera.position.x, engine.camera.position.z);
}

animate();
