/** Минимальный FPS-метр без внешних зависимостей */
export class FpsMeter {
  private acc = 0;
  private frames = 0;
  private el: HTMLElement | null;
  private posEl: HTMLElement | null;

  constructor() {
    this.el = document.getElementById('fps');
    this.posEl = document.getElementById('pos');
  }

  update(dt: number, x?: number, z?: number): void {
    this.acc += dt;
    this.frames++;
    if (this.acc >= 0.5) {
      const fps = Math.round(this.frames / this.acc);
      if (this.el) {
        this.el.textContent = `${fps} fps`;
        this.el.style.color = fps >= 50 ? 'rgba(140,200,140,0.7)' : fps >= 30 ? 'rgba(220,190,100,0.8)' : 'rgba(220,100,80,0.9)';
      }
      this.acc = 0;
      this.frames = 0;
    }
    if (this.posEl && x !== undefined && z !== undefined && this.frames % 10 === 0) {
      this.posEl.textContent = `${x.toFixed(1)}, ${z.toFixed(1)}`;
    }
  }
}
