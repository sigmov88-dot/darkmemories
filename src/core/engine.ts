import * as THREE from 'three';
import { SPAWN } from '../world/ground';

/**
 * Engine — renderer + scene + camera.
 * Пиксель-режим: antialias ВЫКЛ, Nearest-апскейл через CSS.
 * Все источники света создаются на старте.
 */
export class Engine {
  renderer!: THREE.WebGLRenderer;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;

  constructor(private canvas: HTMLCanvasElement) {}

  init(): void {
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: false, // пикселям сглаживание не нужно
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(1); // четкие пиксели, без DPR-мыла
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.BasicShadowMap; // жесткие пиксельные тени

    // Для пиксель-арта — без киношного тонемаппинга, цвета палитры как есть
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // CSS-апскейл без сглаживания
    this.canvas.style.imageRendering = 'pixelated';

    // Потеря контекста (смена GPU, сон вкладки): вежливый экран вместо фриза
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      document.body.classList.add('nogl');
    });

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a14);
    // Гуще, чем в M1, но реже старта: мрак вернулся, маяки все еще видны
    this.scene.fog = new THREE.FogExp2(0x0a0e1c, 0.014);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camera.position.set(SPAWN.x, 1.7, SPAWN.z); // край карты, цветочный луг

    window.addEventListener('resize', () => this.onResize());
  }

  onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
