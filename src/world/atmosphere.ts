import * as THREE from 'three';

export interface Atmosphere {
  dirLight: THREE.DirectionalLight;
  update: (t: number) => void;
}

function glowTex(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#d7e6ff';
  ctx.fillRect(13, 13, 6, 6);
  ctx.fillStyle = '#8fa8d8';
  ctx.fillRect(11, 11, 10, 10);
  ctx.clearRect(13, 13, 6, 6);
  ctx.fillStyle = '#d7e6ff';
  ctx.fillRect(13, 13, 6, 6);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Холодная пиксельная луна + плоский свет без полутонов */
export function setupAtmosphere(scene: THREE.Scene): Atmosphere {
  const dirLight = new THREE.DirectionalLight(0x9db8e8, 1.25);
  dirLight.position.set(-18, 26, -14);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 90;
  dirLight.shadow.camera.left = -35;
  dirLight.shadow.camera.right = 35;
  dirLight.shadow.camera.top = 35;
  dirLight.shadow.camera.bottom = -35;
  dirLight.shadow.bias = -0.002;
  scene.add(dirLight);
  // якорь тени: main двигает его за игроком, иначе периферия без теней
  scene.add(dirLight.target);

  // Плоский ambient вместо hemisphere — пиксель-стиль любит плоскости.
  // Темно: свет — только луна, факелы и «жемчужины».
  scene.add(new THREE.AmbientLight(0x2c3854, 0.8));
  const rim = new THREE.DirectionalLight(0x4a6aaa, 0.4);
  rim.position.set(12, 8, -30);
  scene.add(rim);

  // Пиксельные звезды — крупные точки
  const N = 220;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 150 + (i % 40);
    const th = (i / N) * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * r;
    pos[i * 3 + 1] = 30 + ((i * 37) % 90);
    pos[i * 3 + 2] = Math.sin(th) * r;
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(sg, new THREE.PointsMaterial({
    color: 0xcfe0ff, size: 2, sizeAttenuation: false, fog: false,
    transparent: true, opacity: 0.85
  })));

  // Луна — квадратная, как в пиксель-арте
  const moon = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ map: glowTex(), transparent: true, fog: false })
  );
  moon.position.set(-30, 32, -110);
  moon.scale.set(2.2, 2.2, 1);
  scene.add(moon);

  return { dirLight, update: (_t: number) => { void _t; } };
}
