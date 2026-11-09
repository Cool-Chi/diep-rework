import { Container, Culler, Graphics, Sprite, type Texture } from 'pixi.js';
import {
  BASE_BULLET_RADIUS,
  BULLET_POOL_CAPACITY,
  COLOR_STROKE,
  COLOR_TANK_BLUE,
  STROKE_WIDTH,
} from '../config/constants';
import type { VisibleBounds } from '../core/Camera';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Renderer } from './Renderer';

/**
 * 子彈圖形渲染器
 * 使用預先烘培的共用 Texture 與固定預配 Sprite 物件池（零 GC），支援視錐剔除與 Pixi v8 Culler
 */
export class BulletRenderer {
  public readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private bulletTexture: Texture | null = null;

  /**
   * 初始化子彈貼圖與預配置 Sprite 物件池
   */
  public init(renderer: Renderer): void {
    // 1. 繪製並生成共用子彈貼圖
    const g = new Graphics();
    g.circle(0, 0, BASE_BULLET_RADIUS);
    g.fill({ color: COLOR_TANK_BLUE });
    g.stroke({ width: STROKE_WIDTH, color: COLOR_STROKE });
    this.bulletTexture = renderer.app.renderer.generateTexture({ target: g });
    g.destroy();

    // 2. 預先配置固定容量的 Sprite
    for (let i = 0; i < BULLET_POOL_CAPACITY; i++) {
      const sprite = new Sprite(this.bulletTexture);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      sprite.cullable = true;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }

  /**
   * 每個渲染幀更新子彈插值顯示位置與可視範圍裁切
   */
  public update(
    bulletPool: ObjectPool<Bullet>,
    alpha: number,
    visibleBounds: VisibleBounds,
  ): void {
    const cap = bulletPool.capacity;
    const minX = visibleBounds.minX - 50;
    const maxX = visibleBounds.maxX + 50;
    const minY = visibleBounds.minY - 50;
    const maxY = visibleBounds.maxY + 50;

    for (let i = 0; i < cap; i++) {
      const sprite = this.sprites[i];
      if (!bulletPool.isActive(i)) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }

      const bullet = bulletPool.items[i];
      const rx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
      const ry = bullet.prevY + (bullet.y - bullet.prevY) * alpha;

      // 視錐邊界剔除
      if (rx < minX || rx > maxX || ry < minY || ry > maxY) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }

      sprite.visible = true;
      sprite.x = rx;
      sprite.y = ry;
    }

    // 觸發 Pixi v8 Culler
    Culler.shared.cull(this.container, {
      x: visibleBounds.minX,
      y: visibleBounds.minY,
      width: visibleBounds.width,
      height: visibleBounds.height,
    });
  }

  public destroy(): void {
    for (let i = 0; i < this.sprites.length; i++) {
      this.sprites[i].destroy();
    }
    this.sprites.length = 0;
    this.bulletTexture?.destroy(true);
    this.container.destroy();
  }
}
