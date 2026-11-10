import { Container, Text, TextStyle } from 'pixi.js';

/**
 * 擊殺浮動提示橫幅 (KillToast)
 * 當玩家擊殺敵方坦克時，於畫面頂部浮現光效加分廣播
 */
export class KillToast {
  public readonly container = new Container();
  private toastText: Text;
  private timer = 0;
  private duration = 1.8; // 顯示 1.8 秒

  constructor() {
    const style = new TextStyle({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 18,
      fontWeight: 'bold',
      fill: 0x00ff88,
      stroke: { width: 3, color: 0x0a1c12 },
      align: 'center',
    });

    this.toastText = new Text({ text: '', style });
    this.toastText.anchor.set(0.5, 0.5);
    this.container.addChild(this.toastText);
    this.container.visible = false;
  }

  public show(victimName: string, score: number): void {
    this.toastText.text = `Killed ${victimName}  (+${score.toLocaleString()} Score)`;
    this.timer = this.duration;
    this.container.visible = true;
    this.container.alpha = 1.0;
    this.container.y = 80;
  }

  public update(dtSeconds: number): void {
    if (!this.container.visible) return;

    this.timer -= dtSeconds;
    if (this.timer <= 0) {
      this.container.visible = false;
      return;
    }

    // 微微向上漂移並平滑淡出
    const progress = 1 - this.timer / this.duration;
    this.container.y = 80 - progress * 18;
    if (this.timer < 0.5) {
      this.container.alpha = this.timer / 0.5;
    } else {
      this.container.alpha = Math.min(1.0, (this.duration - this.timer) / 0.2);
    }
  }

  public resize(
    screenWidth: number,
    _screenHeight: number,
    scale: number,
  ): void {
    this.container.scale.set(scale);
    this.container.x = (screenWidth * 0.5) / scale;
  }
}
