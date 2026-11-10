import { Container } from 'pixi.js';
import type { Camera, VisibleBounds } from '../core/Camera';
import type { EventBus } from '../core/EventBus';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import { HealthBars } from './HealthBars';
import { uiScale } from './hudMath';
import { MiniMap } from './MiniMap';
import { ScoreBar } from './ScoreBar';
import { StatUpgradePanel } from './StatUpgradePanel';

/**
 * 根 HUD 容器與管理器 (All-in-Canvas UI)
 * 統一管理屬性升級面板、經驗分數條、動態實體血條與小地圖
 */
export class HUD {
  public readonly container = new Container();

  public readonly statPanel: StatUpgradePanel;
  public readonly scoreBar = new ScoreBar();
  public readonly healthBars = new HealthBars();
  public readonly miniMap = new MiniMap();

  public visible = true;

  constructor(eventBus: EventBus) {
    this.statPanel = new StatUpgradePanel(eventBus);

    // 依層次添加至 HUD 根容器
    // 順序：血條在底層，屬性面板、分數條、小地圖在上層
    this.container.addChild(this.healthBars.container);
    this.container.addChild(this.statPanel.container);
    this.container.addChild(this.scoreBar.container);
    this.container.addChild(this.miniMap.container);
  }

  /**
   * 螢幕大小改變時重新排版所有 HUD 元件
   */
  public resize(screenWidth: number, screenHeight: number): void {
    const scale = uiScale(screenWidth, screenHeight);
    this.statPanel.resize(screenWidth, screenHeight, scale);
    this.scoreBar.resize(screenWidth, screenHeight, scale);
    this.miniMap.resize(screenWidth, screenHeight, scale);
  }

  /**
   * 檢查螢幕座標是否落在任何 HUD 互動區域內 (供 InputManager 阻斷射擊)
   */
  public isOverUi(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    return (
      this.statPanel.containsPoint(screenX, screenY) ||
      this.miniMap.containsPoint(screenX, screenY)
    );
  }

  /**
   * 處理滑鼠按下事件 (若點擊在屬性面板的 + 上，觸發升級)
   */
  public handlePointerDown(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    return this.statPanel.handlePointerDown(screenX, screenY);
  }

  /**
   * 每個渲染幀更新所有 HUD 元件
   */
  public update(
    playerTank: Tank,
    allTanks: Tank[],
    shapes: Shape[],
    camera: Camera,
    dtSeconds: number,
    visibleBounds: VisibleBounds,
  ): void {
    this.container.visible = this.visible;
    if (!this.visible) return;

    this.statPanel.update(playerTank);
    this.scoreBar.update(playerTank, dtSeconds);
    this.healthBars.update(allTanks, shapes, camera, visibleBounds);
    this.miniMap.update(playerTank, camera);
  }

  public destroy(): void {
    this.healthBars.destroy();
    this.container.destroy({ children: true });
  }
}
