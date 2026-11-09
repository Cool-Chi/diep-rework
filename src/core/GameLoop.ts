/**
 * 基於 requestAnimationFrame 的遊戲主循環
 */
export class GameLoop {
  private isRunning = false;
  private lastTime = 0;
  private animFrameId: number | null = null;
  private readonly callback: (dtSeconds: number) => void;

  constructor(callback: (dtSeconds: number) => void) {
    this.callback = callback;
    this.frame = this.frame.bind(this);
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.animFrameId = requestAnimationFrame(this.frame);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private frame(time: number): void {
    if (!this.isRunning) return;

    const dtSeconds = Math.max(0, (time - this.lastTime) / 1000);
    this.lastTime = time;

    this.callback(dtSeconds);

    this.animFrameId = requestAnimationFrame(this.frame);
  }
}
