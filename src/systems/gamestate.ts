/**
 * Единая машина состояний игры. Инварианты:
 * - dead и won взаимоисключающи по построению (только playing переходит в них);
 * - квест/враги/таймер работают только в playing;
 * - выход из lock в playing всегда ведет в paused, а не в intro.
 */
export type GamePhase = 'intro' | 'playing' | 'paused' | 'dead' | 'won';

const PHASES: GamePhase[] = ['intro', 'playing', 'paused', 'dead', 'won'];

export class GameState {
  phase: GamePhase = 'intro';

  get playing(): boolean {
    return this.phase === 'playing';
  }

  onLock(): void {
    if (this.phase === 'intro' || this.phase === 'paused' || this.phase === 'dead') {
      this.phase = 'playing';
    }
  }

  onUnlock(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
    }
  }

  die(): void {
    if (this.phase === 'playing') {
      this.phase = 'dead';
    }
  }

  win(): void {
    if (this.phase === 'playing') {
      this.phase = 'won';
    }
  }

  /** Синхронизировать CSS-классы body с фазой (для оверлеев). */
  syncBody(body: { classList: { remove(...c: string[]): void; add(c: string): void } }): void {
    body.classList.remove(...PHASES);
    body.classList.add(this.phase);
  }
}
