import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../core/Camera';
import type { Tank } from '../entities/Tank';
import {
  getRenderPosition,
  type RenderPositionOut,
} from '../rendering/getRenderPosition';
import { worldToMinimap } from './hudMath';
import {
  MINIMAP_BG_ALPHA,
  MINIMAP_BG_COLOR,
  MINIMAP_BORDER_COLOR,
  MINIMAP_PLAYER_COLOR,
  MINIMAP_VIEWPORT_COLOR,
} from './labels';
import { BASE_MARGIN, BASE_MINIMAP_SIZE } from './layout';

export interface Point2D {
  x: number;
  y: number;
}

/**
 * 右下角小地圖 (MiniMap)
 * 映射 4000x4000 世界邊界、相機可視視野矩形與玩家位置點
 * 預留 M5 機器人點位擴展介面
 */
export class MiniMap {
  public readonly container = new Container();

  private readonly bgGraphics = new Graphics();
  private readonly viewportGraphics = new Graphics();
  private readonly playerGraphics = new Graphics();
  private readonly aiGraphics = new Graphics();

  public mapSize = BASE_MINIMAP_SIZE;
  public screenX = 0;
  public screenY = 0;
  public screenWidth = 0;
  public screenHeight = 0;

  constructor() {
    this.container.addChild(this.bgGraphics);
    this.container.addChild(this.viewportGraphics);
    this.container.addChild(this.aiGraphics);
    this.container.addChild(this.playerGraphics);
  }

  /**
   * 重新計算螢幕座標佈局 (Resize 時呼叫)
   */
  public resize(
    screenWidth: number,
    screenHeight: number,
    scale: number,
  ): void {
    const size = BASE_MINIMAP_SIZE * scale;
    const margin = BASE_MARGIN * scale;

    this.mapSize = BASE_MINIMAP_SIZE; // 局部設計大小
    this.screenX = screenWidth - size - margin;
    this.screenY = screenHeight - size - margin;
    this.screenWidth = size;
    this.screenHeight = size;

    this.container.position.set(this.screenX, this.screenY);
    this.container.scale.set(scale, scale);

    // 背景只在尺寸變動時重繪一次
    this.bgGraphics.clear();
    this.bgGraphics
      .rect(0, 0, this.mapSize, this.mapSize)
      .fill({ color: MINIMAP_BG_COLOR, alpha: MINIMAP_BG_ALPHA })
      .stroke({ color: MINIMAP_BORDER_COLOR, width: 2 });
  }

  private readonly tempPlayerPos: RenderPositionOut = { x: 0, y: 0 };

  /**
   * 每個渲染幀更新玩家位置與相機視野框（使用插值世界座標與當幀相機狀態）
   * @param playerTank 玩家坦克實體
   * @param alpha 插值係數
   * @param camera 當前相機（已完成當幀 update）
   */
  public update(playerTank: Tank, alpha: number, camera: Camera): void {
    const mapSize = this.mapSize;

    // 1. 繪製相機視野框（使用當幀最新相機可視邊界）
    const bounds = camera.getVisibleBounds();
    const pMin = worldToMinimap(bounds.minX, bounds.minY, mapSize);
    const pMax = worldToMinimap(bounds.maxX, bounds.maxY, mapSize);

    this.viewportGraphics.clear();
    const vpW = Math.max(2, pMax.x - pMin.x);
    const vpH = Math.max(2, pMax.y - pMin.y);
    this.viewportGraphics
      .rect(pMin.x, pMin.y, vpW, vpH)
      .stroke({ color: MINIMAP_VIEWPORT_COLOR, width: 1.2, alpha: 0.7 });

    // 2. 繪製玩家所在點 (藍色圓點，使用插值渲染位置)
    getRenderPosition(playerTank, alpha, this.tempPlayerPos);
    const pPlayer = worldToMinimap(
      this.tempPlayerPos.x,
      this.tempPlayerPos.y,
      mapSize,
    );
    this.playerGraphics.clear();
    this.playerGraphics
      .circle(pPlayer.x, pPlayer.y, 3)
      .fill({ color: MINIMAP_PLAYER_COLOR });
  }

  /**
   * 預留 M5 加入 AI 機器人位置點介面 (M3b 暫不繪製)
   */
  public updateAIPositions(_positions: Point2D[]): void {
    // M3b 留空，M5 時擴展
  }

  /**
   * 檢查螢幕座標是否落在小地圖範圍內 (供 isOverUi 使用)
   */
  public containsPoint(screenX: number, screenY: number): boolean {
    return (
      screenX >= this.screenX &&
      screenX <= this.screenX + this.screenWidth &&
      screenY >= this.screenY &&
      screenY <= this.screenY + this.screenHeight
    );
  }
}
