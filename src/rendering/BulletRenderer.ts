import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import {
  BASE_BULLET_RADIUS,
  BULLET_POOL_CAPACITY,
  COLOR_STROKE,
  STROKE_WIDTH,
} from '../config/constants';
import type { VisibleBounds } from '../core/Camera';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import { isInBounds } from './culling';
import type { Renderer } from './Renderer';

/**
 * 子彈圖形渲染器
 * 使用預先烘培的共用 Texture 與固定預配 Sprite 物件池（零 GC），支援手動邊界視錐剔除
 */
export class BulletRenderer {
  public readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private bulletTexture: Texture | null = null;
  public visibleCount = 0;

  /**
   * 初始化子彈貼圖與預配置 Sprite 物件池
   */
  public init(renderer: Renderer): void {
    // 1. 繪製並生成共用子彈貼圖（白底 + 深色邊框，透過 sprite.tint 支援全光譜動態染色）
    const g = new Graphics();
    g.circle(0, 0, BASE_BULLET_RADIUS);
    g.fill({ color: 0xffffff });
    g.stroke({ width: STROKE_WIDTH, color: COLOR_STROKE });
    this.bulletTexture = renderer.app.renderer.generateTexture({ target: g });
    g.destroy();

    // 2. 預先配置固定容量的 Sprite (不啟用 cullable)
    for (let i = 0; i < BULLET_POOL_CAPACITY; i++) {
      const sprite = new Sprite(this.bulletTexture);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }

  /**
   * 每個渲染幀更新子彈插值顯示位置與手動可視範圍裁切
   */
  public update(
    bulletPool: ObjectPool<Bullet>,
    alpha: number,
    visibleBounds: VisibleBounds,
  ): void {
    const cap = bulletPool.capacity;
    let visibleCounter = 0;
    const margin = 50;

    for (let i = 0; i < cap; i++) {
      const sprite = this.sprites[i];
      if (!bulletPool.isActive(i)) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }

      const bullet = bulletPool.items[i];
      const rx = bullet.prevX + (bullet.x - bullet.prevX) * alpha;
      const ry = bullet.prevY + (bullet.y - bullet.prevY) * alpha;

      // 手動邊界裁切（考慮 margin 避免邊緣閃爍）
      if (!isInBounds(rx, ry, bullet.radius, visibleBounds, margin)) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }

      // 末段平滑漸逝（alpha 1.0 -> 0.0，scale 1.0 -> 0.6）
      const fade = bullet.fadeProgress;
      const baseScale = bullet.radius / BASE_BULLET_RADIUS;
      const scale = baseScale * (0.6 + 0.4 * fade);

      sprite.x = rx;
      sprite.y = ry;
      sprite.scale.set(scale);
      sprite.alpha = fade;
      if (sprite.tint !== bullet.color) {
        sprite.tint = bullet.color;
      }
      sprite.visible = true;
      visibleCounter++;
    }

    this.visibleCount = visibleCounter;
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
