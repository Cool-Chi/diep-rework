import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import type { VisibleBounds } from '../core/Camera';
import type { ObjectPool } from '../core/ObjectPool';
import type { Particle } from '../entities/Particle';
import { isInBounds } from './culling';
import type { Renderer } from './Renderer';

export const PARTICLE_POOL_CAPACITY = 1024;
const BASE_PARTICLE_TEXTURE_RADIUS = 8;

/**
 * 粒子系統圖形渲染器
 * 預配置 1024 個 Sprite 共用貼圖，熱路徑零配置 (Zero-Allocation)，支援可視範圍視錐剔除與渲染插值。
 */
export class ParticleRenderer {
  public readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private particleTexture: Texture | null = null;
  public visibleCount = 0;

  /**
   * 初始化共用圓形粒子貼圖與 Sprite 物件池
   */
  public init(renderer: Renderer): void {
    const g = new Graphics();
    g.circle(0, 0, BASE_PARTICLE_TEXTURE_RADIUS);
    g.fill({ color: 0xffffff });
    this.particleTexture = renderer.app.renderer.generateTexture({ target: g });
    g.destroy();

    for (let i = 0; i < PARTICLE_POOL_CAPACITY; i++) {
      const sprite = new Sprite(this.particleTexture);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }

  /**
   * 每渲染幀更新粒子插值位置、縮放、透明度與視錐剔除
   */
  public update(
    particlePool: ObjectPool<Particle>,
    alpha: number,
    visibleBounds: VisibleBounds,
  ): void {
    const cap = particlePool.capacity;
    let visibleCounter = 0;
    const margin = 40;

    for (let i = 0; i < cap; i++) {
      const sprite = this.sprites[i];
      if (!particlePool.isActive(i)) {
        sprite.visible = false;
        continue;
      }

      const p = particlePool.items[i];
      const rx = p.prevX + (p.x - p.prevX) * alpha;
      const ry = p.prevY + (p.y - p.prevY) * alpha;

      if (!isInBounds(rx, ry, p.radius, visibleBounds, margin)) {
        sprite.visible = false;
        continue;
      }

      const lifeProgress = p.lifeTicks / p.maxLifeTicks;
      const currentScale =
        (p.radius / BASE_PARTICLE_TEXTURE_RADIUS) * (1 - lifeProgress * 0.4);

      sprite.x = rx;
      sprite.y = ry;
      sprite.tint = p.color;
      sprite.alpha = Math.max(0, 1 - lifeProgress * lifeProgress);
      sprite.scale.set(currentScale);
      sprite.visible = true;

      visibleCounter++;
    }

    this.visibleCount = visibleCounter;
  }

  public destroy(): void {
    this.container.destroy({ children: true });
  }
}
