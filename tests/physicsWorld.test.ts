import { describe, expect, it } from 'vitest';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

describe('PhysicsWorld', () => {
  it('無輸入時速度應依每 tick 阻尼持續遞減', () => {
    const physics = new PhysicsWorld(4000, 4000, 0.95, 0.85, 0.2);
    const tank = new Tank(1, 2000, 2000, 25);
    tank.vx = 10;
    tank.vy = 0;

    physics.stepTank(tank);
    expect(tank.vx).toBeCloseTo(10 * 0.85, 4);

    physics.stepTank(tank);
    expect(tank.vx).toBeCloseTo(10 * 0.85 * 0.85, 4);
  });

  it('坦克觸碰地圖邊界時應被限制在邊界內，不得穿出', () => {
    const physics = new PhysicsWorld(4000, 4000, 1.0, 0.85, 0.2);
    const r = 25;
    const tank = new Tank(1, 20, 2000, r); // 初始位置小於半徑
    tank.vx = -10;

    physics.stepTank(tank);
    // 應被夾住在 x = r
    expect(tank.x).toBe(r);
    // 撞牆後速度反轉並依 WALL_BOUNCE_FACTOR 衰減
    expect(tank.vx).toBeCloseTo(10 * 0.85 * 0.2, 4);

    // 測試右邊界
    tank.x = 3990;
    tank.vx = 20;
    physics.stepTank(tank);
    expect(tank.x).toBe(4000 - r);
    expect(tank.vx).toBeLessThan(0);
  });

  it('持續直線前進應收斂於理論極速，且數值無 NaN', () => {
    const accel = 0.95;
    const damping = 0.85;
    const theoreticalMaxSpeed = (accel * damping) / (1 - damping); // ~5.3833

    const physics = new PhysicsWorld(4000, 4000, accel, damping, 0.2);
    const tank = new Tank(1, 2000, 2000, 25);
    tank.input.moveX = 1;
    tank.input.moveY = 0;

    // 模擬 60 個 ticks 達到穩態
    for (let i = 0; i < 60; i++) {
      physics.stepTank(tank);
      expect(Number.isNaN(tank.x)).toBe(false);
      expect(Number.isNaN(tank.vx)).toBe(false);
    }

    expect(tank.vx).toBeCloseTo(theoreticalMaxSpeed, 2);
    expect(tank.vy).toBe(0);
  });

  it('斜向輸入經正規化後，其合速度不得大於直線極速', () => {
    const accel = 0.95;
    const damping = 0.85;
    const physics = new PhysicsWorld(4000, 4000, accel, damping, 0.2);

    // 1. 直線坦克
    const straightTank = new Tank(1, 2000, 2000, 25);
    straightTank.input.moveX = 1;
    straightTank.input.moveY = 0;
    for (let i = 0; i < 60; i++) {
      physics.stepTank(straightTank);
    }
    const straightSpeed = Math.sqrt(
      straightTank.vx * straightTank.vx + straightTank.vy * straightTank.vy,
    );

    // 2. 斜向坦克 (moveX = 1, moveY = 1)
    const diagTank = new Tank(2, 2000, 2000, 25);
    diagTank.input.moveX = 1;
    diagTank.input.moveY = 1;
    for (let i = 0; i < 60; i++) {
      physics.stepTank(diagTank);
    }
    const diagSpeed = Math.sqrt(
      diagTank.vx * diagTank.vx + diagTank.vy * diagTank.vy,
    );

    // 斜向極速應與直線極速完全相同（不應產生 sqrt(2) 增速）
    expect(diagSpeed).toBeCloseTo(straightSpeed, 3);
    expect(diagSpeed).toBeLessThanOrEqual(straightSpeed + 0.0001);
  });
});
