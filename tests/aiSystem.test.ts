import { describe, expect, it } from 'vitest';
import { AISystem, computeCombatPower } from '../src/ai/AISystem';
import { MAP_SIZE } from '../src/config/constants';
import { TANKS_CONFIG } from '../src/config/tanks.config';
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

    // 2. 敵人遠離至 2100, 1000 (距離 1100 > THREAT_ESCAPE_RADIUS 950)
    // 依據 M9 定向逃逸防抽搐機制，AI 脫離敵人視野後持續維持定向逃跑 75 ticks (3.0秒) 建立安全緩衝區
    enemy.x = 2100;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.aiState).toBe('retreating');
    expect(bot.input.moveX).toBeLessThan(0); // 持續定向遠離戰場

    // 推進至第 76 tick (總共 75 ticks 逃逸期滿)
    for (let t = 3; t <= 76; t++) {
      aiSystem.update([bot], shapes, allTanks, bulletPool, t);
      expect(bot.aiState).toBe('retreating');
    }

    // 第 77 tick 逃逸期滿且周遭無威脅，安全回歸 farming
    aiSystem.update([bot], shapes, allTanks, bulletPool, 77);
    expect(bot.aiState).toBe('farming');
    expect(bot.input.shooting).toBe(true); // 立即農怪，不盲目飄移停火
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
    expect(aiSystem.ignorePlayer).toBe(false); // 正式版預設對玩家開啟敵意 (false)

    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    const player = new Tank(1, 1200, 1000); // 玩家在感知半徑內 (距離 200)
    player.active = true;

    const shapes: Shape[] = [];
    const allTanks = [player, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. 手動設置 ignorePlayer = true 時，AI 忽視玩家，不進入 engaging
    aiSystem.ignorePlayer = true;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);
    expect(bot.aiState).toBe('farming');
    expect(bot.aiTargetId).toBe(-1);

    // 2. 切換 ignorePlayer = false，AI 立即進入 engaging 鎖定玩家
    aiSystem.ignorePlayer = false;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.aiState).toBe('engaging');
    expect(bot.aiTargetId).toBe(player.id);
  });

  it('keeps aim locked on enemy body and avoids barrel swiveling for normal bullets', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    const enemy = new Tank(2, 1300, 1000); // 敵人在右方
    enemy.active = true;

    const shapes: Shape[] = [];
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 生成一顆普通 Twin 子彈 (半徑 9 < 18) 正面飛來
    const bIdx = bulletPool.acquire();
    const b = bulletPool.items[bIdx];
    b.active = true;
    b.ownerId = enemy.id;
    b.radius = 9;
    b.damage = 7;
    b.hp = 3;
    b.x = 1150;
    b.y = 1000;
    b.vx = -12;
    b.vy = 0;

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    // 瞄準應該直接瞄準敵方坦克身位 (1300, 1000)，絕不轉向瞄準普通子彈 (1150)
    expect(bot.input.aimX).toBeCloseTo(1300, -1);
    expect(bot.input.aimY).toBeCloseTo(1000, -1);
    expect(bot.aiInterceptBulletIdx).toBe(-1); // 普通子彈不搶奪準星
  });

  it('supports retreat hysteresis: stays in retreating until HP heals back to 70%', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 40; // 40% (< 45% AI_RETREAT_HP_ENTER)

    const enemy = new Tank(2, 1250, 1000);
    enemy.active = true;

    const shapes: Shape[] = [];
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. 生命 40% 觸發逃跑
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);
    expect(bot.aiState).toBe('retreating');
    expect(bot.input.moveX).toBeLessThan(0); // 遠離敵方

    // 2. 回血至 55%（高於 45% 但低於 70% 滯後門檻），必須持續保持 retreating 逃跑！
    bot.hp = 55;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.aiState).toBe('retreating');
    expect(bot.input.moveX).toBeLessThan(0);

    // 3. 回血至 75%（>= 70% AI_RETREAT_HP_EXIT），脫離逃跑回歸戰鬥
    bot.hp = 75;
    aiSystem.update([bot], shapes, allTanks, bulletPool, 3);
    expect(bot.aiState).toBe('engaging');
  });

  it('generates obstacle repulsion force to steer clear of dangerously close shapes', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;

    // 目標農怪在右前方 (1300, 1000)
    const targetShape = new Shape();
    targetShape.init(1, 'square', 1300, 1000, 0, 0, 15, 10, 8, 10);

    // 障礙形狀 (巨大五邊形) 正好擋在正右方近距 (1055, 1000)，淨距小於 AI_SHAPE_AVOID_DISTANCE
    const obstacleShape = new Shape();
    obstacleShape.init(2, 'pentagon', 1055, 1000, 0, 0, 28, 100, 20, 130);

    const shapes = [targetShape, obstacleShape];
    const allTanks = [bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    // 避障排斥力場 (_shapeAvoidX) 必須對抗向右農怪的力場，向左推開避障
    // 驗證 bot.input.moveX 受到強烈向左推力 (小於 0)
    expect(bot.input.moveX).toBeLessThan(0);
  });

  it('maintains escape heading and state for 75 ticks when enemy exits perception range', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 30; // 30% (< 45% AI_RETREAT_HP_ENTER)

    const enemy = new Tank(2, 1250, 1000); // 敵人在右方
    enemy.active = true;

    const shapes: Shape[] = [];
    let allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    // 1. 初始更新：進入逃跑狀態，建立向左 (moveX < 0) 的定向逃逸向量
    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);
    expect(bot.aiState).toBe('retreating');
    expect(bot.aiEscapeVx).toBeLessThan(-0.9);
    expect(bot.aiEscapeMaintainTicks).toBe(75);
    expect(bot.input.moveX).toBeLessThan(0);

    // 2. 敵人脫離視野（移除敵人目標）
    allTanks = [bot];

    // 3. 第 2 tick 更新：敵人已不在視野內，但 AI 必須保持 retreating 狀態，且持續往左跑
    aiSystem.update([bot], shapes, allTanks, bulletPool, 2);
    expect(bot.aiState).toBe('retreating');
    expect(bot.aiEscapeMaintainTicks).toBe(74);
    expect(bot.input.moveX).toBeLessThan(0); // 持續定向逃逸！絕不掉頭
    expect(bot.input.shooting).toBe(false); // 安靜趕路加速回血

    // 4. 連續推進至第 76 tick (維持 75 ticks)
    for (let t = 3; t <= 76; t++) {
      aiSystem.update([bot], shapes, allTanks, bulletPool, t);
      expect(bot.aiState).toBe('retreating');
      expect(bot.input.moveX).toBeLessThan(0);
      expect(bot.input.shooting).toBe(false);
    }
    expect(bot.aiEscapeMaintainTicks).toBe(0);

    // 5. 第 77 tick：75 ticks 逃逸期滿，安全回歸 farming
    aiSystem.update([bot], shapes, allTanks, bulletPool, 77);
    expect(bot.aiEscapeMaintainTicks).toBe(0);
    expect(bot.aiState).toBe('farming');
  });

  it('correctly calculates tank combat power index', () => {
    const basic = new Tank(1, 0, 0);
    basic.level = 1;
    basic.maxHp = 100;
    basic.hp = 100;
    // 1 * 1.0 + (1 - 1) * 8.0 + (100 / 100) * 6.0 = 7.0
    expect(computeCombatPower(basic)).toBe(7.0);

    const destroyer = new Tank(2, 0, 0);
    destroyer.definition = TANKS_CONFIG.destroyer; // tier 3
    destroyer.level = 30;
    destroyer.maxHp = 200;
    destroyer.hp = 200;
    // 30 * 1.0 + (3 - 1) * 8.0 + (200 / 200) * 6.0 = 30 + 16 + 6 = 52.0
    expect(computeCombatPower(destroyer)).toBe(52.0);
  });

  it('triggers intimidation retreat when weak AI encounters an outmatched apex predator despite 100% HP', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;

    // Lv 1 Newbie bot with 100% HP
    const newbieBot = new Tank(1001, 1000, 1000);
    newbieBot.isAi = true;
    newbieBot.active = true;
    newbieBot.persona = 'newbie'; // intimidationSensitivity = 1.2
    newbieBot.level = 1;
    newbieBot.maxHp = 100;
    newbieBot.hp = 100;

    // Lv 30 Destroyer enemy approaching at (1300, 1000)
    const strongEnemy = new Tank(2, 1300, 1000);
    strongEnemy.active = true;
    strongEnemy.definition = TANKS_CONFIG.destroyer;
    strongEnemy.level = 30;
    strongEnemy.maxHp = 200;
    strongEnemy.hp = 200;

    const shapes: Shape[] = [];
    const allTanks = [strongEnemy, newbieBot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([newbieBot], shapes, allTanks, bulletPool, 1);

    // Power diff = 52 - 7 = 45. 45 * 1.2 = 54 >= 15.0 (AI_INTIMIDATION_POWER_DIFF_THRESHOLD)
    // Newbie bot MUST retreat despite full health!
    expect(newbieBot.aiState).toBe('retreating');
    expect(newbieBot.aiEscapeMaintainTicks).toBe(75);
    expect(newbieBot.input.moveX).toBeLessThan(0); // Flees to the left away from (1300, 1000)
  });

  it('apex persona does not trigger intimidation retreat against moderately higher level foes', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;

    // Lv 15 Apex bot
    const apexBot = new Tank(1001, 1000, 1000);
    apexBot.isAi = true;
    apexBot.active = true;
    apexBot.persona = 'apex'; // intimidationSensitivity = 0.1
    apexBot.definition = TANKS_CONFIG.twin; // tier 2
    apexBot.level = 15;
    apexBot.maxHp = 100;
    apexBot.hp = 100; // Power = 15 + 8 + 6 = 29.0

    // Lv 30 Destroyer enemy (Power = 52.0, Diff = 23.0)
    // 23.0 * 0.1 = 2.3 < 15.0
    const strongEnemy = new Tank(2, 1300, 1000);
    strongEnemy.active = true;
    strongEnemy.definition = TANKS_CONFIG.destroyer;
    strongEnemy.level = 30;
    strongEnemy.maxHp = 200;
    strongEnemy.hp = 200;

    const shapes: Shape[] = [];
    const allTanks = [strongEnemy, apexBot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([apexBot], shapes, allTanks, bulletPool, 1);

    // Apex bot is not intimidated and stays in engaging combat mode!
    expect(apexBot.aiState).toBe('engaging');
  });

  it('deflects fleeing AI laterally along tangent when shape obstacle blocks escape path', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;

    // Bot at (1000, 1000) fleeing to the left because enemy is at (1300, 1000)
    const bot = new Tank(1001, 1000, 1000);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 30; // retreating
    bot.vx = -4.0; // Moving fast to the left
    bot.vy = 0;
    bot.aiStrafeDirection = 1;

    const enemy = new Tank(2, 1300, 1000);
    enemy.active = true;

    // A giant pentagon obstacle is directly to the left in the escape path at (930, 1000)
    const obstacle = new Shape();
    obstacle.init(1, 'pentagon', 930, 1000, 0, 0, 28, 100, 20, 130);

    const shapes = [obstacle];
    const allTanks = [enemy, bot];
    const bulletPool = new ObjectPool<Bullet>(16, () => new Bullet());

    aiSystem.update([bot], shapes, allTanks, bulletPool, 1);

    expect(bot.aiState).toBe('retreating');
    // Escape vector must be deflected laterally (moveY != 0) instead of blindly ramming into the pentagon
    expect(Math.abs(bot.input.moveY)).toBeGreaterThan(0.2);
  });
});
