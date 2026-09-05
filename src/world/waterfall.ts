import * as THREE from 'three';
import { getGroundHeight, FALLS, POOL } from './ground';
import { makePixelWater } from './pixel';

export interface FallsRig {
  update: (t: number, dt: number) => void;
}

/**
 * Водопад с обрыва: бурлящая стена воды, пена и морось у подножия,
 * заводь и ручей к реке. Мелко — коллайдеров нет, можно бродить вброд.
 */
export function createWaterfall(scene: THREE.Scene): FallsRig {
  const waterTex = makePixelWater();
  waterTex.repeat.set(1, 2);

  // Стена падающей воды — лицом на запад (к игроку с тропы)
  const falls = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 6.2),
    new THREE.MeshBasicMaterial({ map: waterTex, transparent: true, opacity: 0.9, color: 0xaac4d8 })
  );
  falls.rotation.y = -Math.PI / 2;
  falls.rotation.z = 0.08;
  falls.position.set(FALLS.x, 2.55, FALLS.z);
  scene.add(falls);

  // Пена у подножия
  const foamTex = makePixelWater();
  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(1.6, 10),
    new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, opacity: 0.85, color: 0xd8e8f0 })
  );
  foam.rotation.x = -Math.PI / 2;
  const foamY = getGroundHeight(POOL.x, POOL.z) + 0.42;
  foam.position.set(POOL.x, foamY, POOL.z);
  scene.add(foam);

  // Морось — два мягких спрайта
  const mistTex = makePixelWater();
  const mists: THREE.Sprite[] = [];
  for (let i = 0; i < 2; i++) {
    const mist = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: mistTex, transparent: true, opacity: 0.3 - i * 0.1, depthWrite: false
      })
    );
    mist.scale.set(3 + i * 1.5, 2 + i, 1);
    mist.position.set(POOL.x - 1 + i, foamY + 1 + i * 0.7, POOL.z);
    scene.add(mist);
    mists.push(mist);
  }

  // Гладь заводи
  const poolWater = new THREE.Mesh(
    new THREE.CircleGeometry(POOL.r, 14),
    new THREE.MeshLambertMaterial({ map: makePixelWater(), transparent: true, opacity: 0.9, color: 0x8a9ab0 })
  );
  poolWater.rotation.x = -Math.PI / 2;
  poolWater.position.set(POOL.x, getGroundHeight(POOL.x, POOL.z) + 0.32, POOL.z);
  poolWater.receiveShadow = true;
  scene.add(poolWater);

  return {
    update: (t: number, dt: number) => {
      waterTex.offset.y -= dt * 1.4; // вода несется вниз
      foamTex.offset.x += dt * 0.4;
      foamTex.offset.y += dt * 0.23;
      mists.forEach((m, i) => {
        const s = 1 + Math.sin(t * 1.7 + i * 2.4) * 0.12;
        m.scale.set((3 + i * 1.5) * s, (2 + i) * s, 1);
      });
    }
  };
}
