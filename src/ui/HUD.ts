import { Container } from 'pixi.js';
import type { Camera } from '../core/Camera';
import type { EventBus } from '../core/EventBus';
import type { Tank } from '../entities/Tank';
import { EvolutionPanel } from './EvolutionPanel';
import { FreeCamBanner } from './FreeCamBanner';
import { GameOverModal } from './GameOverModal';
import { uiScale } from './hudMath';
import { KillToast } from './KillToast';
import { Leaderboard } from './Leaderboard';
import { MiniMap } from './MiniMap';
import { ScoreBar } from './ScoreBar';
import { StatUpgradePanel } from './StatUpgradePanel';

/**
 * 根 HUD 容器與管理器 (All-in-Canvas UI)
 * 統一管理屬性升級面板、轉職卡牌面板、經驗分數條、排行榜、小地圖、擊殺廣播、死亡結算與自由相機橫幅
 */
export class HUD {
  public readonly container = new Container();

  public readonly statPanel: StatUpgradePanel;
  public readonly evolutionPanel: EvolutionPanel;
  public readonly scoreBar = new ScoreBar();
  public readonly miniMap = new MiniMap();
  public readonly leaderboard = new Leaderboard();
  public readonly killToast = new KillToast();
  public readonly gameOverModal: GameOverModal;
  public readonly freeCamBanner = new FreeCamBanner();

  public visible = true;

  constructor(
    eventBus: EventBus,
    onRespawn?: () => void,
    onExitFreeCam?: () => void,
  ) {
    this.statPanel = new StatUpgradePanel(eventBus);
    this.evolutionPanel = new EvolutionPanel(eventBus);
    this.gameOverModal = new GameOverModal(onRespawn);
    this.freeCamBanner.onExit = onExitFreeCam ?? null;

    // 依層次添加至 HUD 根容器
    this.container.addChild(this.statPanel.container);
    this.container.addChild(this.evolutionPanel.container);
    this.container.addChild(this.scoreBar.container);
    this.container.addChild(this.miniMap.container);
    this.container.addChild(this.leaderboard.container);
    this.container.addChild(this.killToast.container);
    // 正式玩家版：完全禁用自由相機橫幅
    this.freeCamBanner.container.visible = false;
    this.container.addChild(this.gameOverModal.container);
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
    this.killToast.resize(screenWidth, screenHeight, scale);
    this.freeCamBanner.resize(screenWidth, screenHeight, scale);
    this.gameOverModal.resize(screenWidth, screenHeight, scale);
  }

  /**
   * 檢查螢幕座標是否落在任何 HUD 互動區域內 (供 InputManager 阻斷射擊)
   */
  public isOverUi(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    return (
      this.gameOverModal.containsPoint(screenX, screenY) ||
      this.evolutionPanel.containsPoint(screenX, screenY) ||
      this.statPanel.containsPoint(screenX, screenY) ||
      this.miniMap.containsPoint(screenX, screenY) ||
      this.freeCamBanner.containsPoint(screenX, screenY)
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
   * 處理滑鼠按下事件 (若點擊在轉職卡牌、屬性面板或自由相機橫幅上，觸發對應行為)
   */
  public handlePointerDown(screenX: number, screenY: number): boolean {
    if (!this.visible) return false;
    if (this.freeCamBanner.handlePointerDown(screenX, screenY)) {
      return true;
    }
    if (this.evolutionPanel.handlePointerDown(screenX, screenY)) {
      return true;
    }
    return this.statPanel.handlePointerDown(screenX, screenY);
  }

  /**
   * 每個渲染幀更新所有 HUD 元件 (包含排行榜與自由相機橫幅)
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

    if (this.gameOverModal.visible) {
      this.statPanel.container.visible = false;
      this.evolutionPanel.container.visible = false;
    } else {
      this.statPanel.update(playerTank);
      this.evolutionPanel.update(dtSeconds);
    }
    this.killToast.update(dtSeconds);
    this.freeCamBanner.update(camera);
    this.gameOverModal.update(dtSeconds);
    this.scoreBar.update(playerTank, dtSeconds);
    this.miniMap.update(playerTank, alpha, camera, allTanks);
    this.leaderboard.update(playerTank, allTanks ?? [playerTank]);
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
