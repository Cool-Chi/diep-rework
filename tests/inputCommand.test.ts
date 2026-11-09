import { describe, expect, it } from 'vitest';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';

describe('InputCommand Normalization', () => {
  it('長度大於 1 的輸入向量應被正規化至長度 1', () => {
    const physics = new PhysicsWorld();
    const tank = new Tank(1, 1000, 1000);

    // 輸入極端長度向量 (3, 4)
    tank.input.moveX = 3;
    tank.input.moveY = 4;

    physics.stepTank(tank);

    // 加速度比例應為 3/5 與 4/5
    const expectedAx = (3 / 5) * physics.moveAccel;
    const expectedAy = (4 / 5) * physics.moveAccel;

    expect(tank.vx).toBeCloseTo(expectedAx * physics.damping, 4);
    expect(tank.vy).toBeCloseTo(expectedAy * physics.damping, 4);
  });

  it('長度小於 1 的輸入向量應保持原長度不被放大', () => {
    const physics = new PhysicsWorld();
    const tank = new Tank(1, 1000, 1000);

    // 微調輸入 (0.5, 0)
    tank.input.moveX = 0.5;
    tank.input.moveY = 0;

    physics.stepTank(tank);

    const expectedAx = 0.5 * physics.moveAccel;
    expect(tank.vx).toBeCloseTo(expectedAx * physics.damping, 4);
    expect(tank.vy).toBe(0);
  });
});
