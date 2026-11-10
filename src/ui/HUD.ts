import { Container } from 'pixi.js';
import type { Camera } from '../core/Camera';
import type { EventBus } from '../core/EventBus';
import type { Tank } from '../entities/Tank';
import { EvolutionPanel } from './EvolutionPanel';
import { uiScale } from './hudMath';
import { Leaderboard } from './Leaderboard';
import { MiniMap } from './MiniMap';
import { ScoreBar } from './ScoreBar';
import { StatUpgradePanel } from './StatUpgradePanel';

/**
 * 根 HUD 容器與管理器 (All-in-Canvas UI)
 * 統一管理屬性升級面板、轉職卡牌面板、經驗分數條、排行榜與小地圖
 */
export class HUD {
  public readonly container = new Container();

  public readonly statPanel: StatUpgradePanel;
  public readonly evolutionPanel: EvolutionPanel;
  public readonly scoreBar = new ScoreBar();
  public readonly miniMap = new MiniMap();
  public readonly leaderboard = new Leaderboard();

  public visible = true;

  constructor(eventBus: EventBus) {
    this.statPanel = new StatUpgradePanel(eventBus);
    this.evolutionPanel = new EvolutionPanel(eventBus);

    // 依層次添加至 HUD 根容器（轉職面板在左上、屬性在左下、分數在底中、小地圖在右下、排行榜在右上）
    this.container.addChild(this.statPanel.container);
    this.container.addChild(this.evolutionPanel.container);
    this.container.addChild(this.scoreBar.container);
    this.container.addChild(this.miniMap.container);
    this.container.addChild(this.leaderboard.container);
  }

  /**
   * 螢幕大小改變時重新排版所有 HUD 元件
   */
  public resize(screenWidth: number, screenHeight: number): void {
    const scale = uiScale(screenWidth, screenHeight);
    this.statPanel.resize(screenWidth, screenHeight, scale);
    this.evolutionPanel.resize(scale);
    this.scoreBar.resize(screenWidth, screenHeight, scale);
    this.miniMap.resize(screenWidth, screenHeight, scale);
    this.leaderboard.resize(screenWidth, screenHeight, scale);
  }

  /**
   * 檢查螢幕座標是否落在任何 HUD 互動區域內 (供 InputManager 阻斷射擊)
   */
  public isOverUi(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    return (
      this.evolutionPanel.containsPoint(screenX, screenY) ||
      this.statPanel.containsPoint(screenX, screenY) ||
      this.miniMap.containsPoint(screenX, screenY)
    );
  }

  /**
   * 處理滑鼠移動事件 (卡牌懸停與靠近喚出)
   */
  public handlePointerMove(screenX: number, screenY: number): void {
    if (!this.visible) return;
    this.evolutionPanel.handlePointerMove(screenX, screenY);
  }

  /**
   * 處理滑鼠按下事件 (若點擊在轉職卡牌或屬性面板的 + 上，觸發對應行為)
   */
  public handlePointerDown(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    if (this.evolutionPanel.handlePointerDown(screenX, screenY)) {
      return true;
    }
    return this.statPanel.handlePointerDown(screenX, screenY);
  }

  /**
   * 每個渲染幀更新所有 HUD 元件 (包含排行榜)
   */
  public update(
    playerTank: Tank,
    alpha: number,
    camera: Camera,
    dtSeconds: number,
    allTanks?: Tank[],
  ): void {
    this.container.visible = this.visible;
    if (!this.visible) return;

    this.statPanel.update(playerTank);
    this.evolutionPanel.update(dtSeconds);
    this.scoreBar.update(playerTank, dtSeconds);
    this.miniMap.update(playerTank, alpha, camera, allTanks);
    this.leaderboard.update(playerTank, allTanks ?? [playerTank]);
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
