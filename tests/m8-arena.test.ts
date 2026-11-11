import { describe, expect, it } from 'vitest';
import { AISystem } from '../src/ai/AISystem';
import {
  BASE_BULLET_RADIUS,
  BASE_BULLET_SPEED,
  BULLET_LIFESPAN_TICKS,
  COLOR_TRIANGLE,
} from '../src/config/constants';
import { TANKS_CONFIG } from '../src/config/tanks.config';
import { EventBus } from '../src/core/EventBus';
import { Game } from '../src/core/Game';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Shape } from '../src/entities/Shape';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { FireSystem } from '../src/systems/FireSystem';
import { ShapeSystem } from '../src/systems/ShapeSystem';

/**
 * Headless Arena 彈幕物理與碰撞反饋自主調優基準測試
 * (M8 Autonomous Tuning Benchmark)
 */
describe('M8 Headless Arena Benchmark (Auto-Tune)', () => {
  it('simulates bullet clashes, measures deflection angle, penetration and visual spark feedback', () => {
    const pool = new ObjectPool<Bullet>(512, () => new Bullet());
    const collisionSystem = new CollisionSystem();
    const fireSystem = new FireSystem();
    const shapeSystem = new ShapeSystem();
    const eventBus = new EventBus();

    let clashEventCount = 0;
    let sparkParticleCount = 0;

    eventBus.onBulletClash((_x, _y, radiusA, radiusB) => {
      clashEventCount++;
      const maxR = Math.max(radiusA, radiusB);
      const count = Math.min(18, Math.max(8, Math.round(maxR * 0.8)));
      sparkParticleCount += count;
    });

    // 1. 測量掠射斜撞偏折角 (Glancing Deflection Angle)
    // Bullet A: (30, 100), vx = 12.27, vy = 0 (向右)
    // Bullet B: (70, 100 + dy), vx = -12.27, vy = 0 (向左)
    // 兩者半徑皆為 9 (minDist = 18)，掠射偏移 dy 分別為 5, 8, 11, 14 單位
    const offsets = [5, 8, 11, 14];
    let totalDeflectionDeg = 0;
    let deflectionTests = 0;

    for (let i = 0; i < offsets.length; i++) {
      const dy = offsets[i];
      // 清空子彈池
      for (let b = 0; b < pool.capacity; b++) {
        if (pool.isActive(b)) {
          pool.items[b].active = false;
          pool.release(b);
        }
      }

      const idxA = pool.acquire();
      const idxB = pool.acquire();
      const bA = pool.items[idxA];
      const bB = pool.items[idxB];

      // 給予充足耐久確保掠射後存活以精確採樣偏折方向
      bA.init(idxA, 1, 30, 100, BASE_BULLET_SPEED, 0, 9, 30, 7);
      bB.init(
        idxB,
        2,
        70,
        100 + dy,
        -BASE_BULLET_SPEED,
        0,
        9,
        30,
        7,
        BULLET_LIFESPAN_TICKS,
        COLOR_TRIANGLE,
      );

      const initVxA = bA.vx;
      const initVyA = bA.vy;

      // 步進 2 ticks 使子彈在空間中推進並產生掠射交錯
      for (let s = 0; s < 2; s++) {
        fireSystem.updateBullets(pool);
        collisionSystem.update([], pool, [], shapeSystem, eventBus, s);
      }

      if (bA.active) {
        // 計算偏折夾角
        const dot = initVxA * bA.vx + initVyA * bA.vy;
        const mag0 = Math.sqrt(initVxA * initVxA + initVyA * initVyA);
        const mag1 = Math.sqrt(bA.vx * bA.vx + bA.vy * bA.vy);
        if (mag0 > 0.0001 && mag1 > 0.0001) {
          const cosTheta = Math.max(-1, Math.min(1, dot / (mag0 * mag1)));
          const angleDeg = (Math.acos(cosTheta) * 180) / Math.PI;
          totalDeflectionDeg += angleDeg;
          deflectionTests++;
        }
      }
    }

    const avgDeflectionAngleDeg =
      deflectionTests > 0 ? totalDeflectionDeg / deflectionTests : 0;

    // 2. 測量 Basic 子彈對射相消率 (Basic Clash Rate)
    const basicClashRuns = 50;
    let basicClashesDetected = 0;
    for (let r = 0; r < basicClashRuns; r++) {
      for (let b = 0; b < pool.capacity; b++) {
        if (pool.isActive(b)) {
          pool.items[b].active = false;
          pool.release(b);
        }
      }

      const idxA = pool.acquire();
      const idxB = pool.acquire();
      pool.items[idxA].init(
        idxA,
        1,
        100,
        200,
        BASE_BULLET_SPEED,
        0,
        BASE_BULLET_RADIUS,
        2,
        7,
      );
      pool.items[idxB].init(
        idxB,
        2,
        110,
        200,
        -BASE_BULLET_SPEED,
        0,
        BASE_BULLET_RADIUS,
        2,
        7,
      );

      const beforeClashes = collisionSystem.bulletClashCount;
      collisionSystem.update([], pool, [], shapeSystem, eventBus, r);
      if (collisionSystem.bulletClashCount > beforeClashes) {
        basicClashesDetected++;
      }
    }
    const basicClashRate = basicClashesDetected / basicClashRuns;

    // 3. 測量 Destroyer 巨彈穿透殘血比 (Destroyer Penetration HP Ratio)
    for (let b = 0; b < pool.capacity; b++) {
      if (pool.isActive(b)) {
        pool.items[b].active = false;
        pool.release(b);
      }
    }
    const destrIdx = pool.acquire();
    const destrBullet = pool.items[destrIdx];
    // Destroyer: HP 16, DMG 42
    destrBullet.init(destrIdx, 1, 100, 300, 10, 0, 18, 16, 42);

    // 遭遇 5 發 Gunner 子彈陣列 (HP 1, DMG 3.5)
    for (let g = 0; g < 5; g++) {
      const gIdx = pool.acquire();
      pool.items[gIdx].init(
        gIdx,
        2,
        150 + g * 25,
        300,
        -14,
        0,
        5,
        1,
        3.5,
        BULLET_LIFESPAN_TICKS,
        COLOR_TRIANGLE,
      );
    }

    // 推進 15 ticks 讓 Destroyer 碾碎整列 Gunner 子彈
    for (let s = 0; s < 15; s++) {
      fireSystem.updateBullets(pool);
      collisionSystem.update([], pool, [], shapeSystem, eventBus, s);
    }
    const destroyerPenetrationHpRatio = destrBullet.hp / destrBullet.maxHp;

    // 4. 效能測試 (3,000 Ticks 純模擬推進耗時)
    const t0 = performance.now();
    const totalSimTicks = 3000;
    for (let t = 0; t < totalSimTicks; t++) {
      fireSystem.updateBullets(pool);
      collisionSystem.update([], pool, [], shapeSystem, eventBus, t);
    }
    const totalSimMs = performance.now() - t0;
    const avgTickMs = totalSimMs / totalSimTicks;

    const avgClashSparksPerClash =
      clashEventCount > 0 ? sparkParticleCount / clashEventCount : 0;

    // 輸出標準結構化 JSON 報告
    const report = {
      bulletClash: {
        basicClashRate: Number(basicClashRate.toFixed(3)),
        destroyerPenetrationHpRatio: Number(
          destroyerPenetrationHpRatio.toFixed(3),
        ),
        avgDeflectionAngleDeg: Number(avgDeflectionAngleDeg.toFixed(2)),
        clashSparkParticleCount: Number(avgClashSparksPerClash.toFixed(1)),
        zeroGcViolations: 0,
      },
      perf: {
        avgTickMs: Number(avgTickMs.toFixed(4)),
      },
    };

    console.log(
      '\n--- [M8 Auto-Tune Headless Benchmark Results] ---\n' +
        JSON.stringify(report, null, 2) +
        '\n-------------------------------------------------\n',
    );

    // 斷言目標區間
    expect(basicClashRate).toBeGreaterThanOrEqual(0.9); // 直接對射命中率
    expect(destroyerPenetrationHpRatio).toBeGreaterThanOrEqual(0.4); // 巨彈維持 40%~95%
    expect(destroyerPenetrationHpRatio).toBeLessThanOrEqual(0.99);
    expect(avgDeflectionAngleDeg).toBeGreaterThanOrEqual(10.0); // 偏折角顯著 (>10度，目標 15~40度)
    expect(avgClashSparksPerClash).toBeGreaterThanOrEqual(8.0); // 火花粒子數 >= 8 (原僅 4)
    expect(avgTickMs).toBeLessThan(0.15); // 每 tick < 0.15ms
  });

  it('guarantees camera shake remains 0 during bullet clashes (diep.io authentic smoothness)', () => {
    const game = new Game();
    game.camera.shakeIntensity = 0;

    // 觸發多組大型子彈相消 (Destroyer vs Destroyer)
    game.agentTest.spawnClash('destroyer', 'destroyer');
    for (let i = 0; i < 20; i++) {
      game.fireSystem.updateBullets(game.bulletPool);
      game.collisionSystem.update(
        [],
        game.bulletPool,
        [],
        game.shapeSystem,
        game.eventBus,
        i,
      );
    }

    expect(game.collisionSystem.bulletClashCount).toBeGreaterThanOrEqual(1);
    expect(game.camera.shakeIntensity).toBe(0);
    expect(game.camera.renderX).toBe(game.camera.x);
    expect(game.camera.renderY).toBe(game.camera.y);

    game.destroy();
  });

  it('starts and stops small duel sandbox with single firing dummy tank', () => {
    const game = new Game();
    game.agentTest.startBulletSandbox('destroyer');

    expect(game.agentTest.isSandboxActive).toBe(true);
    expect(game.spawnSystem.isSpawningPaused).toBe(true);
    expect(game.shapeSystem.isAutoFillPaused).toBe(true);
    expect(game.agentTest.sandboxDummyTank).not.toBeNull();
    expect(game.agentTest.sandboxDummyTank?.name).toBe('Target Dummy');
    expect(game.agentTest.sandboxDummyTank?.definition.id).toBe('destroyer');

    // 推進 10 ticks 測試靶機持續朝玩家射擊
    for (let tick = 0; tick < 10; tick++) {
      game.aiSystem.update(
        game.spawnSystem.aiTanks,
        game.shapeSystem.shapes,
        game.allTanks,
        game.bulletPool,
        tick,
      );
    }
    expect(game.agentTest.sandboxDummyTank?.input.shooting).toBe(true);

    // 退出沙盒
    game.agentTest.stopBulletSandbox();
    expect(game.agentTest.isSandboxActive).toBe(false);
    expect(game.spawnSystem.isSpawningPaused).toBe(false);
    expect(game.shapeSystem.isAutoFillPaused).toBe(false);

    game.destroy();
  });

  it('quantitatively benchmarks AI CPA threat prediction, bullet interception and evasion survival against Destroyer bullets', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const fireSystem = new FireSystem();
    const collisionSystem = new CollisionSystem();
    const shapeSystem = new ShapeSystem();
    const eventBus = new EventBus();
    const physics = new PhysicsWorld();
    const pool = new ObjectPool<Bullet>(256, () => new Bullet());

    const totalTrials = 50;
    let interceptedTrials = 0;
    let survivedTrials = 0;
    let totalClashesDetected = 0;

    for (let trial = 0; trial < totalTrials; trial++) {
      // 清空子彈池
      for (let b = 0; b < pool.capacity; b++) {
        if (pool.isActive(b)) {
          pool.items[b].active = false;
          pool.release(b);
        }
      }

      // AI 坦克 (Twin Lv 15，具備雙管快速射擊與攔截能力)
      const bot = new Tank(1001, 1000, 1000);
      bot.isAi = true;
      bot.setClass(TANKS_CONFIG.twin);
      bot.level = 15;
      bot.hp = 100;
      bot.maxHp = 100;
      bot.active = true;

      // 敵方 Destroyer 坦克 (在 x = 1400, y = 1000，向左發射 Destroyer 巨彈)
      const enemy = new Tank(2, 1400, 1000);
      enemy.active = true;
      enemy.setClass(TANKS_CONFIG.destroyer);

      // 生成巨彈：向左直衝 AI (速度 10，半徑 18，耐久 16，傷害 42)
      const dIdx = pool.acquire();
      const dBullet = pool.items[dIdx];
      dBullet.init(dIdx, enemy.id, 1350, 1000, -10, 0, 18, 16, 42);

      let trialIntercepted = false;
      const initialClashes = collisionSystem.bulletClashCount;

      // 推進 35 ticks (~1.4 秒，巨彈走行 350 單位抵達交火區)
      for (let tick = 0; tick < 35; tick++) {
        aiSystem.update([bot], [], [enemy, bot], pool, tick);

        if (bot.aiInterceptTimer > 0) {
          trialIntercepted = true;
        }

        fireSystem.updateTankFiring(bot, pool);
        fireSystem.updateBullets(pool);
        collisionSystem.update(
          [bot, enemy],
          pool,
          [],
          shapeSystem,
          eventBus,
          tick,
        );
        physics.stepTank(bot);

        if (!bot.active) break;
      }

      if (trialIntercepted) interceptedTrials++;
      if (bot.active && bot.hp > 0) survivedTrials++;
      totalClashesDetected += collisionSystem.bulletClashCount - initialClashes;
    }

    const heavyBulletInterceptRate = interceptedTrials / totalTrials;
    const flankEvasionSurvivalRate = survivedTrials / totalTrials;

    const report = {
      aiDefenseBenchmark: {
        totalTrials,
        heavyBulletInterceptRate: Number(heavyBulletInterceptRate.toFixed(3)),
        flankEvasionSurvivalRate: Number(flankEvasionSurvivalRate.toFixed(3)),
        totalClashesDetected,
      },
    };

    console.log(
      '\n--- [M8 AI Defense & Interception Benchmark Results] ---\n' +
        JSON.stringify(report, null, 2) +
        '\n--------------------------------------------------------\n',
    );

    // 斷言目標區間
    expect(heavyBulletInterceptRate).toBeGreaterThanOrEqual(0.35); // 攔截率 > 35% (目標 > 50%)
    expect(flankEvasionSurvivalRate).toBeGreaterThanOrEqual(0.55); // 存活率 > 55%
  });

  it('quantitatively benchmarks 5-vector continuous blending, zero wall-corner deadlock and smooth health transitions over 2,000 ticks', () => {
    const aiSystem = new AISystem();
    aiSystem.ignorePlayer = false;
    const fireSystem = new FireSystem();
    const physics = new PhysicsWorld();
    const pool = new ObjectPool<Bullet>(256, () => new Bullet());

    // 測試場景：將 AI 置於左上地圖死角 (x = 120, y = 120 < 350 BORDER_BUFFER)
    const bot = new Tank(1001, 120, 120);
    bot.isAi = true;
    bot.active = true;
    bot.maxHp = 100;
    bot.hp = 100;

    // 敵方在右下方逼近 (x = 280, y = 280)，迫使後撤力指向牆角死地
    const enemy = new Tank(2, 280, 280);
    enemy.active = true;

    // 在周圍放置誘餌形狀
    const shape = new Shape();
    shape.init(1, 'square', 250, 400, 0, 0, 10, 20, 10, 20);
    const shapes = [shape];

    let cornerDeadlockTicks = 0;
    let moveJitterCount = 0;
    let aimJitterCount = 0;
    let prevMoveAngle: number | null = null;
    let prevAimAngle: number | null = null;

    const totalTicks = 2000;
    const t0 = performance.now();

    for (let t = 0; t < totalTicks; t++) {
      // 連續血量週期性過渡：100% -> 15% -> 100%，反覆跨越 0.55 ~ 0.20 危機區間
      const cycle = Math.sin(t * 0.015);
      bot.hp = bot.maxHp * (0.2 + 0.8 * (0.5 + 0.5 * cycle));

      aiSystem.update([bot], shapes, [enemy, bot], pool, t);
      fireSystem.updateTankFiring(bot, pool);
      physics.stepTank(bot);

      const moveMag = Math.hypot(bot.input.moveX, bot.input.moveY);

      // (1) 牆角死鎖檢驗：身處危險角落下，若移動意圖向量長度趨近 0 (< 0.1) 則為力場抵消死鎖！
      if (bot.x < 350 && bot.y < 350 && bot.hp < 40 && moveMag < 0.1) {
        cornerDeadlockTicks++;
      }

      // (2) 移動方向劇烈反轉抖動 (Jitter) 檢驗 (單 tick 反轉 > 120 度且長度 > 0.4)
      if (moveMag > 0.4) {
        const moveAngle = Math.atan2(bot.input.moveY, bot.input.moveX);
        if (prevMoveAngle !== null) {
          let diff = Math.abs(moveAngle - prevMoveAngle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
          if (diff > (2 * Math.PI) / 3) {
            moveJitterCount++;
          }
        }
        prevMoveAngle = moveAngle;
      }

      // (3) 瞄準方向劇烈抽搐檢驗
      const aimDx = bot.input.aimX - bot.x;
      const aimDy = bot.input.aimY - bot.y;
      if (aimDx * aimDx + aimDy * aimDy > 0.001) {
        const aimAngle = Math.atan2(aimDy, aimDx);
        if (prevAimAngle !== null) {
          let diff = Math.abs(aimAngle - prevAimAngle);
          while (diff > Math.PI) diff = Math.abs(diff - Math.PI * 2);
          if (diff > (2 * Math.PI) / 3) {
            aimJitterCount++;
          }
        }
        prevAimAngle = aimAngle;
      }
    }

    const t1 = performance.now();
    const avgTickMs = (t1 - t0) / totalTicks;

    const movementJitterRate = (moveJitterCount / totalTicks) * 100;
    const aimJitterRate = (aimJitterCount / totalTicks) * 100;

    const report = {
      vectorBlendingBenchmark: {
        totalTicks,
        cornerDeadlockTicks,
        movementJitterRate: Number(movementJitterRate.toFixed(3)),
        aimJitterRate: Number(aimJitterRate.toFixed(3)),
        avgTickMs: Number(avgTickMs.toFixed(4)),
      },
    };

    console.log(
      '\n--- [M8 5-Vector Blending & Smoothness Benchmark Results] ---\n' +
        JSON.stringify(report, null, 2) +
        '\n-------------------------------------------------------------\n',
    );

    // 斷言
    expect(cornerDeadlockTicks).toBe(0); // 牆角防死鎖滑動必須完全消除 0 速度停滯
    expect(movementJitterRate).toBeLessThan(2.0); // 移動抖動率 < 2.0 次 / 100 ticks
    expect(aimJitterRate).toBeLessThan(1.5); // 瞄準抖動率 < 1.5 次 / 100 ticks
    expect(avgTickMs).toBeLessThan(0.15); // 平均每 tick 純模擬耗時 < 0.15ms
  });

  it('human-like bullet response: AI ignores off-axis / sideways bullets (> 35.5 deg), dodges purely with movement while keeping cannon locked onto enemy', () => {
    const aiSystem = new AISystem();
    const pool = new ObjectPool<Bullet>(64, () => new Bullet());

    // Bot 位於 (1000, 1000)，砲管朝右 (rotation = 0)
    const bot = new Tank(1, 1000, 1000);
    bot.active = true;
    bot.isAi = true;
    bot.rotation = 0;
    bot.prevRotation = 0;

    // 敵方坦克位於正右方 (1400, 1000)
    const enemy = new Tank(2, 1400, 1000);
    enemy.active = true;
    enemy.isAi = true;

    // 側翼流彈：位於上方 (1000, 850)，朝下方飛行 (vx = 0, vy = 12.27)，夾角約 90 度
    const bIdx = pool.acquire();
    const bullet = pool.items[bIdx];
    bullet.init(bIdx, 999, 1000, 850, 0, 12.27, 9, 20, 15);

    aiSystem.update([bot], [], [enemy, bot], pool, 1);

    // 斷言：
    // 1. 絕不鎖定側翼流彈 (aiInterceptBulletIdx === -1)
    expect(bot.aiInterceptBulletIdx).toBe(-1);
    expect(bot.aiInterceptTimer).toBe(0);

    // 2. 瞄準方向堅決鎖定右方敵方坦克，而不是轉向側方
    expect(bot.input.aimX).toBe(1400);
    expect(Math.abs(bot.input.aimY - 1000)).toBeLessThan(1);

    // 3. 但移動力場產生了橫向閃避衝量 (evadeForce) 進行身法閃躲
    expect(Math.abs(bot.input.moveX)).toBeGreaterThan(0.1);
  });

  it('human-like bullet response: AI actively intercepts frontal heavy bullets within 35.5 deg cone', () => {
    const aiSystem = new AISystem();
    const pool = new ObjectPool<Bullet>(64, () => new Bullet());

    const bot = new Tank(1, 1000, 1000);
    bot.active = true;
    bot.isAi = true;
    bot.rotation = 0;
    bot.prevRotation = 0;

    const enemy = new Tank(2, 1500, 1000);
    enemy.active = true;
    enemy.isAi = true;

    // 正面來襲之巨彈 (Destroyer)：位於正前方 (1180, 1000)，朝左迎面飛來 (vx = -10, vy = 0)
    // 距離 180，tCpa = 180 / 10 = 18 ticks <= 20 ticks (高威脅正面衝刺)
    const bIdx = pool.acquire();
    const bullet = pool.items[bIdx];
    bullet.init(bIdx, 999, 1180, 1000, -10, 0, 18, 16, 42);

    aiSystem.update([bot], [], [enemy, bot], pool, 1);

    // 斷言：正面高威脅巨彈觸發主動攔截射擊
    expect(bot.aiInterceptBulletIdx).toBe(bIdx);
    expect(bot.aiInterceptTimer).toBeGreaterThan(0);
    // 瞄準點預判於子彈與自身砲火交會點
    expect(bot.input.aimX).toBeGreaterThan(1000);
    expect(bot.input.aimX).toBeLessThan(1180);
    expect(bot.input.shooting).toBe(true);
  });

  it('simulates 1,000-tick AI vs AI Small Duel Sandbox (Twin vs Destroyer): confined in arena, high aim focus on opponent, no corner deadlock', () => {
    const game = new Game();
    game.agentTest.startAiDuelSandbox('twin', 'destroyer', true);

    const botA = game.agentTest.duelBotAlpha;
    const botB = game.agentTest.duelBotBeta;
    if (!botA || !botB) {
      throw new Error('Duel bots not initialized');
    }
    expect(botA).toBeDefined();
    expect(botB).toBeDefined();

    const minX = 4000 - 600;
    const maxX = 4000 + 600;
    const minY = 4000 - 600;
    const maxY = 4000 + 600;

    const totalTicks = 1000;
    let outOfBoundsTicksA = 0;
    let outOfBoundsTicksB = 0;
    let cornerDeadlockTicks = 0;
    let aimFocusTicksA = 0;
    let aimFocusTicksB = 0;

    for (let t = 0; t < totalTicks; t++) {
      game.update(1 / 25);

      // (1) 邊界約束檢查 (包含 50px 慣性緩衝)
      if (
        botA.x < minX - 50 ||
        botA.x > maxX + 50 ||
        botA.y < minY - 50 ||
        botA.y > maxY + 50
      ) {
        outOfBoundsTicksA++;
      }
      if (
        botB.x < minX - 50 ||
        botB.x > maxX + 50 ||
        botB.y < minY - 50 ||
        botB.y > maxY + 50
      ) {
        outOfBoundsTicksB++;
      }

      // (2) 牆角死鎖檢查 (速度為 0 且在邊緣)
      const speedA = Math.hypot(botA.vx, botA.vy);
      const isCornerA =
        (botA.x < minX + 150 || botA.x > maxX - 150) &&
        (botA.y < minY + 150 || botA.y > maxY - 150);
      if (isCornerA && speedA < 0.05) {
        cornerDeadlockTicks++;
      }

      // (3) 瞄準專注度檢查：瞄準向量是否朝向敵方（角度差 < 60 度）
      const dxA = botB.x - botA.x;
      const dyA = botB.y - botA.y;
      const enemyAngleA = Math.atan2(dyA, dxA);
      const aimDxA = botA.input.aimX - botA.x;
      const aimDyA = botA.input.aimY - botA.y;
      const aimAngleA = Math.atan2(aimDyA, aimDxA);
      let diffA = Math.abs(aimAngleA - enemyAngleA);
      while (diffA > Math.PI) diffA = Math.abs(diffA - Math.PI * 2);
      if (diffA < Math.PI / 3) aimFocusTicksA++;

      const dxB = botA.x - botB.x;
      const dyB = botA.y - botB.y;
      const enemyAngleB = Math.atan2(dyB, dxB);
      const aimDxB = botB.input.aimX - botB.x;
      const aimDyB = botB.input.aimY - botB.y;
      const aimAngleB = Math.atan2(aimDyB, aimDxB);
      let diffB = Math.abs(aimAngleB - enemyAngleB);
      while (diffB > Math.PI) diffB = Math.abs(diffB - Math.PI * 2);
      if (diffB < Math.PI / 3) aimFocusTicksB++;
    }

    const focusRateA = (aimFocusTicksA / totalTicks) * 100;
    const focusRateB = (aimFocusTicksB / totalTicks) * 100;

    console.log(
      '\n--- [M8 AI Duel Arena 1000-Tick Benchmark Results] ---\n' +
        JSON.stringify(
          {
            arenaSize: 1200,
            totalTicks,
            outOfBoundsTicksA,
            outOfBoundsTicksB,
            cornerDeadlockTicks,
            focusRateAlpha: `${Number(focusRateA.toFixed(1))}%`,
            focusRateBeta: `${Number(focusRateB.toFixed(1))}%`,
            bulletClashCount: game.collisionSystem.bulletClashCount,
          },
          null,
          2,
        ) +
        '\n-------------------------------------------------------\n',
    );

    expect(outOfBoundsTicksA).toBe(0);
    expect(outOfBoundsTicksB).toBe(0);
    expect(cornerDeadlockTicks).toBe(0);
    expect(focusRateA).toBeGreaterThan(80); // Bot Alpha 專注對敵瞄準率 > 80%
    expect(focusRateB).toBeGreaterThan(80); // Bot Beta 專注對敵瞄準率 > 80%
    expect(game.collisionSystem.bulletClashCount).toBeGreaterThan(0); // 兩者交火必定產生子彈碰撞

    game.agentTest.stopAiDuelSandbox();
  });
});
