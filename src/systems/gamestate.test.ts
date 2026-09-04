import { describe, it, expect } from 'vitest';
import { GameState } from './gamestate';

describe('GameState', () => {
  it('начинается с intro', () => {
    expect(new GameState().phase).toBe('intro');
  });

  it('lock ведет intro/paused/dead в playing', () => {
    const s = new GameState();
    s.onLock();
    expect(s.phase).toBe('playing');
    s.onUnlock();
    expect(s.phase).toBe('paused');
    s.onLock();
    expect(s.phase).toBe('playing');
  });

  it('unlock вне playing ничего не меняет', () => {
    const s = new GameState();
    s.onUnlock();
    expect(s.phase).toBe('intro');
  });

  it('dead и won взаимоисключающи', () => {
    const a = new GameState();
    a.onLock();
    a.die();
    expect(a.phase).toBe('dead');
    a.win(); // победа после смерти невозможна
    expect(a.phase).toBe('dead');

    const b = new GameState();
    b.onLock();
    b.win();
    expect(b.phase).toBe('won');
    b.die(); // смерть после победы невозможна
    expect(b.phase).toBe('won');
  });

  it('die/win работают только из playing', () => {
    const s = new GameState();
    s.die();
    expect(s.phase).toBe('intro');
    s.win();
    expect(s.phase).toBe('intro');
  });

  it('syncBody выставляет ровно один класс фазы', () => {
    const s = new GameState();
    const classes = new Set<string>(['intro']);
    const body = {
      classList: {
        remove: (...cs: string[]) => cs.forEach((c) => classes.delete(c)),
        add: (c: string) => classes.add(c)
      }
    };
    s.onLock();
    s.syncBody(body);
    expect(classes.has('playing')).toBe(true);
    expect(classes.has('intro')).toBe(false);
  });
});
