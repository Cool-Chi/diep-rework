import { describe, expect, it } from 'vitest';
import { AISystem } from '../src/ai/AISystem';
import { AI_MAX_TURN_RATE_PER_TICK } from '../src/config/constants';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Shape } from '../src/entities/Shape';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { interpolateAngle } from '../src/rendering/MultiTankRenderer';
import { FireSystem } from '../src/systems/FireSystem';

describe('AI Aim Smoothing & Decision Polish (M5)', () => {
  it('AI aim direction turns smoothly with bounded angular turn rate and is not overwritten by PhysicsWorld', () => {
    const fireSystem = new FireSystem();
    const physics = new PhysicsWorld();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const bot = new Tank(1001, 200, 200);
    bot.isAi = true;
    bot.rotation = 0; // 面向右方 (0 rad)

    // 目標在正上方 (y = 50, x = 200) -> 目標角度為 -PI/2 (-1.57 rad)
    bot.input.aimX = 200;
    bot.input.aimY = 50;

    // 1. 射擊系統依角速度限制平滑旋轉
    fireSystem.updateTankFiring(bot, bulletPool);

    const angleAfterFire = bot.rotation;
    expect(Math.abs(angleAfterFire - 0)).toBeLessThanOrEqual(
      AI_MAX_TURN_RATE_PER_TICK + 0.001,
    );
    expect(Math.abs(angleAfterFire - 0)).toBeGreaterThan(0.05);

    // 2. 物理步進絕不得覆寫 tank.rotation 為瞬移的 -PI/2
    physics.stepTank(bot);
    expect(bot.rotation).toBe(angleAfterFire);
  });

  it('Tank prepareStep() correctly tracks prevRotation for render interpolation', () => {
    const bot = new Tank(1001, 200, 200);
    bot.rotation = 1.25;
    bot.prepareStep();

    expect(bot.prevRotation).toBe(1.25);

    bot.rotation = 1.45;
    expect(bot.prevRotation).toBe(1.25);
  });

  it('interpolateAngle smoothly calculates shortest arc without 360 degree spin around boundary', () => {
    // 跨越 PI 與 -PI 邊界 (3.1 rad 到 -3.1 rad)
    const mid = interpolateAngle(3.1, -3.1, 0.5);
    // 兩者角距離僅 0.083 弧度，中間值應在正負 PI 附近，而非繞大圈至 0
    expect(Math.abs(mid)).toBeGreaterThan(3.0);

    // 正常區間插值 (0 到 1.0，alpha = 0.5)
    expect(interpolateAngle(0, 1.0, 0.5)).toBeCloseTo(0.5, 5);
  });

  it('AI farming maintains target stickiness avoiding rapid jitter between equidistant shapes', () => {
    const aiSystem = new AISystem();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const bot = new Tank(1001, 200, 200);
    bot.isAi = true;
    bot.level = 5;

    // 建立兩個等距形狀
    const shapeA = new Shape();
    shapeA.init(1, 'square', 250, 200, 0, 0, 13, 10, 8, 10);
    const shapeB = new Shape();
    shapeB.init(2, 'square', 150, 200, 0, 0, 13, 10, 8, 10);
    const shapes = [shapeA, shapeB];

    // Tick 1: 鎖定 shapeA
    aiSystem.update([bot], shapes, [bot], bulletPool, 1);
    const lockedShapeId = bot.aiTargetShapeId;
    expect(lockedShapeId).toBeGreaterThan(0);

    // 持續更新 10 ticks，目標形狀 ID 保持鎖定，不隨機或交替跳動
    for (let t = 2; t <= 10; t++) {
      aiSystem.update([bot], shapes, [bot], bulletPool, t);
      expect(bot.aiTargetShapeId).toBe(lockedShapeId);
    }
  });

  it('Low level AI avoids engaging predators >12 levels higher', () => {
    const aiSystem = new AISystem();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const weakBot = new Tank(1001, 200, 200);
    weakBot.isAi = true;
    weakBot.level = 3;
    weakBot.hp = 50;
    weakBot.maxHp = 50;

    // 高階掠食者 (Lv 30)
    const predator = new Tank(999, 450, 200);
    predator.level = 30;
    predator.active = true;

    aiSystem.update([weakBot], [], [weakBot, predator], bulletPool, 1);

    // 面對相差 27 級的掠食者，弱小 AI 不得主動衝鋒 (engaging)
    expect(weakBot.aiState).not.toBe('engaging');
  });
});
