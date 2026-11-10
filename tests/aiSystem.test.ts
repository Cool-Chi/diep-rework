import { describe, expect, it } from 'vitest';
import { AISystem } from '../src/ai/AISystem';
import { MAP_SIZE } from '../src/config/constants';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Shape } from '../src/entities/Shape';
import { Tank } from '../src/entities/Tank';

describe('Milestone 5: AISystem (Tactical Bot Decision & Combat)', () => {
  it('switches from farming to engaging when an enemy tank enters perception radius', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    const player = new Tank(1, 1300, 1000); // 距離 300 (< PERCEPTION_RADIUS 550)
    player.active = true;

    const shapes: Shape[] = [];
    const allTanks = [player, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    expect(bot.aiState).toBe('farming');

    // 執行一次 AI 更新
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.aiState).toBe('engaging');
    expect(bot.aiTargetId).toBe(player.id);
    expect(bot.input.shooting).toBe(true);
  });

  it('calculates predictive lead aiming against a moving target during combat', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.bulletSpeed = 20;

    const enemy = new Tank(1, 1200, 1000); // 距離 200，在 bot 右側
    enemy.active = true;
    enemy.vx = 0;
    enemy.vy = 10; // 目標正往下等速移動

    const shapes: Shape[] = [];
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // t_hit = 200 / 20 = 10 ticks. 預測目標 Y = 1000 + 10 * 10 = 1100
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.aiState).toBe('engaging');
    expect(bot.input.aimX).toBeCloseTo(1200, 0);
    expect(bot.input.aimY).toBeCloseTo(1100, 0);
  });

  it('retreats when HP drops below 35% and utilizes reverse recoil firing to escape', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 30; // 30% (< 35%)

    const chaser = new Tank(1, 1200, 1000); // 追擊者在右方 (1200, 1000)
    chaser.active = true;

    const shapes: Shape[] = [];
    const allTanks = [chaser, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.aiState).toBe('retreating');
    // 向左方全力逃跑 (dx = 200 > 0，逃跑方向 moveX 為負)
    expect(bot.input.moveX).toBeLessThan(0);
    // 槍口轉向追擊者開火以取得反向火箭後座力
    expect(bot.input.aimX).toBe(1200);
    expect(bot.input.aimY).toBe(1000);
    expect(bot.input.shooting).toBe(true);
  });

  it('evades incoming hostile bullets with perpendicular strafe dodge', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    const enemy = new Tank(1, 1400, 1000);
    enemy.active = true;

    const shapes: Shape[] = [];
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 生成一顆朝向 bot 飛來的敵方子彈 (距離 100 < 180)
    const bulletIdx = bulletPool.acquire();
    expect(bulletIdx).toBeGreaterThanOrEqual(0);
    const bullet = bulletPool.items[bulletIdx];
    bullet.active = true;
    bullet.ownerId = enemy.id;
    bullet.x = 1100;
    bullet.y = 1000;
    bullet.vx = -15; // 向左朝向 bot 飛來
    bullet.vy = 0;

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    // 子彈朝 -X 飛來，垂直閃避向量為 Y 軸方向 (原本 Strafe +0.85 受到 -1.2 規避衝量轉向)
    expect(Math.abs(bot.input.moveY)).toBeGreaterThan(0.2);
  });

  it('farms nearest shape and maintains safe distance buffer', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    // 形狀在 (1300, 1000)，距離 300 (> safe distance 140)
    const shape = new Shape();
    shape.init(1, 'triangle', 1300, 1000, 0, 0, 15, 30, 10, 25);

    const shapes = [shape];
    const allTanks = [bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.aiState).toBe('farming');
    expect(bot.input.aimX).toBe(1300);
    expect(bot.input.aimY).toBe(1000);
    expect(bot.input.shooting).toBe(true);
    expect(bot.input.moveX).toBeGreaterThan(0); // 接近形狀

    // 測試過近時保持安全緩衝 (距離 80 < safe distance 140)
    shape.x = 1080;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.input.moveX).toBeLessThan(0); // 後退維持安全距離
  });

  it('applies boundary repulsion force when close to map borders', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 10, 10); // 位於左上角極限邊界 (BORDER_BUFFER = 250)
    bot.isAi = true;
    bot.active = true;

    const shapes: Shape[] = [];
    const allTanks = [bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.input.moveX).toBeGreaterThan(0);
    expect(bot.input.moveY).toBeGreaterThan(0);

    // 測試右下角邊界排斥
    bot.x = MAP_SIZE - 10;
    bot.y = MAP_SIZE - 10;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);

    expect(bot.input.moveX).toBeLessThan(0);
    expect(bot.input.moveY).toBeLessThan(0);
  });

  it('stops all movement and firing when passiveMode is enabled', () => {
    const aiSystem = new AISystem();
    aiSystem.passiveMode = true;

    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    const enemy = new Tank(1, 1100, 1000);
    enemy.active = true;

    const shapes: Shape[] = [];
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.input.moveX).toBe(0);
    expect(bot.input.moveY).toBe(0);
    expect(bot.input.shooting).toBe(false);
  });
});
