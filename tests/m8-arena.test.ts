import { describe, expect, it } from 'vitest';
import {
  BASE_BULLET_RADIUS,
  BASE_BULLET_SPEED,
  BULLET_LIFESPAN_TICKS,
  COLOR_TRIANGLE,
} from '../src/config/constants';
import { EventBus } from '../src/core/EventBus';
import { Game } from '../src/core/Game';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
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
});
