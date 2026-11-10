import { Container, Graphics } from 'pixi.js';
import {
  BASE_TANK_RADIUS,
  COLOR_BARREL_GRAY,
  COLOR_STROKE,
  COLOR_TANK_BLUE,
  STROKE_WIDTH,
} from '../config/constants';
import {
  BASIC_TANK_DEFINITION,
  type TankDefinition,
} from '../config/tanks.config';

/**
 * 坦克渲染器 (支援 Tier 1 ~ Tier 3 多砲管幾何與喇叭口)
 * 結構：底盤圓形 + 動態多砲管幾何 (平行雙管、前後背向管、喇叭口) + 描邊
 * 砲管朝向角度在每一渲染幀依滑鼠即時更新
 */
export class TankRenderer {
  public readonly container = new Container();

  private readonly barrelContainer = new Container();
  private readonly barrelGraphics = new Graphics();
  private readonly bodyGraphics = new Graphics();

  private currentClassId = '';
  private chassisColor: number = COLOR_TANK_BLUE;

  constructor(
    definition: TankDefinition = BASIC_TANK_DEFINITION,
    color: number = COLOR_TANK_BLUE,
  ) {
    this.chassisColor = color;
    this.barrelContainer.addChild(this.barrelGraphics);
    this.container.addChild(this.barrelContainer);
    this.container.addChild(this.bodyGraphics);

    this.setDefinition(definition, BASE_TANK_RADIUS, color);
  }

  /**
   * 切換坦克職業定義與底盤色彩，重新構建砲管多邊形幾何
   * （僅在轉職或重設時執行一次，熱路徑零配置）
   */
  public setDefinition(
    definition: TankDefinition,
    radius = BASE_TANK_RADIUS,
    color: number = this.chassisColor,
  ): void {
    if (this.currentClassId === definition.id && this.chassisColor === color) {
      return;
    }
    this.currentClassId = definition.id;
    this.chassisColor = color;

    // 1. 繪製所有砲管
    this.barrelGraphics.clear();
    const barrels = definition.barrels;
    const count = barrels.length;

    for (let b = 0; b < count; b++) {
      const barrel = barrels[b];
      const L = barrel.length;
      const wBase = barrel.width;
      const wTip = barrel.tipWidth ?? barrel.width;
      const theta = barrel.angle;
      const ox = barrel.offsetX;
      const oy = barrel.offsetY;

      const cos = Math.cos(theta);
      const sin = Math.sin(theta);

      // 未旋轉座標下的四個頂點 (自底座向砲口)
      // p0: 底座左邊緣 (0, -wBase / 2)
      // p1: 砲口左邊緣 (L, -wTip / 2)
      // p2: 砲口右邊緣 (L, wTip / 2)
      // p3: 底座右邊緣 (0, wBase / 2)
      const x0 = 0;
      const y0 = -wBase * 0.5;
      const x1 = L;
      const y1 = -wTip * 0.5;
      const x2 = L;
      const y2 = wTip * 0.5;
      const x3 = 0;
      const y3 = wBase * 0.5;

      const pts = [
        x0 * cos - y0 * sin + ox,
        x0 * sin + y0 * cos + oy,
        x1 * cos - y1 * sin + ox,
        x1 * sin + y1 * cos + oy,
        x2 * cos - y2 * sin + ox,
        x2 * sin + y2 * cos + oy,
        x3 * cos - y3 * sin + ox,
        x3 * sin + y3 * cos + oy,
      ];

      this.barrelGraphics
        .poly(pts)
        .fill({ color: COLOR_BARREL_GRAY })
        .stroke({ color: COLOR_STROKE, width: STROKE_WIDTH });
    }

    // 2. 繪製坦克圓形底盤
    this.bodyGraphics.clear();
    this.bodyGraphics
      .circle(0, 0, radius)
      .fill({ color: this.chassisColor })
      .stroke({ color: COLOR_STROKE, width: STROKE_WIDTH });
  }

  /**
   * 渲染幀更新顯示位置、砲管朝向與體型縮放
   * @param renderX 插值後的坦克世界 X 座標
   * @param renderY 插值後的坦克世界 Y 座標
   * @param aimAngle 本渲染幀滑鼠相對於坦克的角度（弧度）
   * @param scale 坦克體型縮放倍率（預設 1.0）
   */
  public update(
    renderX: number,
    renderY: number,
    aimAngle: number,
    scale = 1.0,
  ): void {
    this.container.position.set(renderX, renderY);
    this.container.scale.set(scale, scale);
    this.barrelContainer.rotation = aimAngle;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
