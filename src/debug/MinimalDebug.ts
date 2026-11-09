/**
 * 最小化除錯資訊顯示器（僅在 DEV 開發環境下動態啟動）
 * 即時顯示 FPS、實際 TPS 模擬頻率、坦克世界座標與當前速度
 */
export class MinimalDebug {
  private element: HTMLDivElement | null = null;
  private frameCount = 0;
  private tickCount = 0;
  private lastTime = performance.now();
  private currentFps = 0;
  private currentTps = 0;

  constructor() {
    this.createOverlay();
  }

  private createOverlay(): void {
    const el = document.createElement('div');
    el.style.position = 'fixed';
    el.style.top = '10px';
    el.style.left = '10px';
    el.style.padding = '6px 12px';
    el.style.backgroundColor = 'rgba(0, 0, 0, 0.65)';
    el.style.color = '#00ffcc';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '12px';
    el.style.borderRadius = '4px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '99999';
    el.style.lineHeight = '1.4';
    el.textContent = 'Initializing Debug Overlay...';

    document.body.appendChild(el);
    this.element = el;
  }

  /**
   * 每次模擬 tick 呼叫一次，統計實際 TPS
   */
  public recordTick(): void {
    this.tickCount++;
  }

  /**
   * 每個渲染幀呼叫一次，統計 FPS 並更新顯示文字
   */
  public update(
    tankX: number,
    tankY: number,
    tankVx: number,
    tankVy: number,
  ): void {
    this.frameCount++;
    const now = performance.now();
    const elapsed = now - this.lastTime;

    if (elapsed >= 500) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.currentTps = Math.round((this.tickCount * 1000) / elapsed);
      this.frameCount = 0;
      this.tickCount = 0;
      this.lastTime = now;
    }

    if (this.element) {
      const speed = Math.sqrt(tankVx * tankVx + tankVy * tankVy).toFixed(2);
      this.element.textContent = `FPS: ${this.currentFps} | TPS: ${this.currentTps}\nPos: (${tankX.toFixed(1)}, ${tankY.toFixed(1)})\nSpeed: ${speed} u/tick`;
    }
  }

  public destroy(): void {
    if (this.element?.parentNode) {
      this.element.parentNode.removeChild(this.element);
      this.element = null;
    }
  }
}
