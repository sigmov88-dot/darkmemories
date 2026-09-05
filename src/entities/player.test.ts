import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Player } from './player';
import { Input } from '../core/input';
import { CollisionWorld } from '../systems/collision';

function makePlayer(): Player {
  const camera = new THREE.PerspectiveCamera();
  const scene = new THREE.Scene();
  return new Player(camera, {} as HTMLElement, scene, new Input(), new CollisionWorld());
}

describe('godmode', () => {
  it('бессмертие игнорит урон и держит полное HP', () => {
    const p = makePlayer();
    p.dev.god = true;
    expect(p.damage(5)).toBe('ignored');
    expect(p.hpNow()).toBe(p.hpMax());
  });

  it('без годмода урон проходит как обычно', () => {
    const p = makePlayer();
    expect(p.damage(1)).toBe('hit');
    expect(p.hpNow()).toBe(p.hpMax() - 1);
  });
});
