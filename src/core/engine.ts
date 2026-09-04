import * as THREE from 'three';

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

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b0e1a);
    // Разреженный туман: открытый мир, маяки-ориентиры видны издалека
    this.scene.fog = new THREE.FogExp2(0x0d1224, 0.011);

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      300
    );
    this.camera.position.set(0, 1.7, 26); // площадь деревни, лицом на север

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
