import { Container, Graphics } from 'pixi.js';
import {
  BASE_BARREL_LENGTH,
  BASE_BARREL_WIDTH,
  BASE_TANK_RADIUS,
  COLOR_BARREL_GRAY,
  COLOR_STROKE,
  COLOR_TANK_BLUE,
  STROKE_WIDTH,
} from '../config/constants';

/**
 * 基礎坦克渲染器
 * 結構：底盤圓形 + 矩形砲管 + 加厚描邊
 * 砲管朝向角度在每一渲染幀依滑鼠實時更新（確保極致跟手感）
 */
export class TankRenderer {
  public readonly container = new Container();

  private readonly barrelContainer = new Container();
  private readonly barrelGraphics = new Graphics();
  private readonly bodyGraphics = new Graphics();

  constructor(radius = BASE_TANK_RADIUS) {
    // 1. 建立砲管幾何（自中心向右延伸，置於圓形本體下方）
    this.barrelGraphics
      .rect(0, -BASE_BARREL_WIDTH / 2, BASE_BARREL_LENGTH, BASE_BARREL_WIDTH)
      .fill({ color: COLOR_BARREL_GRAY })
      .stroke({ color: COLOR_STROKE, width: STROKE_WIDTH });
    this.barrelContainer.addChild(this.barrelGraphics);
    this.container.addChild(this.barrelContainer);

    // 2. 建立坦克圓形底盤幾何
    this.bodyGraphics
      .circle(0, 0, radius)
      .fill({ color: COLOR_TANK_BLUE })
      .stroke({ color: COLOR_STROKE, width: STROKE_WIDTH });
    this.container.addChild(this.bodyGraphics);
  }

  /**
   * 渲染幀更新顯示位置與砲管朝向
   * @param renderX 插值後的坦克世界 X 座標
   * @param renderY 插值後的坦克世界 Y 座標
   * @param aimAngle 本渲染幀滑鼠相對於坦克的角度（弧度）
   */
  public update(renderX: number, renderY: number, aimAngle: number): void {
    this.container.position.set(renderX, renderY);
    this.barrelContainer.rotation = aimAngle;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
