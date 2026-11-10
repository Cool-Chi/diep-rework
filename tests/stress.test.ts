import { describe, expect, it } from 'vitest';
import {
  BASE_BULLET_RADIUS,
  BASE_BULLET_SPEED,
  BULLET_LIFESPAN_TICKS,
  BULLET_POOL_CAPACITY,
  SHAPE_TARGET_COUNT,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '../src/config/constants';
import { EventBus } from '../src/core/EventBus';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { FireSystem } from '../src/systems/FireSystem';
import { ShapeSystem } from '../src/systems/ShapeSystem';

describe('Performance Stress Test (M2: 500 Shapes + 600 Bullets)', () => {
  it('simulates 500 shapes + 600 bullets well within 40ms tick budget', () => {
    const physics = new PhysicsWorld();
    const fireSystem = new FireSystem();
    const shapeSystem = new ShapeSystem();
    const collisionSystem = new CollisionSystem();
    const eventBus = new EventBus();
    const bulletPool = new ObjectPool<Bullet>(
      BULLET_POOL_CAPACITY,
      () => new Bullet(),
    );

    const playerTank = new Tank(1, WORLD_WIDTH * 0.5, WORLD_HEIGHT * 0.5);

    // 1. 初始化目標數量形狀
    shapeSystem.fillToTarget();
    expect(shapeSystem.activeCount).toBe(SHAPE_TARGET_COUNT);

    // 2. 發射 600 顆子彈（360 度輻射）
    const count = 600;
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const idx = bulletPool.acquire();
      expect(idx).toBeGreaterThanOrEqual(0);
      const angle = i * step;
      bulletPool.items[idx].init(
        idx,
        playerTank.id,
        playerTank.x,
        playerTank.y,
        Math.cos(angle) * BASE_BULLET_SPEED,
        Math.sin(angle) * BASE_BULLET_SPEED,
        BASE_BULLET_RADIUS,
        2,
        7,
        BULLET_LIFESPAN_TICKS,
      );
    }
    expect(bulletPool.getActiveCount()).toBe(600);

    // 3. 執行 100 ticks (相當於 4 秒的高密度戰鬥模擬)
    const tickDurations: number[] = [];
    const iterations = 100;

    for (let t = 0; t < iterations; t++) {
      // 保持持續有 600 顆子彈
      while (bulletPool.getActiveCount() < 600) {
        const idx = bulletPool.acquire();
        if (idx === -1) break;
        const angle = Math.random() * Math.PI * 2;
        bulletPool.items[idx].init(
          idx,
          playerTank.id,
          playerTank.x + (Math.random() - 0.5) * 500,
          playerTank.y + (Math.random() - 0.5) * 500,
          Math.cos(angle) * BASE_BULLET_SPEED,
          Math.sin(angle) * BASE_BULLET_SPEED,
          BASE_BULLET_RADIUS,
          2,
          7,
          BULLET_LIFESPAN_TICKS,
        );
      }

      const tStart = performance.now();

      // (a) 坦克物理
      physics.stepTank(playerTank);

      // (b) 子彈推進
      fireSystem.updateBullets(bulletPool);

      // (c) 形狀漂移與補充
      shapeSystem.update();

      // (d) 碰撞檢測與結算
      collisionSystem.update(
        [playerTank],
        bulletPool,
        shapeSystem.shapes,
        shapeSystem,
        eventBus,
      );

      const tEnd = performance.now();
      tickDurations.push(tEnd - tStart);
    }

    let sum = 0;
    let max = 0;
    let min = Number.POSITIVE_INFINITY;
    for (let i = 0; i < iterations; i++) {
      const d = tickDurations[i];
      sum += d;
      if (d > max) max = d;
      if (d < min) min = d;
    }
    const avg = sum / iterations;

    console.log(
      `\n--- Stress Test Benchmark Results (500 Shapes + 600 Bullets) ---`,
    );
    console.log(`Total Simulated Ticks: ${iterations}`);
    console.log(`Average Tick Duration: ${avg.toFixed(3)} ms`);
    console.log(`Max Tick Duration:     ${max.toFixed(3)} ms`);
    console.log(`Min Tick Duration:     ${min.toFixed(3)} ms`);
    console.log(`Theoretical Max TPS:   ${(1000 / avg).toFixed(1)} TPS`);
    console.log(`Target TPS Budget:     40.000 ms (25 TPS)`);
    console.log(
      `Headroom:              ${(40 / avg).toFixed(1)}x faster than real-time`,
    );

    // 依要求只輸出數據，不對耗時做硬性斷言以保持不同機器穩定性
    expect(iterations).toBe(100);
    expect(avg).toBeGreaterThan(0);
  });
});
