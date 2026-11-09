import { Container, Culler, Graphics, Sprite, type Texture } from 'pixi.js';
import {
  COLOR_PENTAGON,
  COLOR_SQUARE,
  COLOR_STROKE,
  COLOR_TRIANGLE,
  SHAPE_CAPACITY,
  SHAPE_PENTAGON_RADIUS,
  SHAPE_SQUARE_RADIUS,
  SHAPE_TRIANGLE_RADIUS,
  STROKE_WIDTH,
} from '../config/constants';
import type { VisibleBounds } from '../core/Camera';
import type { Shape, ShapeType } from '../entities/Shape';
import type { Renderer } from './Renderer';

/**
 * 幾何形狀圖形渲染器
 * 使用預先烘培的共用 Texture（方塊、三角、五邊形）與固定預配 Sprite 物件池（零 GC），支援視錐剔除與 Pixi v8 Culler
 */
export class ShapeRenderer {
  public readonly container = new Container();
  private readonly sprites: Sprite[] = [];
  private textures: Record<ShapeType, Texture> | null = null;

  /**
   * 初始化多邊形貼圖與預配置 Sprite 物件池
   */
  public init(renderer: Renderer): void {
    const appRenderer = renderer.app.renderer;

    // 1. 生成方塊貼圖
    const gSquare = new Graphics();
    const halfSq = SHAPE_SQUARE_RADIUS;
    gSquare.rect(-halfSq, -halfSq, halfSq * 2, halfSq * 2);
    gSquare.fill({ color: COLOR_SQUARE });
    gSquare.stroke({ width: STROKE_WIDTH, color: COLOR_STROKE });
    const squareTex = appRenderer.generateTexture({ target: gSquare });
    gSquare.destroy();

    // 2. 生成正三角形貼圖
    const gTri = new Graphics();
    const triR = SHAPE_TRIANGLE_RADIUS;
    const triPts = [
      0,
      -triR,
      triR * Math.cos(Math.PI / 6),
      triR * Math.sin(Math.PI / 6),
      -triR * Math.cos(Math.PI / 6),
      triR * Math.sin(Math.PI / 6),
    ];
    gTri.poly(triPts);
    gTri.fill({ color: COLOR_TRIANGLE });
    gTri.stroke({ width: STROKE_WIDTH, color: COLOR_STROKE });
    const triTex = appRenderer.generateTexture({ target: gTri });
    gTri.destroy();

    // 3. 生成正五邊形貼圖
    const gPent = new Graphics();
    const pentR = SHAPE_PENTAGON_RADIUS;
    const pentPts: number[] = [];
    for (let k = 0; k < 5; k++) {
      const theta = -Math.PI / 2 + k * ((Math.PI * 2) / 5);
      pentPts.push(pentR * Math.cos(theta), pentR * Math.sin(theta));
    }
    gPent.poly(pentPts);
    gPent.fill({ color: COLOR_PENTAGON });
    gPent.stroke({ width: STROKE_WIDTH, color: COLOR_STROKE });
    const pentTex = appRenderer.generateTexture({ target: gPent });
    gPent.destroy();

    this.textures = {
      square: squareTex,
      triangle: triTex,
      pentagon: pentTex,
    };

    // 4. 預先配置固定容量的 Sprite
    for (let i = 0; i < SHAPE_CAPACITY; i++) {
      const sprite = new Sprite(squareTex);
      sprite.anchor.set(0.5, 0.5);
      sprite.visible = false;
      sprite.cullable = true;
      this.sprites.push(sprite);
      this.container.addChild(sprite);
    }
  }

  /**
   * 每個渲染幀更新形狀插值顯示位置、自轉角度與可視範圍裁切
   */
  public update(
    shapes: Shape[],
    alpha: number,
    visibleBounds: VisibleBounds,
  ): void {
    if (!this.textures) return;

    const count = shapes.length;
    const minX = visibleBounds.minX - 60;
    const maxX = visibleBounds.maxX + 60;
    const minY = visibleBounds.minY - 60;
    const maxY = visibleBounds.maxY + 60;

    for (let i = 0; i < count; i++) {
      const sprite = this.sprites[i];
      const shape = shapes[i];

      if (!shape.active) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }

      const rx = shape.prevX + (shape.x - shape.prevX) * alpha;
      const ry = shape.prevY + (shape.y - shape.prevY) * alpha;

      // 視錐裁切
      if (rx < minX || rx > maxX || ry < minY || ry > maxY) {
        if (sprite.visible) sprite.visible = false;
        continue;
      }

      sprite.visible = true;
      sprite.x = rx;
      sprite.y = ry;
      sprite.rotation = shape.rotation;

      const targetTex = this.textures[shape.kind];
      if (sprite.texture !== targetTex) {
        sprite.texture = targetTex;
      }
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
    if (this.textures) {
      this.textures.square.destroy(true);
      this.textures.triangle.destroy(true);
      this.textures.pentagon.destroy(true);
      this.textures = null;
    }
    this.container.destroy();
  }
}
