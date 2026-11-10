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
    aiSystem.ignorePlayer = false;
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
    aiSystem.ignorePlayer = false;
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
    aiSystem.ignorePlayer = false;
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

  it('transitions from retreating back to farming after MIN_RETREAT_TICKS when threats have cleared', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 30; // 30% (< 35%) -> trigger retreat
    bot.aiState = 'retreating';
    bot.aiStateTimer = 46; // > MIN_RETREAT_TICKS (45)

    // 無任何敵人在 THREAT_ESCAPE_RADIUS (700) 內
    const distantEnemy = new Tank(1, 3000, 3000);
    distantEnemy.active = true;

    const shapes: Shape[] = [];
    const allTanks = [distantEnemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.aiState).toBe('farming');
    expect(bot.aiTargetId).toBe(-1);
  });

  it('remains stably in farming mode when low HP with no nearby threats across 100 ticks (no ping-pong deadlock)', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 20; // 20% (< 35% 殘血)
    bot.aiState = 'farming';

    // 附近有形狀可農
    const shape = new Shape();
    shape.init(1, 'square', 1200, 1000, 0, 0, 10, 20, 10, 20);
    const shapes = [shape];

    // 無近距離威脅 (敵人在地圖遠端 3500, 3500)
    const distantEnemy = new Tank(1, 3500, 3500);
    distantEnemy.active = true;
    const allTanks = [distantEnemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 連續執行 100 個 ticks，驗證狀態維持 100% 穩定，絕不發生單 tick 乒乓抽動
    for (let t = 1; t <= 100; t++) {
      aiSystem.update([bot], shapes, allTanks, bulletPool, t);
      expect(bot.aiState).toBe('farming');
      expect(bot.input.shooting).toBe(true);
      expect(bot.input.aimX).toBe(1200);
      expect(bot.input.aimY).toBe(1000);
    }
  });

  it('retreats when low HP with active threat, and smoothly returns to farming when threat clears', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 25; // 25% (< 35%)
    bot.aiState = 'farming';

    const shape = new Shape();
    shape.init(1, 'square', 1100, 1000, 0, 0, 10, 20, 10, 20);
    const shapes = [shape];

    // 敵人出現在 1300, 1000 (距離 300 < PERCEPTION_RADIUS 550)
    const enemy = new Tank(1, 1300, 1000);
    enemy.active = true;
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. 遭遇近身威脅，殘血進入 retreating
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);
    expect(bot.aiState).toBe('retreating');
    expect(bot.input.shooting).toBe(true); // 火箭反衝開火
    expect(bot.input.moveX).toBeLessThan(0); // 遠離敵人

    // 2. 敵人遠離至 1800, 1000 (距離 800 > THREAT_ESCAPE_RADIUS 700)
    enemy.x = 1800;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.aiState).toBe('farming');
    expect(bot.input.shooting).toBe(true); // 立即農怪，不盲目飄移停火

    // 3. 後續 50 ticks 穩定保持 farming
    for (let t = 3; t <= 50; t++) {
      aiSystem.update([bot], shapes, allTanks, bulletPool, t);
      expect(bot.aiState).toBe('farming');
      expect(bot.input.shooting).toBe(true);
    }
  });

  it('dynamically retargets to immediate closer threats during combat', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.aiState = 'engaging';

    const distantTarget = new Tank(1, 1450, 1000); // 距離 450
    distantTarget.active = true;
    bot.aiTargetId = distantTarget.id;

    const immediateThreat = new Tank(2, 1150, 1000); // 距離 150 (< 300 且 450 - 150 = 300 > 120)
    immediateThreat.active = true;

    const shapes: Shape[] = [];
    const allTanks = [distantTarget, immediateThreat, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    // 應該自動切換鎖定更具威脅的近距離目標
    expect(bot.aiTargetId).toBe(immediateThreat.id);
    expect(bot.input.aimX).toBeCloseTo(1150, 0);
  });

  it('ignores player tank when ignorePlayer is true, and targets player when false', () => {
    const aiSystem = new AISystem();
    expect(aiSystem.ignorePlayer).toBe(true); // default true

    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    const player = new Tank(1, 1200, 1000); // 玩家在感知半徑內 (距離 200)
    player.active = true;

    const shapes: Shape[] = [];
    const allTanks = [player, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. ignorePlayer = true 時，AI 忽視玩家，不進入 engaging
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);
    expect(bot.aiState).toBe('farming');
    expect(bot.aiTargetId).toBe(-1);

    // 2. 切換 ignorePlayer = false，AI 立即進入 engaging 鎖定玩家
    aiSystem.ignorePlayer = false;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.aiState).toBe('engaging');
    expect(bot.aiTargetId).toBe(player.id);
  });
});
