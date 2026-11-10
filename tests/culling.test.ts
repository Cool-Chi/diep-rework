import { describe, expect, it } from 'vitest';
import type { VisibleBounds } from '../src/core/Camera';
import { isInBounds } from '../src/rendering/culling';

describe('Manual Bounds Culling (isInBounds)', () => {
  const bounds: VisibleBounds = {
    minX: 100,
    minY: 100,
    maxX: 500,
    maxY: 400,
    width: 400,
    height: 300,
  };

  it('correctly identifies objects inside bounds', () => {
    // 圓心在邊界內部且不觸碰邊界
    expect(isInBounds(250, 250, 10, bounds)).toBe(true);
    expect(isInBounds(150, 150, 25, bounds)).toBe(true);
    expect(isInBounds(450, 350, 8, bounds)).toBe(true);
  });

  it('correctly identifies objects outside bounds', () => {
    // 圓形完全在邊界外部
    expect(isInBounds(50, 250, 10, bounds)).toBe(false); // 左方
    expect(isInBounds(550, 250, 10, bounds)).toBe(false); // 右方
    expect(isInBounds(250, 50, 10, bounds)).toBe(false); // 上方
    expect(isInBounds(250, 450, 10, bounds)).toBe(false); // 下方
  });

  it('handles objects touching the boundary exactly (剛好壓線)', () => {
    // 右邊緣剛好壓線：x + r === bounds.minX (margin=0)
    expect(isInBounds(90, 250, 10, bounds, 0)).toBe(true);
    // 距離 0.001 脫離
    expect(isInBounds(89.99, 250, 10, bounds, 0)).toBe(false);

    // 下邊緣剛好壓線：y + r === bounds.minY
    expect(isInBounds(250, 80, 20, bounds, 0)).toBe(true);
    expect(isInBounds(250, 79.9, 20, bounds, 0)).toBe(false);

    // 右邊界 maxX 壓線：x - r === bounds.maxX
    expect(isInBounds(510, 250, 10, bounds, 0)).toBe(true);
    expect(isInBounds(510.1, 250, 10, bounds, 0)).toBe(false);

    // 下邊界 maxY 壓線：y - r === bounds.maxY
    expect(isInBounds(250, 410, 10, bounds, 0)).toBe(true);
    expect(isInBounds(250, 410.1, 10, bounds, 0)).toBe(false);

    // 帶 margin 的壓線檢測 (margin = 50)
    // minX - margin = 50，若 x + r === 50
    expect(isInBounds(40, 250, 10, bounds, 50)).toBe(true);
    expect(isInBounds(39.9, 250, 10, bounds, 50)).toBe(false);
  });

  it('handles radius crossing boundary (半徑跨界)', () => {
    // 圓心在邊界外（x = 80 < minX 100），但半徑 r = 25，右端到達 105 > 100
    expect(isInBounds(80, 250, 25, bounds)).toBe(true);

    // 圓心在右側外（x = 515 > maxX 500），但半徑 r = 20，左端到達 495 < 500
    expect(isInBounds(515, 250, 20, bounds)).toBe(true);

    // 圓心在上方外（y = 85 < minY 100），半徑 r = 20，下端到達 105 > 100
    expect(isInBounds(250, 85, 20, bounds)).toBe(true);

    // 圓心在下方外（y = 410 > maxY 400），半徑 r = 15，上端到達 395 < 400
    expect(isInBounds(250, 410, 15, bounds)).toBe(true);
  });

  it('handles negative coordinates (負座標)', () => {
    const negBounds: VisibleBounds = {
      minX: -400,
      minY: -300,
      maxX: -100,
      maxY: -50,
      width: 300,
      height: 250,
    };

    // 負座標邊界內部
    expect(isInBounds(-200, -150, 15, negBounds)).toBe(true);

    // 負座標半徑跨界
    expect(isInBounds(-410, -150, 20, negBounds)).toBe(true);

    // 負座標邊界完全外部
    expect(isInBounds(-500, -150, 10, negBounds)).toBe(false);
    expect(isInBounds(0, 0, 10, negBounds)).toBe(false);

    // 負座標帶 margin 剛好接觸
    expect(isInBounds(-450, -150, 10, negBounds, 50)).toBe(true);
  });
});
