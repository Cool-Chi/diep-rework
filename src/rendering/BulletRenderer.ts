import { Container, Graphics, Sprite, type Texture } from 'pixi.js';
import { BULLET_POOL_CAPACITY, COLOR_STROKE } from '../config/constants';
import type { VisibleBounds } from '../core/Camera';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import { isInBounds } from './culling';
import type { Renderer } from './Renderer';

/**
 * 子彈圖形渲染器
 * 使用預先烘培的四階高解析度 Texture (Small / Normal / Large / Huge) 與固定預配 Sprite 物件池（零 GC）
 * 確保任何子彈半徑（4.5 ~ 24.0）下邊框視覺粗細恆定（約 3.0px，嚴格遵守紅線 2），並支援手動邊界視錐剔除
 */
export class BulletRenderer {
  public readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private smallTexture: Texture | null = null;
  private normalTexture: Texture | null = null;
  private largeTexture: Texture | null = null;
  private hugeTexture: Texture | null = null;
  public visibleCount = 0;

  /**
   * 初始化四階子彈超取樣貼圖與預配置 Sprite 物件池
   */
  public init(renderer: Renderer): void {
    // 1. 生成 small 子彈貼圖 (半徑 18, 筆觸 12, 解析度 2) -> Gunner/Streamliner (r ≈ 4.5, scale ≈ 0.25 -> 筆觸 3.0px)
    const gSmall = new Graphics();
    gSmall.circle(0, 0, 18);
    gSmall.fill({ color: 0xffffff });
    gSmall.stroke({ width: 12, color: COLOR_STROKE });
    this.smallTexture = renderer.app.renderer.generateTexture({
      target: gSmall,
      resolution: 2,
    });
    gSmall.destroy();

    // 2. 生成 normal 子彈貼圖 (半徑 36, 筆觸 12, 解析度 2) -> 常規子彈 (r ≈ 9.0, scale ≈ 0.25 -> 筆觸 3.0px)
    const gNormal = new Graphics();
    gNormal.circle(0, 0, 36);
    gNormal.fill({ color: 0xffffff });
    gNormal.stroke({ width: 12, color: COLOR_STROKE });
    this.normalTexture = renderer.app.renderer.generateTexture({
      target: gNormal,
      resolution: 2,
    });
    gNormal.destroy();

    // 3. 生成 large 子彈貼圖 (半徑 72, 筆觸 12, 解析度 2) -> Destroyer (r ≈ 18.0, scale ≈ 0.25 -> 筆觸 3.0px)
    const gLarge = new Graphics();
    gLarge.circle(0, 0, 72);
    gLarge.fill({ color: 0xffffff });
    gLarge.stroke({ width: 12, color: COLOR_STROKE });
    this.largeTexture = renderer.app.renderer.generateTexture({
      target: gLarge,
      resolution: 2,
    });
    gLarge.destroy();

    // 4. 生成 huge 子彈貼圖 (半徑 96, 筆觸 12, 解析度 2) -> Annihilator (r ≈ 24.0, scale ≈ 0.25 -> 筆觸 3.0px)
    const gHuge = new Graphics();
    gHuge.circle(0, 0, 96);
    gHuge.fill({ color: 0xffffff });
    gHuge.stroke({ width: 12, color: COLOR_STROKE });
    this.hugeTexture = renderer.app.renderer.generateTexture({
      target: gHuge,
      resolution: 2,
    });
    gHuge.destroy();

    // 5. 預先配置固定容量的 Sprite (預設綁定 normalTexture)
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

      // 根據子彈半徑動態切換 4 階貼圖以嚴格維持筆觸恆定約 3.0px
      let targetTexture: Texture | null = this.normalTexture;
      let baseTexRadius = 36;

      if (bullet.radius < 7) {
        targetTexture = this.smallTexture;
        baseTexRadius = 18;
      } else if (bullet.radius < 14) {
        targetTexture = this.normalTexture;
        baseTexRadius = 36;
      } else if (bullet.radius < 21) {
        targetTexture = this.largeTexture;
        baseTexRadius = 72;
      } else {
        targetTexture = this.hugeTexture;
        baseTexRadius = 96;
      }

      if (sprite.texture !== targetTexture && targetTexture) {
        sprite.texture = targetTexture;
      }

      // 末段平滑漸逝（alpha 1.0 -> 0.0，scale 1.0 -> 0.6）
      const fade = bullet.fadeProgress;
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
    this.smallTexture?.destroy(true);
    this.normalTexture?.destroy(true);
    this.largeTexture?.destroy(true);
    this.hugeTexture?.destroy(true);
    this.container.destroy();
  }
}
