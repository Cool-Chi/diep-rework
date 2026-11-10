import { describe, expect, it } from 'vitest';
import { HEALTHBAR_OFFSET_FACTOR } from '../src/config/constants';
import { Shape } from '../src/entities/Shape';
import {
  getHealthBarAnchor,
  getRenderPosition,
  HealthBarRenderer,
  type RenderPositionOut,
} from '../src/rendering/HealthBarRenderer';

describe('HealthBar Positioning & Anchor Precision', () => {
  it('strictly maintains anchor delta = (0, radius * offsetFactor) under randomized coordinates and alpha', () => {
    const outPos: RenderPositionOut = { x: 0, y: 0 };
    const outAnchor: RenderPositionOut = { x: 0, y: 0 };
    const offsetFactor = HEALTHBAR_OFFSET_FACTOR;

    for (let i = 0; i < 50; i++) {
      const prevX = (Math.random() - 0.5) * 4000;
      const prevY = (Math.random() - 0.5) * 4000;
      const curX = prevX + (Math.random() - 0.5) * 20;
      const curY = prevY + (Math.random() - 0.5) * 20;
      const alpha = Math.random();
      const radius = 10 + Math.random() * 30;

      const entity = { prevX, prevY, x: curX, y: curY };
      getRenderPosition(entity, alpha, outPos);
      getHealthBarAnchor(outPos.x, outPos.y, radius, offsetFactor, outAnchor);

      const dx = outAnchor.x - outPos.x;
      const dy = outAnchor.y - outPos.y;

      expect(dx).toBe(0);
      expect(dy).toBeCloseTo(radius * offsetFactor, 10);
    }
  });

  it('correctly anchors when alpha = 0 (exact tick start)', () => {
    const outPos: RenderPositionOut = { x: 0, y: 0 };
    const outAnchor: RenderPositionOut = { x: 0, y: 0 };
    const offsetFactor = 1.35;
    const radius = 25;

    const entity = { prevX: 100, prevY: 200, x: 150, y: 260 };
    getRenderPosition(entity, 0, outPos);

    expect(outPos.x).toBe(100);
    expect(outPos.y).toBe(200);

    getHealthBarAnchor(outPos.x, outPos.y, radius, offsetFactor, outAnchor);
    expect(outAnchor.x - outPos.x).toBe(0);
    expect(outAnchor.y - outPos.y).toBe(radius * offsetFactor);
  });

  it('correctly anchors when alpha is near 1 (0.99999, end of interpolation interval)', () => {
    const outPos: RenderPositionOut = { x: 0, y: 0 };
    const outAnchor: RenderPositionOut = { x: 0, y: 0 };
    const offsetFactor = 1.35;
    const radius = 25;

    const entity = { prevX: 100, prevY: 200, x: 200, y: 300 };
    getRenderPosition(entity, 0.99999, outPos);

    expect(outPos.x).toBeCloseTo(199.999, 3);
    expect(outPos.y).toBeCloseTo(299.999, 3);

    getHealthBarAnchor(outPos.x, outPos.y, radius, offsetFactor, outAnchor);
    expect(outAnchor.x - outPos.x).toBe(0);
    expect(outAnchor.y - outPos.y).toBeCloseTo(radius * offsetFactor, 10);
  });

  it('ensures shape rotation does not affect health bar position or rotation (remains unrotated)', () => {
    const renderer = new HealthBarRenderer(16);
    const visibleBounds = {
      minX: -2000,
      minY: -2000,
      maxX: 2000,
      maxY: 2000,
      width: 4000,
      height: 4000,
    };

    const shape = new Shape();
    shape.id = 1;
    shape.active = true;
    shape.kind = 'pentagon';
    shape.x = 500;
    shape.y = 500;
    shape.prevX = 500;
    shape.prevY = 500;
    shape.hp = 50; // 受傷狀態以觸發血條
    shape.maxHp = 100;
    shape.radius = 25;

    const testAngles = [0, Math.PI / 4, Math.PI / 2, 2.7, 5.1];
    let firstBgPos: { x: number; y: number } | null = null;
    let firstFgPos: { x: number; y: number } | null = null;

    const outPos: RenderPositionOut = { x: 0, y: 0 };
    getRenderPosition(shape, 0.5, outPos);

    for (const angle of testAngles) {
      shape.rotation = angle;
      renderer.update([], [shape], 0.5, visibleBounds);

      expect(renderer.activeCount).toBe(1);

      // 檢查第一組 Sprite
      const bg = (
        renderer as unknown as {
          bgSprites: { position: { x: number; y: number }; rotation: number }[];
        }
      ).bgSprites[0];
      const fg = (
        renderer as unknown as {
          fgSprites: { position: { x: number; y: number }; rotation: number }[];
        }
      ).fgSprites[0];

      // 血條本身旋轉角恆為 0
      expect(bg.rotation).toBe(0);
      expect(fg.rotation).toBe(0);

      // 錨點位置與本體渲染座標在不同自轉角下完全一致
      if (!firstBgPos || !firstFgPos) {
        firstBgPos = { x: bg.position.x, y: bg.position.y };
        firstFgPos = { x: fg.position.x, y: fg.position.y };
      } else {
        expect(bg.position.x).toBe(firstBgPos.x);
        expect(bg.position.y).toBe(firstBgPos.y);
        expect(fg.position.x).toBe(firstFgPos.x);
        expect(fg.position.y).toBe(firstFgPos.y);
      }

      // 錨點與本體渲染座標差距嚴格為 (0, radius * offsetFactor)
      expect(bg.position.x - outPos.x).toBe(0);
      expect(bg.position.y - outPos.y).toBeCloseTo(
        shape.radius * renderer.healthBarOffsetFactor,
        10,
      );
    }

    renderer.destroy();
  });
});
