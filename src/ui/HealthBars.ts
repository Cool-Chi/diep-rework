import { Container, Sprite, Texture } from 'pixi.js';
import type { Camera, VisibleBounds } from '../core/Camera';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import { isInBounds } from '../rendering/culling';
import { shouldShowHealthBar } from './hudMath';
import { HEALTH_BAR_BG_COLOR, HEALTH_BAR_FG_COLOR } from './labels';

export const HEALTH_BAR_POOL_CAPACITY = 512;

/**
 * 實體動態血條管理器 (HealthBars)
 * 掛載於 HUDContainer，採用固定容量 Sprite 物件池（1x1 白色貼圖 + tint + scale）
 * 嚴格遵循效能鐵律：熱路徑零配置、受傷才顯示、視野剔除、超出容量時優雅略過
 */
export class HealthBars {
  public readonly container = new Container();

  public readonly capacity: number;
  public activeCount = 0;
  private lastActiveCount = 0;

  private readonly bgSprites: Sprite[];
  private readonly fgSprites: Sprite[];

  constructor(capacity = HEALTH_BAR_POOL_CAPACITY) {
    this.capacity = capacity;
    this.bgSprites = new Array(capacity);
    this.fgSprites = new Array(capacity);

    // 預先配置 Sprite 物件池（底色在前，綠色條在後）
    for (let i = 0; i < capacity; i++) {
      const bg = new Sprite(Texture.WHITE);
      bg.tint = HEALTH_BAR_BG_COLOR;
      bg.visible = false;
      this.bgSprites[i] = bg;
      this.container.addChild(bg);

      const fg = new Sprite(Texture.WHITE);
      fg.tint = HEALTH_BAR_FG_COLOR;
      fg.visible = false;
      this.fgSprites[i] = fg;
      this.container.addChild(fg);
    }
  }

  /**
   * 每個渲染幀更新所有受損實體的血條位置與寬度
   * @param tanks 坦克列表
   * @param shapes 形狀列表
   * @param camera 主相機 (用於 worldToScreen 座標換算)
   * @param visibleBounds 當前世界可視範圍 (用於視錐剔除)
   */
  public update(
    tanks: Tank[],
    shapes: Shape[],
    camera: Camera,
    visibleBounds: VisibleBounds,
  ): void {
    let count = 0;
    const cap = this.capacity;

    // 1. 處理坦克血條
    const tankLen = tanks.length;
    for (let t = 0; t < tankLen; t++) {
      const tank = tanks[t];
      if (!tank.active || !shouldShowHealthBar(tank.hp, tank.maxHp)) continue;
      if (!isInBounds(tank.x, tank.y, tank.radius, visibleBounds, 50)) continue;
      if (count >= cap) break;

      const screenPos = camera.worldToScreen(tank.x, tank.y);
      const ratio = Math.max(0, Math.min(1, tank.hp / tank.maxHp));

      // 血條寬高 (螢幕像素，固定大小不隨相機縮放比例失真)
      const barW = Math.max(34, tank.radius * 1.5);
      const barH = 5;
      const posX = screenPos.x - barW * 0.5;
      const posY = screenPos.y + tank.radius * camera.scale + 6;

      const bg = this.bgSprites[count];
      bg.visible = true;
      bg.position.set(posX, posY);
      bg.scale.set(barW, barH);

      const fg = this.fgSprites[count];
      fg.visible = true;
      fg.position.set(posX, posY);
      fg.scale.set(barW * ratio, barH);

      count++;
    }

    // 2. 處理幾何形狀血條
    const shapeLen = shapes.length;
    for (let s = 0; s < shapeLen; s++) {
      const shape = shapes[s];
      if (!shape.active || !shouldShowHealthBar(shape.hp, shape.maxHp))
        continue;
      if (!isInBounds(shape.x, shape.y, shape.radius, visibleBounds, 30))
        continue;
      if (count >= cap) break;

      const screenPos = camera.worldToScreen(shape.x, shape.y);
      const ratio = Math.max(0, Math.min(1, shape.hp / shape.maxHp));

      const barW = Math.max(24, shape.radius * 1.4);
      const barH = 4;
      const posX = screenPos.x - barW * 0.5;
      const posY = screenPos.y + shape.radius * camera.scale + 5;

      const bg = this.bgSprites[count];
      bg.visible = true;
      bg.position.set(posX, posY);
      bg.scale.set(barW, barH);

      const fg = this.fgSprites[count];
      fg.visible = true;
      fg.position.set(posX, posY);
      fg.scale.set(barW * ratio, barH);

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
