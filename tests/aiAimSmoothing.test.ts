import { describe, expect, it } from 'vitest';
import { AISystem } from '../src/ai/AISystem';
import { AI_MAX_TURN_RATE_PER_TICK } from '../src/config/constants';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Shape } from '../src/entities/Shape';
import { Tank } from '../src/entities/Tank';
import { FireSystem } from '../src/systems/FireSystem';

describe('AI Aim Smoothing & Decision Polish (M5)', () => {
  it('AI aim direction turns smoothly with bounded angular turn rate', () => {
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    const bot = new Tank(1001, 200, 200);
    bot.isAi = true;
    bot.rotation = 0; // 面向右方 (0 rad)

    // 目標在正上方 (y = 50, x = 200) -> 目標角度為 -PI/2 (-1.57 rad)
    bot.input.aimX = 200;
    bot.input.aimY = 50;

    fireSystem.updateTankFiring(bot, bulletPool);

    // 1 tick 轉動的角度絕對值應小於或等於 AI_MAX_TURN_RATE_PER_TICK + epsilon
    const angleDelta = Math.abs(bot.rotation - 0);
    expect(angleDelta).toBeLessThanOrEqual(AI_MAX_TURN_RATE_PER_TICK + 0.001);
    expect(angleDelta).toBeGreaterThan(0.05); // 確實朝目標轉動
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
