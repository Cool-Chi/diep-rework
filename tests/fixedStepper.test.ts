import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/core/FixedStepper';

describe('FixedStepper', () => {
  it('在剛好 1 個 tick 時間 (0.04s) 下應回傳 1 tick 且 alpha 接近 0', () => {
    const stepper = new FixedStepper(0.04, 5);
    const res = stepper.advance(0.04);
    expect(res.ticks).toBe(1);
    expect(res.alpha).toBeCloseTo(0, 4);
  });

  it('在半個 tick 時間 (0.02s) 下應回傳 0 ticks 且 alpha 接近 0.5', () => {
    const stepper = new FixedStepper(0.04, 5);
    const res = stepper.advance(0.02);
    expect(res.ticks).toBe(0);
    expect(res.alpha).toBeCloseTo(0.5, 4);
  });

  it('累積兩幀半個 tick 時間後應觸發 1 tick', () => {
    const stepper = new FixedStepper(0.04, 5);
    const res1 = stepper.advance(0.02);
    expect(res1.ticks).toBe(0);

    const res2 = stepper.advance(0.02);
    expect(res2.ticks).toBe(1);
    expect(res2.alpha).toBeCloseTo(0, 4);
  });

  it('超過單幀追趕上限時應強制截斷至 5 ticks 且 alpha 維持在 [0, 1)', () => {
    const stepper = new FixedStepper(0.04, 5);
    // 傳入 1.0 秒（相當於 25 個 ticks）
    const res = stepper.advance(1.0);
    expect(res.ticks).toBe(5);
    expect(res.alpha).toBeGreaterThanOrEqual(0);
    expect(res.alpha).toBeLessThan(1);
  });

  it('傳入異常負值或 NaN 時應平滑處理不崩潰', () => {
    const stepper = new FixedStepper(0.04, 5);
    const resNeg = stepper.advance(-0.05);
    expect(resNeg.ticks).toBe(0);
    expect(Number.isNaN(resNeg.alpha)).toBe(false);

    const resNaN = stepper.advance(Number.NaN);
    expect(resNaN.ticks).toBe(0);
    expect(Number.isNaN(resNaN.alpha)).toBe(false);
  });
});
