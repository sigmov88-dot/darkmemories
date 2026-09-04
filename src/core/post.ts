import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPixelatedPass } from 'three/addons/postprocessing/RenderPixelatedPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Пост ТОЛЬКО для пикселизации. Никаких виньеток/грейна/грейда.
 * RenderPixelatedPass рендерит сцену в низком разрешении
 * и апскейлит Nearest-фильтром + легкая обводка по глубине/нормалям.
 */
export interface PostRig {
  composer: EffectComposer;
  pixelPass: RenderPixelatedPass;
  setSize: (w: number, h: number) => void;
  setPixelSize: (n: number) => void;
  getPixelSize: () => number;
}

export function createPost(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  pixelSize = 4
): PostRig {
  const composer = new EffectComposer(renderer);

  const pixelPass = new RenderPixelatedPass(pixelSize, scene, camera);
  // Чуть мягче обводку, чтобы не было черной каши
  pixelPass.normalEdgeStrength = 0.25;
  pixelPass.depthEdgeStrength = 0.35;
  composer.addPass(pixelPass);
  composer.addPass(new OutputPass());

  return {
    composer,
    pixelPass,
    setSize: (w: number, h: number) => composer.setSize(w, h),
    setPixelSize: (n: number) => {
      const v = Math.max(1, Math.min(8, Math.round(n)));
      pixelPass.setPixelSize(v);
    },
    getPixelSize: () => pixelPass.pixelSize
  };
}
