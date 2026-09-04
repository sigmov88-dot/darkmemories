import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { createQuest, compassTo } from './quest';
import { SHARD_SPOTS, ALTAR_POS, PORTAL_POS } from '../world/landmarks';
import type { Ruins } from '../world/ruins';

function pressE(): void {
  const w = globalThis as unknown as {
    window: { __press: (code: string) => void };
  };
  w.window.__press('KeyE');
}

function mockRuins(): { ruins: Ruins; opened: () => boolean } {
  let open = false;
  const ruins = {
    setPortalOpen: (v: boolean) => {
      open = v;
    }
  } as unknown as Ruins;
  return { ruins, opened: () => open };
}

describe('quest flow', () => {
  it('полный путь: 5 осколков → алтарь → портал → победа', () => {
    const scene = new THREE.Scene();
    const { ruins, opened } = mockRuins();
    const quest = createQuest(scene, ruins);
    quest.start();
    const pp = new THREE.Vector3(0, 0, 26);
    let t = 0;
    const step = (x: number, z: number): boolean => {
      t += 0.016;
      pp.set(x, 0, z);
      return quest.update(0.016, t, pp, true);
    };

    for (const [sx, sz] of SHARD_SPOTS) {
      step(sx, sz);
      pressE();
      step(sx, sz);
    }
    expect(quest.collectedCount()).toBe(5);

    // алтарь: встаем на достижимую точку у круга (вне коллайдера алтаря)
    step(0, -14.5);
    pressE();
    const afterRitual = step(0, -14.5);
    expect(opened()).toBe(true);
    expect(afterRitual).toBe(false);

    const wonEvent = step(PORTAL_POS.x, PORTAL_POS.z);
    expect(wonEvent).toBe(true);
    // повторный update победы не дублирует
    expect(step(PORTAL_POS.x, PORTAL_POS.z)).toBe(false);
    expect(quest.elapsedActive()).toBeGreaterThan(0);
  });

  it('неактивное состояние не копит время и не собирает', () => {
    const scene = new THREE.Scene();
    const { ruins } = mockRuins();
    const quest = createQuest(scene, ruins);
    quest.start();
    const [sx, sz] = SHARD_SPOTS[0];
    const pp = new THREE.Vector3(sx, 0, sz);
    pressE();
    quest.update(0.016, 1, pp, false);
    expect(quest.collectedCount()).toBe(0);
    expect(quest.elapsedActive()).toBe(0);
  });
});

describe('compassTo', () => {
  it('8 румбов, север — это -z', () => {
    expect(compassTo(0, -10)).toBe('севере');
    expect(compassTo(10, -10)).toBe('северо-востоке');
    expect(compassTo(10, 0)).toBe('востоке');
    expect(compassTo(10, 10)).toBe('юго-востоке');
    expect(compassTo(0, 10)).toBe('юге');
    expect(compassTo(-10, 10)).toBe('юго-западе');
    expect(compassTo(-10, 0)).toBe('западе');
    expect(compassTo(-10, -10)).toBe('северо-западе');
  });
});
