import { describe, expect, it } from 'vitest';
import {
  levelForScore,
  MAX_LEVEL,
  pointsForLevel,
  SCORE_FOR_LEVEL,
} from '../src/config/levels.config';

describe('Leveling Table and Score Thresholds (M3a)', () => {
  it('SCORE_FOR_LEVEL 表長度為 30，且分數嚴格遞增', () => {
    expect(SCORE_FOR_LEVEL.length).toBe(MAX_LEVEL);
    expect(MAX_LEVEL).toBe(30);

    for (let i = 1; i < SCORE_FOR_LEVEL.length; i++) {
      expect(SCORE_FOR_LEVEL[i]).toBeGreaterThan(SCORE_FOR_LEVEL[i - 1]);
    }
  });

  it('原版關鍵等級門檻精確驗證 (Lv 1=0, Lv 15=787, Lv 30=6184)', () => {
    expect(SCORE_FOR_LEVEL[0]).toBe(0); // Lv 1
    expect(SCORE_FOR_LEVEL[14]).toBe(787); // Lv 15 (Tier 2 轉職)
    expect(SCORE_FOR_LEVEL[29]).toBe(6184); // Lv 30 (Tier 3 進化)
  });

  it('levelForScore 在各邊界精準判定與二分搜尋驗證', () => {
    // 負數與 0 分為 Lv 1
    expect(levelForScore(-100)).toBe(1);
    expect(levelForScore(0)).toBe(1);

    // Lv 1 到 Lv 2 臨界點 (Lv 2 門檻為 4 分)
    expect(levelForScore(3)).toBe(1);
    expect(levelForScore(4)).toBe(2);

    // Lv 15 轉職臨界點 (787 分)
    expect(levelForScore(786)).toBe(14);
    expect(levelForScore(787)).toBe(15);
    expect(levelForScore(788)).toBe(15);

    // Lv 30 滿級臨界點 (6184 分)
    expect(levelForScore(6183)).toBe(29);
    expect(levelForScore(6184)).toBe(30);
    // 超過滿級分數仍封頂於 Lv 30
    expect(levelForScore(100000)).toBe(30);
  });

  it('pointsForLevel 技能點規則驗證 (Lv 2~28 每級 +1，Lv 29 不給，Lv 30 共 28 點)', () => {
    expect(pointsForLevel(1)).toBe(0);
    expect(pointsForLevel(2)).toBe(1);
    expect(pointsForLevel(3)).toBe(2);
    expect(pointsForLevel(15)).toBe(14);
    expect(pointsForLevel(28)).toBe(27);
    expect(pointsForLevel(29)).toBe(27); // Lv 29 原版不給點
    expect(pointsForLevel(30)).toBe(28); // Lv 30 共 28 點
    expect(pointsForLevel(35)).toBe(28); // 超過 30 封頂 28 點
  });
});
