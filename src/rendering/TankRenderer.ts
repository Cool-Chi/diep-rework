import { Container, Graphics } from 'pixi.js';
import {
  BASE_TANK_RADIUS,
  COLOR_BARREL_GRAY,
  COLOR_STROKE,
  COLOR_TANK_BLUE,
  MAX_TANK_BARRELS,
  STROKE_WIDTH,
} from '../config/constants';
import {
  BASIC_TANK_DEFINITION,
  type TankDefinition,
} from '../config/tanks.config';

interface BarrelSlot {
  container: Container;
  graphics: Graphics;
}

/**
 * 坦克渲染器 (支援 Tier 1 ~ Tier 4 多砲管幾何、喇叭口與動態開火後座力收縮動畫)
 * 結構：底盤圓形 + 各砲管獨立子容器 (局部 X 軸偏移退縮動畫) + 恆定 3.0px 描邊
 * 砲管朝向角度在每一渲染幀依滑鼠或 AI 平滑角度即時更新
 */
export class TankRenderer {
  public readonly container = new Container();

  private readonly barrelContainer = new Container();
  private readonly barrelSlots: BarrelSlot[] = [];
  private readonly bodyGraphics = new Graphics();

  private currentClassId = '';
  private chassisColor: number = COLOR_TANK_BLUE;

  constructor(
    definition: TankDefinition = BASIC_TANK_DEFINITION,
    color: number = COLOR_TANK_BLUE,
  ) {
    this.chassisColor = color;

    // 預先配置固定 8 個砲管插槽容器，熱路徑零配置 (Zero-GC)
    for (let b = 0; b < MAX_TANK_BARRELS; b++) {
      const slotContainer = new Container();
      const slotGraphics = new Graphics();
      slotContainer.addChild(slotGraphics);
      this.barrelContainer.addChild(slotContainer);
      this.barrelSlots.push({
        container: slotContainer,
        graphics: slotGraphics,
      });
    }

    this.container.addChild(this.barrelContainer);
    this.container.addChild(this.bodyGraphics);

    this.setDefinition(definition, BASE_TANK_RADIUS, color);
  }

  /**
   * 切換坦克職業定義與底盤色彩，重新構建各砲管多邊形幾何
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

    // 1. 依定義幾何繪製各獨立砲管
    const barrels = definition.barrels;
    const count = barrels.length;

    for (let b = 0; b < MAX_TANK_BARRELS; b++) {
      const slot = this.barrelSlots[b];
      if (b < count) {
        slot.container.visible = true;
        const barrel = barrels[b];
        const L = barrel.length;
        const wBase = barrel.width;
        const wTip = barrel.tipWidth ?? barrel.width;
        const theta = barrel.angle;
        const ox = barrel.offsetX;
        const oy = barrel.offsetY;

        slot.container.position.set(ox, oy);
        slot.container.rotation = theta;
        slot.graphics.position.set(0, 0);

        // 局部未旋轉座標系：底座在 x=0，砲口延伸至 x=L
        const x0 = 0;
        const y0 = -wBase * 0.5;
        const x1 = L;
        const y1 = -wTip * 0.5;
        const x2 = L;
        const y2 = wTip * 0.5;
        const x3 = 0;
        const y3 = wBase * 0.5;

        slot.graphics.clear();
        slot.graphics
          .poly([x0, y0, x1, y1, x2, y2, x3, y3])
          .fill({ color: COLOR_BARREL_GRAY })
          .stroke({ color: COLOR_STROKE, width: STROKE_WIDTH });
      } else {
        slot.container.visible = false;
        slot.graphics.clear();
      }
    }

    // 2. 繪製坦克圓形底盤（置於砲管容器上方，遮蔽砲管底座與縮回多邊形）
    this.bodyGraphics.clear();
    this.bodyGraphics
      .circle(0, 0, radius)
      .fill({ color: this.chassisColor })
      .stroke({ color: COLOR_STROKE, width: STROKE_WIDTH });
  }

  /**
   * 渲染幀更新顯示位置、砲管朝向、體型縮放與各砲管後座力收縮偏移
   * @param renderX 插值後的坦克世界 X 座標
   * @param renderY 插值後的坦克世界 Y 座標
   * @param aimAngle 本渲染幀滑鼠或插值瞄準角度（弧度）
   * @param scale 坦克體型縮放倍率（預設 1.0）
   * @param recoils 各砲管即時後座力收縮位移量（世界單位）
   */
  public update(
    renderX: number,
    renderY: number,
    aimAngle: number,
    scale = 1.0,
    recoils?: Float32Array | number[],
  ): void {
    this.container.position.set(renderX, renderY);
    this.container.scale.set(scale, scale);
    this.barrelContainer.rotation = aimAngle;

    if (recoils) {
      const len = this.barrelSlots.length;
      for (let b = 0; b < len; b++) {
        if (!this.barrelSlots[b].container.visible) break;
        const rec = recoils[b] || 0;
        this.barrelSlots[b].graphics.position.x = -rec;
      }
    }
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
