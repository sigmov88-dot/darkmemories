/** Простое состояние клавиатуры для WASD-бега */
export class Input {
  private keys = new Set<string>();

  init(): void {
    window.addEventListener('keydown', (e) => this.keys.add(e.code));
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  get forward(): number {
    let v = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) v += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) v -= 1;
    return v;
  }

  get strafe(): number {
    let v = 0;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) v += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) v -= 1;
    return v;
  }

  get run(): boolean {
    return this.isDown('ShiftLeft') || this.isDown('ShiftRight');
  }
}
