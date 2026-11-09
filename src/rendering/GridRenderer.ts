import type { Application } from 'pixi.js';
import { Container, Graphics, type Texture, TilingSprite } from 'pixi.js';
import {
  COLOR_BORDER_LINE,
  COLOR_GRID_BACKGROUND,
  COLOR_GRID_LINES,
  COLOR_OUT_OF_BOUNDS,
  GRID_SIZE,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../config/constants';

/**
 * 網格地圖渲染器
 * 使用預烘焙貼圖的 TilingSprite 與邊界遮罩，避免每幀重畫幾何圖形
 */
export class GridRenderer {
  public readonly container = new Container();

  private outOfBoundsBg = new Graphics();
  private tilingGrid: TilingSprite | null = null;
  private borderLine = new Graphics();

  /**
   * 初始化網格與邊界圖形
   * @param app Pixi.js Application 實例
   */
  public init(app: Application): void {
    // 1. 建立廣域邊界外深灰色底圖（覆蓋地圖周圍極大範圍）
    const padding = 3000;
    this.outOfBoundsBg
      .rect(
        -padding,
        -padding,
        WORLD_WIDTH + padding * 2,
        WORLD_HEIGHT + padding * 2,
      )
      .fill({ color: COLOR_OUT_OF_BOUNDS });
    this.container.addChild(this.outOfBoundsBg);

    // 2. 烘焙單一 25x25 網格貼圖 (1 背景格 = 25 世界單位)
    const tileGraphic = new Graphics()
      .rect(0, 0, GRID_SIZE, GRID_SIZE)
      .fill({ color: COLOR_GRID_BACKGROUND })
      // 繪製底部與右側線條構成網格（線條寬度 1 像素）
      .rect(0, GRID_SIZE - 1, GRID_SIZE, 1)
      .fill({ color: COLOR_GRID_LINES })
      .rect(GRID_SIZE - 1, 0, 1, GRID_SIZE)
      .fill({ color: COLOR_GRID_LINES });

    const gridTexture: Texture = app.renderer.generateTexture({
      target: tileGraphic,
      resolution: 1,
    });
    tileGraphic.destroy();

    // 3. 建立 4000x4000 封閉地圖的 TilingSprite
    this.tilingGrid = new TilingSprite({
      texture: gridTexture,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
    });
    this.tilingGrid.position.set(0, 0);
    this.container.addChild(this.tilingGrid);

    // 4. 繪製 4000x4000 邊界深色邊框線
    this.borderLine
      .rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      .stroke({ color: COLOR_BORDER_LINE, width: 4 });
    this.container.addChild(this.borderLine);
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
