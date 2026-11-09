import { Application, Container } from 'pixi.js';
import { COLOR_OUT_OF_BOUNDS } from '../config/constants';
import type { Camera } from '../core/Camera';

/**
 * Pixi.js v8 畫布主渲染器
 * 分層結構：WorldContainer（受相機跟隨與縮放）與 HUDContainer（固定螢幕座標）
 */
export class Renderer {
  public readonly app = new Application();
  public readonly worldContainer = new Container();
  public readonly hudContainer = new Container();

  /**
   * 初始化 Pixi v8 應用程式並掛載至指定 DOM
   * @param targetElement 掛載目標 HTML 容器元素
   */
  public async init(targetElement: HTMLElement): Promise<void> {
    await this.app.init({
      preference: 'webgl',
      resizeTo: window,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
      backgroundColor: COLOR_OUT_OF_BOUNDS,
      antialias: true,
    });

    targetElement.appendChild(this.app.canvas);

    this.app.stage.addChild(this.worldContainer);
    this.app.stage.addChild(this.hudContainer);
  }

  /**
   * 依照相機的位置與縮放係數更新 WorldContainer
   * @param camera 遊戲相機
   */
  public updateCamera(camera: Camera): void {
    const scale = camera.scale;
    this.worldContainer.scale.set(scale);

    const screenCenterX = camera.screenWidth * 0.5;
    const screenCenterY = camera.screenHeight * 0.5;

    this.worldContainer.position.set(
      screenCenterX - camera.x * scale,
      screenCenterY - camera.y * scale,
    );
  }

  public destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
