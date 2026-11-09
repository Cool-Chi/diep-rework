import { describe, expect, it } from 'vitest';
import {
  getBodyDamage,
  getBulletDamage,
  getBulletPenetration,
  getMaxHealth,
  getReloadTicks,
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
});
