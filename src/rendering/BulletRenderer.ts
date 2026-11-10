import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { BULLET_POOL_CAPACITY, COLOR_STROKE } from '../config/constants';
import type { VisibleBounds } from '../core/Camera';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import { isInBounds } from './culling';
import type { Renderer } from './Renderer';

/**
 * 子彈圖形渲染器
 * 使用預先烘培的雙規格高解析度 Texture (Normal 與 Destroyer) 與固定預配 Sprite 物件池（零 GC）
 * 確保任何子彈半徑下邊框視覺粗細恆定（約 3.0px），並支援手動邊界視錐剔除
 */
export class BulletRenderer {
  public readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private normalTexture: Texture | null = null;
  private destroyerTexture: Texture | null = null;
  public visibleCount = 0;

  /**
   * 初始化子彈貼圖（高解析度 normal 與 destroyer 雙貼圖）與預配置 Sprite 物件池
   */
  public init(renderer: Renderer): void {
    // 1. 生成 normal 子彈貼圖 (半徑 36, 筆觸 12, 解析度 2)
    // 當以 scale = 0.25 (半徑 9) 繪製時，顯示筆觸寬度為 12 * 0.25 = 3.0px，與坦克/形狀完全一致且具備超取樣抗鋸齒
    const gNormal = new Graphics();
    gNormal.circle(0, 0, 36);
    gNormal.fill({ color: 0xffffff });
    gNormal.stroke({ width: 12, color: COLOR_STROKE });
    this.normalTexture = renderer.app.renderer.generateTexture({
      target: gNormal,
      resolution: 2,
    });
    gNormal.destroy();

    // 2. 生成 destroyer 巨型子彈貼圖 (半徑 72, 筆觸 12, 解析度 2)
    // 當以 scale = 0.25 (半徑 18) 繪製時，顯示筆觸寬度為 12 * 0.25 = 3.0px，消除放大拉伸邊框過粗與模糊瑕疵
    const gDestroyer = new Graphics();
    gDestroyer.circle(0, 0, 72);
    gDestroyer.fill({ color: 0xffffff });
    gDestroyer.stroke({ width: 12, color: COLOR_STROKE });
    this.destroyerTexture = renderer.app.renderer.generateTexture({
      target: gDestroyer,
      resolution: 2,
    });
    gDestroyer.destroy();

    // 3. 預先配置固定容量的 Sprite (預設綁定 normalTexture)
    for (let i = 0; i < BULLET_POOL_CAPACITY; i++) {
      const sprite = new Sprite(this.normalTexture);
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

      // 根據子彈半徑動態切換貼圖以維持筆觸恆定（Destroyer 基礎半徑 18 >= 15）
      const isDestroyer = bullet.radius >= 15;
      const targetTexture = isDestroyer
        ? this.destroyerTexture
        : this.normalTexture;
      if (sprite.texture !== targetTexture && targetTexture) {
        sprite.texture = targetTexture;
      }

      // 末段平滑漸逝（alpha 1.0 -> 0.0，scale 1.0 -> 0.6）
      const fade = bullet.fadeProgress;
      const baseTexRadius = isDestroyer ? 72 : 36;
      const baseScale = bullet.radius / baseTexRadius;
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
    this.normalTexture?.destroy(true);
    this.destroyerTexture?.destroy(true);
    this.container.destroy();
  }
}
