import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { Camera } from '../core/Camera';

/**
 * 自由相機頂部提示橫幅與一鍵退出按鈕 (FreeCamBanner)
 * 當自由相機模式啟動時顯示於螢幕頂端中央，提供直觀快捷操作指引與退出按鈕。
 * 遵循 All-in-Canvas UI 與零 GC 原則。
 */
export class FreeCamBanner {
  public readonly container = new Container();

  private readonly bgGraphics = new Graphics();
  private readonly infoText: Text;
  private readonly exitBtnText: Text;

  public onExit: (() => void) | null = null;

  // 螢幕 AABB 邊界（供 containsPoint 與點擊判定）
  private screenX = 0;
  private screenY = 0;
  private totalWidth = 520;
  private totalHeight = 36;
  private lastZoom = -1;

  constructor() {
    this.container.addChild(this.bgGraphics);

    const infoStyle = new TextStyle({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0xffffff,
      stroke: { width: 2, color: 0x0a1c12 },
    });

    const exitBtnStyle = new TextStyle({
      fontFamily:
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: 13,
      fontWeight: 'bold',
      fill: 0x00f0ff,
      stroke: { width: 2, color: 0x003344 },
    });

    this.infoText = new Text({ text: '', style: infoStyle });
    this.infoText.anchor.set(0, 0.5);
    this.infoText.position.set(16, this.totalHeight * 0.5);

    this.exitBtnText = new Text({
      text: '[ 退出自由相機 (C) ]',
      style: exitBtnStyle,
    });
    this.exitBtnText.anchor.set(1, 0.5);
    this.exitBtnText.position.set(this.totalWidth - 14, this.totalHeight * 0.5);

    this.container.addChild(this.infoText);
    this.container.addChild(this.exitBtnText);
    this.container.visible = false;
  }

  public update(camera: Camera): void {
    if (!camera.isFreeCam) {
      this.container.visible = false;
      return;
    }

    this.container.visible = true;

    if (Math.abs(this.lastZoom - camera.freeCamZoom) > 0.01) {
      this.lastZoom = camera.freeCamZoom;
      this.infoText.text = `📷 自由相機 (${camera.freeCamZoom.toFixed(1)}x) | WASD/拖曳平移 | 滾輪縮放 | 點小地圖跳轉`;

      // 重繪背景
      this.bgGraphics.clear();
      // 半透明深青黑底色
      this.bgGraphics
        .roundRect(0, 0, this.totalWidth, this.totalHeight, 8)
        .fill({ color: 0x0d1b2a, alpha: 0.88 })
        .stroke({ color: 0x00f0ff, width: 1.8 });

      // 退出按鈕微光背景
      this.bgGraphics
        .roundRect(this.totalWidth - 165, 4, 155, this.totalHeight - 8, 6)
        .fill({ color: 0x00f0ff, alpha: 0.15 })
        .stroke({ color: 0x00f0ff, width: 1.2, alpha: 0.6 });
    }
  }

  public resize(
    screenWidth: number,
    _screenHeight: number,
    scale: number,
  ): void {
    this.container.scale.set(scale);
    const renderW = this.totalWidth * scale;
    this.screenX = (screenWidth - renderW) * 0.5;
    this.screenY = 16 * scale;
    this.container.position.set(this.screenX, this.screenY);
  }

  public containsPoint(screenX: number, screenY: number): boolean {
    if (!this.container.visible) return false;
    const s = this.container.scale.x;
    return (
      screenX >= this.screenX &&
      screenX <= this.screenX + this.totalWidth * s &&
      screenY >= this.screenY &&
      screenY <= this.screenY + this.totalHeight * s
    );
  }

  public handlePointerDown(screenX: number, screenY: number): boolean {
    if (!this.containsPoint(screenX, screenY)) return false;
    this.onExit?.();
    return true;
  }
}
