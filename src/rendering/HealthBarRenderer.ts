import { Container, Sprite, Texture } from 'pixi.js';
import {
  HEALTHBAR_HEIGHT,
  HEALTHBAR_OFFSET_FACTOR,
  HEALTHBAR_WIDTH_FACTOR,
} from '../config/constants';
import type { VisibleBounds } from '../core/Camera';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import { shouldShowHealthBar } from '../ui/hudMath';
import { HEALTH_BAR_BG_COLOR, HEALTH_BAR_FG_COLOR } from '../ui/labels';
import { isInBounds } from './culling';
import {
  getHealthBarAnchor,
  getRenderPosition,
  type RenderPositionOut,
} from './getRenderPosition';

export { getHealthBarAnchor, getRenderPosition, type RenderPositionOut };

export const HEALTH_BAR_POOL_CAPACITY = 512;

/**
 * 世界座標實體動態血條渲染器 (HealthBarRenderer)
 * 掛載於 WorldContainer.HealthBarLayer（置於坦克與形狀之上，跟隨世界座標與相機縮放）
 * 嚴格遵循效能鐵律：熱路徑零配置、受傷才顯示、邊界剔除、超出容量時優雅略過、不隨本體旋轉
 */
export class HealthBarRenderer {
  public readonly container = new Container();

  public readonly capacity: number;
  public activeCount = 0;
  private lastActiveCount = 0;

  public healthBarOffsetFactor = HEALTHBAR_OFFSET_FACTOR;
  public healthBarWidthFactor = HEALTHBAR_WIDTH_FACTOR;

  private readonly bgSprites: Sprite[];
  private readonly fgSprites: Sprite[];

  // 重複利用的臨時座標物件，保證熱路徑零 GC
  private readonly tempPos: RenderPositionOut = { x: 0, y: 0 };
  private readonly tempAnchor: RenderPositionOut = { x: 0, y: 0 };

  constructor(capacity = HEALTH_BAR_POOL_CAPACITY) {
    this.capacity = capacity;
    this.bgSprites = new Array(capacity);
    this.fgSprites = new Array(capacity);

    // 預先配置固定容量 Sprite 物件池（1x1 白色貼圖 + tint + scale）
    for (let i = 0; i < capacity; i++) {
      const bg = new Sprite(Texture.WHITE);
      bg.tint = HEALTH_BAR_BG_COLOR;
      bg.anchor.set(0.5, 0);
      bg.visible = false;
      this.bgSprites[i] = bg;
      this.container.addChild(bg);

      const fg = new Sprite(Texture.WHITE);
      fg.tint = HEALTH_BAR_FG_COLOR;
      fg.anchor.set(0, 0);
      fg.visible = false;
      this.fgSprites[i] = fg;
      this.container.addChild(fg);
    }
  }

  /**
   * 每個渲染幀更新受損實體的血條位置與寬度（直接採用插值世界座標）
   * @param tanks 坦克列表
   * @param shapes 形狀列表
   * @param alpha 插值係數 (0 <= alpha < 1)
   * @param visibleBounds 當前世界可視範圍 (用於視錐剔除)
   */
  public update(
    tanks: Tank[],
    shapes: Shape[],
    alpha: number,
    visibleBounds: VisibleBounds,
  ): void {
    let count = 0;
    const cap = this.capacity;
    const offsetFactor = this.healthBarOffsetFactor;
    const widthFactor = this.healthBarWidthFactor;
    const barH = HEALTHBAR_HEIGHT;

    // 1. 處理坦克血條
    const tankLen = tanks.length;
    for (let t = 0; t < tankLen; t++) {
      const tank = tanks[t];
      if (!tank.active || !shouldShowHealthBar(tank.hp, tank.maxHp)) continue;

      getRenderPosition(tank, alpha, this.tempPos);
      if (
        !isInBounds(
          this.tempPos.x,
          this.tempPos.y,
          tank.radius,
          visibleBounds,
          50,
        )
      ) {
        continue;
      }
      if (count >= cap) break;

      getHealthBarAnchor(
        this.tempPos.x,
        this.tempPos.y,
        tank.radius,
        offsetFactor,
        this.tempAnchor,
      );

      const barW = tank.radius * widthFactor;
      const ratio = Math.max(0, Math.min(1, tank.hp / tank.maxHp));

      const bg = this.bgSprites[count];
      bg.visible = true;
      bg.position.set(this.tempAnchor.x, this.tempAnchor.y);
      bg.scale.set(barW, barH);
      bg.rotation = 0;

      const fg = this.fgSprites[count];
      fg.visible = true;
      fg.position.set(this.tempAnchor.x - barW * 0.5, this.tempAnchor.y);
      fg.scale.set(barW * ratio, barH);
      fg.rotation = 0;

      count++;
    }

    // 2. 處理幾何形狀血條
    const shapeLen = shapes.length;
    for (let s = 0; s < shapeLen; s++) {
      const shape = shapes[s];
      if (!shape.active || !shouldShowHealthBar(shape.hp, shape.maxHp)) {
        continue;
      }

      getRenderPosition(shape, alpha, this.tempPos);
      if (
        !isInBounds(
          this.tempPos.x,
          this.tempPos.y,
          shape.radius,
          visibleBounds,
          30,
        )
      ) {
        continue;
      }
      if (count >= cap) break;

      getHealthBarAnchor(
        this.tempPos.x,
        this.tempPos.y,
        shape.radius,
        offsetFactor,
        this.tempAnchor,
      );

      const barW = shape.radius * widthFactor;
      const ratio = Math.max(0, Math.min(1, shape.hp / shape.maxHp));

      const bg = this.bgSprites[count];
      bg.visible = true;
      bg.position.set(this.tempAnchor.x, this.tempAnchor.y);
      bg.scale.set(barW, barH);
      bg.rotation = 0;

      const fg = this.fgSprites[count];
      fg.visible = true;
      fg.position.set(this.tempAnchor.x - barW * 0.5, this.tempAnchor.y);
      fg.scale.set(barW * ratio, barH);
      fg.rotation = 0;

      count++;
    }

    // 3. 隱藏本幀未使用之 Sprite
    const hideEnd = Math.max(count, this.lastActiveCount);
    for (let i = count; i < hideEnd; i++) {
      this.bgSprites[i].visible = false;
      this.fgSprites[i].visible = false;
    }

    this.activeCount = count;
    this.lastActiveCount = count;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
