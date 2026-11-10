import { describe, expect, it } from 'vitest';
import {
  scoreProgress,
  shouldShowHealthBar,
  uiScale,
  worldToMinimap,
} from '../src/ui/hudMath';
import { computeHudLayout } from '../src/ui/layout';

describe('HUD Math and Pure Layout Functions (M3b)', () => {
  it('scoreProgress correctly calculates percentage to next level and maxes at Lv 30', () => {
    // Lv 1 門檻 0，Lv 2 門檻 4
    expect(scoreProgress(1, 0)).toBe(0.0);
    expect(scoreProgress(1, 2)).toBe(0.5); // 區間中點
    expect(scoreProgress(1, 4)).toBe(1.0);

    // Lv 2 (門檻 4 分，Lv 3 門檻 13 分，區間 9 分)
    expect(scoreProgress(2, 4)).toBe(0.0); // 剛升級為 0%
    expect(scoreProgress(2, 8.5)).toBeCloseTo(0.5, 5); // 4 + 4.5 = 8.5

    // Lv 30 滿級 (6184 分以上固定滿格 1.0)
    expect(scoreProgress(30, 6184)).toBe(1.0);
    expect(scoreProgress(30, 99999)).toBe(1.0);
  });

  it('worldToMinimap correctly transforms 4000x4000 world coordinates to minimap space', () => {
    const mapSize = 140;

    // 四個世界邊角
    expect(worldToMinimap(0, 0, mapSize)).toEqual({ x: 0, y: 0 });
    expect(worldToMinimap(4000, 0, mapSize)).toEqual({ x: 140, y: 0 });
    expect(worldToMinimap(0, 4000, mapSize)).toEqual({ x: 0, y: 140 });
    expect(worldToMinimap(4000, 4000, mapSize)).toEqual({ x: 140, y: 140 });

    // 世界中心
    expect(worldToMinimap(2000, 2000, mapSize)).toEqual({ x: 70, y: 70 });

    // 邊界外座標夾取 (Clamp)
    expect(worldToMinimap(-100, -50, mapSize)).toEqual({ x: 0, y: 0 });
    expect(worldToMinimap(5000, 4500, mapSize)).toEqual({ x: 140, y: 140 });
  });

  it('shouldShowHealthBar shows only when entity is damaged and alive', () => {
    // 滿血不顯示
    expect(shouldShowHealthBar(50, 50)).toBe(false);
    expect(shouldShowHealthBar(10, 10)).toBe(false);

    // 受損且存活時顯示
    expect(shouldShowHealthBar(49.9, 50)).toBe(true);
    expect(shouldShowHealthBar(25, 50)).toBe(true);
    expect(shouldShowHealthBar(0.1, 50)).toBe(true);

    // 死亡歸零不顯示
    expect(shouldShowHealthBar(0, 50)).toBe(false);
    expect(shouldShowHealthBar(-10, 50)).toBe(false);
  });

  it('uiScale respects bounds between 0.75 and 1.5 with 1080p baseline', () => {
    // 1080p 基準為 1.0
    expect(uiScale(1920, 1080)).toBe(1.0);

    // 720p 原本 720/1080 = 0.666...，下限夾取為 0.75
    expect(uiScale(1280, 720)).toBe(0.75);

    // 480p 嚴重超低，下限夾取為 0.75
    expect(uiScale(640, 480)).toBe(0.75);

    // 1440p: 1440/1080 ≈ 1.333
    expect(uiScale(2560, 1440)).toBeCloseTo(1.333, 2);

    // 4K (2160p): 2160/1080 = 2.0，上限夾取為 1.5
    expect(uiScale(3840, 2160)).toBe(1.5);
  });

  it('computeHudLayout keeps all panels in bounds without overlap in 1280x720 and 1920x1080', () => {
    const resolutions = [
      { w: 1280, h: 720 },
      { w: 1920, h: 1080 },
    ];

    for (const res of resolutions) {
      const layout = computeHudLayout(res.w, res.h, true);

      // 1. 屬性面板在螢幕內
      expect(layout.statPanel.x).toBeGreaterThanOrEqual(0);
      expect(layout.statPanel.x + layout.statPanel.width).toBeLessThan(res.w);
      expect(layout.statPanel.y).toBeGreaterThanOrEqual(0);
      expect(layout.statPanel.y + layout.statPanel.height).toBeLessThanOrEqual(
        res.h,
      );

      // 2. 分數列在螢幕內
      expect(layout.scoreBar.x).toBeGreaterThanOrEqual(0);
      expect(layout.scoreBar.x + layout.scoreBar.width).toBeLessThanOrEqual(
        res.w,
      );
      expect(layout.scoreBar.y).toBeGreaterThanOrEqual(0);
      expect(layout.scoreBar.y + layout.scoreBar.height).toBeLessThanOrEqual(
        res.h,
      );

      // 3. 小地圖在螢幕內
      expect(layout.miniMap.x).toBeGreaterThanOrEqual(0);
      expect(layout.miniMap.x + layout.miniMap.width).toBeLessThanOrEqual(
        res.w,
      );
      expect(layout.miniMap.y).toBeGreaterThanOrEqual(0);
      expect(layout.miniMap.y + layout.miniMap.height).toBeLessThanOrEqual(
        res.h,
      );

      // 4. 三大區塊互不重疊（X 軸順序：屬性面板 < 分數列 < 小地圖）
      const statRight = layout.statPanel.x + layout.statPanel.width;
      const scoreLeft = layout.scoreBar.x;
      const scoreRight = layout.scoreBar.x + layout.scoreBar.width;
      const mapLeft = layout.miniMap.x;

      expect(statRight).toBeLessThan(scoreLeft);
      expect(scoreRight).toBeLessThan(mapLeft);
    }
  });
});
