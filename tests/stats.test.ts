import { describe, expect, it } from 'vitest';
import {
  getBodyDamage,
  getBulletDamage,
  getBulletPenetration,
  getBulletSpeed,
  getHealthRegenPerTick,
  getMaxHealth,
  getMovementSpeedMultiplier,
  getReloadTicks,
  sizeFactor,
} from '../src/config/stats.config';

describe('Stats Config Formula Golden Values', () => {
  it('最大生命值公式驗證 (Lv 1=50, Lv 45=138, p 點數成長)', () => {
    // Lv 1, p=0 基準
    expect(getMaxHealth(1, 0)).toBe(50);
    // Lv 45, p=0 基準
    expect(getMaxHealth(45, 0)).toBe(138);

    // Lv 1, p=7
    expect(getMaxHealth(1, 7)).toBe(50 + 20 * 7); // 190
    // Lv 45, p=7
    expect(getMaxHealth(45, 7)).toBe(138 + 20 * 7); // 278
    // Lv 30, p=7
    expect(getMaxHealth(30, 7)).toBe(50 + 2 * 29 + 140); // 248
  });

  it('撞擊傷害公式驗證 (對形狀 / 坦克 / 子彈)', () => {
    // p=0 基準：20 / 30 / 5
    expect(getBodyDamage(0, 'shape')).toBe(20);
    expect(getBodyDamage(0, 'tank')).toBe(30);
    expect(getBodyDamage(0, 'bullet')).toBe(5);

    // p=7 滿點：48 / 72 / 12
    expect(getBodyDamage(7, 'shape')).toBe(48);
    expect(getBodyDamage(7, 'tank')).toBe(72);
    expect(getBodyDamage(7, 'bullet')).toBe(12);
  });

  it('子彈穿透力 (子彈生命) 驗證 (2 -> 12.5)', () => {
    expect(getBulletPenetration(0)).toBe(2);
    expect(getBulletPenetration(7)).toBe(12.5);
  });

  it('子彈殺傷力驗證 (7 -> 28，次級目標 x 0.25)', () => {
    expect(getBulletDamage(0)).toBe(7);
    expect(getBulletDamage(7)).toBe(28);

    expect(getBulletDamage(0, true)).toBe(1.75);
    expect(getBulletDamage(7, true)).toBe(7);
  });

  it('裝填間隔驗證 (15 -> 8 ticks)', () => {
    expect(getReloadTicks(0)).toBe(15);
    expect(getReloadTicks(7)).toBe(8);
  });

  it('尺寸隨等級成長公式驗證 (Lv 1=1.0, 每級 +1%)', () => {
    expect(sizeFactor(1)).toBe(1.0);
    expect(sizeFactor(2)).toBe(1.01);
    expect(sizeFactor(30)).toBe(1.01 ** 29);
  });

  it('子彈速度公式驗證 (184/15 -> 328/15)', () => {
    expect(getBulletSpeed(0)).toBeCloseTo(184 / 15, 5);
    expect(getBulletSpeed(7)).toBeCloseTo(328 / 15, 5);
  });

  it('生命自然回復公式驗證 (含 Hyper Regen)', () => {
    // maxHp = 50, p = 0: base = 50 * 0.03 / 30 = 0.05/sec => 0.05 / 25 = 0.002/tick
    expect(getHealthRegenPerTick(50, 0, false)).toBeCloseTo(0.002, 5);
    // maxHp = 50, p = 7: base = 50 * (0.03 + 0.12*7) / 30 = 50 * 0.87 / 30 = 1.45/sec => 1.45 / 25 = 0.058/tick
    expect(getHealthRegenPerTick(50, 7, false)).toBeCloseTo(0.058, 5);
    // 處於 Hyper Regen: 額外 + 15% maxHp/sec = +7.5/sec => 7.5 / 25 = 0.3/tick
    expect(getHealthRegenPerTick(50, 0, true)).toBeCloseTo(0.002 + 0.3, 5);
  });

  it('移動速度縮放驗證 (加點提升，等級增大衰減)', () => {
    const lv1p0 = getMovementSpeedMultiplier(1, 0);
    const lv1p7 = getMovementSpeedMultiplier(1, 7);
    const lv30p0 = getMovementSpeedMultiplier(30, 0);

    expect(lv1p0).toBe(1.0);
    expect(lv1p7).toBeGreaterThan(lv1p0);
    expect(lv30p0).toBeLessThan(lv1p0);
  });
});
