import { describe, expect, it } from 'vitest';
import { FixedStepper } from '../src/core/FixedStepper';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

describe('60Hz vs 120Hz Simulation Determinism', () => {
  it('在 60Hz 與 120Hz 螢幕下模擬相同時間（2 秒），應獲得完全相同的 tick 數與最終坦克世界座標', () => {
    const totalSeconds = 2.0;

    // --- 60Hz 模擬 (每幀 1/60 秒，共 120 幀) ---
    const stepper60 = new FixedStepper(0.04, 5);
    const physics60 = new PhysicsWorld();
    const tank60 = new Tank(1, 2000, 2000);
    tank60.input.moveX = 1;
    tank60.input.moveY = 1;

    let totalTicks60 = 0;
    const dt60 = 1 / 60;
    const frames60 = Math.round(totalSeconds * 60);

    for (let f = 0; f < frames60; f++) {
      const step = stepper60.advance(dt60);
      for (let t = 0; t < step.ticks; t++) {
        totalTicks60++;
        physics60.stepTank(tank60);
      }
    }

    // --- 120Hz 模擬 (每幀 1/120 秒，共 240 幀) ---
    const stepper120 = new FixedStepper(0.04, 5);
    const physics120 = new PhysicsWorld();
    const tank120 = new Tank(2, 2000, 2000);
    tank120.input.moveX = 1;
    tank120.input.moveY = 1;

    let totalTicks120 = 0;
    const dt120 = 1 / 120;
    const frames120 = Math.round(totalSeconds * 120);

    for (let f = 0; f < frames120; f++) {
      const step = stepper120.advance(dt120);
      for (let t = 0; t < step.ticks; t++) {
        totalTicks120++;
        physics120.stepTank(tank120);
      }
    }

    // 驗證：總模擬 tick 數應完全一致（2.0s / 0.04s = 50 ticks）
    expect(totalTicks60).toBe(50);
    expect(totalTicks120).toBe(50);
    expect(totalTicks60).toBe(totalTicks120);

    // 驗證：坦克在世界空間的最終位置與速度應完全一致（數值精確對齊）
    expect(tank60.x).toBeCloseTo(tank120.x, 6);
    expect(tank60.y).toBeCloseTo(tank120.y, 6);
    expect(tank60.vx).toBeCloseTo(tank120.vx, 6);
    expect(tank60.vy).toBeCloseTo(tank120.vy, 6);
  });
});
