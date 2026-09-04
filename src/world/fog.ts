import * as THREE from 'three';

export interface FogRig {
  update: (t: number, dt: number) => void;
}

/**
 * Туман v2 — БЕЗ мутных карточек на весь экран.
 * Только низкая дымка у земли + угли. Карточек мало, opacity низкая.
 */
export function createGroundFog(scene: THREE.Scene): FogRig {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 16;
  const ctx = c.getContext('2d')!;
  const grd = ctx.createLinearGradient(0, 0, 64, 0);
  grd.addColorStop(0, 'rgba(140,160,200,0)');
  grd.addColorStop(0.5, 'rgba(140,160,200,0.5)');
  grd.addColorStop(1, 'rgba(140,160,200,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, 64, 16);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;

  const cards: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 1.4),
      new THREE.MeshBasicMaterial({
        map: tex, transparent: true, depthWrite: false,
        opacity: 0.16, fog: false, side: THREE.DoubleSide
      })
    );
    m.position.set(((i * 37) % 40) - 20, 0.45, -20 + ((i * 23) % 36));
    m.userData.speed = 0.2 + (i % 4) * 0.1;
    scene.add(m);
    cards.push(m);
  }

  // Угли — пиксельные точки
  const COUNT = 150;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = ((i * 41) % 40) - 20;
    pos[i * 3 + 1] = (i % 20) / 6 + 0.2;
    pos[i * 3 + 2] = 8 - ((i * 29) % 30);
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const points = new THREE.Points(
    pGeo,
    new THREE.PointsMaterial({
      color: 0xff9a4a, size: 0.09, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
    })
  );
  scene.add(points);

  return {
    update: (t: number, dt: number) => {
      for (const m of cards) {
        m.position.x += dt * m.userData.speed;
        if (m.position.x > 24) m.position.x = -24;
        m.lookAt(m.position.x, 0.45, 30); // всегда лицом к игроку по оси
      }
      const p = pGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < COUNT; i++) {
        let y = p.getY(i) + dt * (0.3 + (i % 5) * 0.1);
        if (y > 4.5) y = 0.15;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t + i) * dt * 0.15);
      }
      p.needsUpdate = true;
    }
  };
}
