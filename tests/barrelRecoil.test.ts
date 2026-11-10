import { describe, expect, it } from 'vitest';
import {
  BARREL_RECOIL_DECAY_PER_TICK,
  BASE_BARREL_RECOIL_OFFSET,
  MAX_TANK_BARRELS,
} from '../src/config/constants';
import { TANKS_CONFIG } from '../src/config/tanks.config';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { FireSystem } from '../src/systems/FireSystem';

describe('Barrel Recoil Animation & Multi-Barrel Kickback', () => {
  it('allocates fixed Float32Array for barrel recoils with zero GC', () => {
    const tank = new Tank(1, 0, 0);
    expect(tank.barrelRecoils).toBeInstanceOf(Float32Array);
    expect(tank.prevBarrelRecoils).toBeInstanceOf(Float32Array);
    expect(tank.barrelRecoils).toHaveLength(MAX_TANK_BARRELS);
    expect(tank.prevBarrelRecoils).toHaveLength(MAX_TANK_BARRELS);

    for (let i = 0; i < MAX_TANK_BARRELS; i++) {
      expect(tank.barrelRecoils[i]).toBe(0);
      expect(tank.prevBarrelRecoils[i]).toBe(0);
    }
  });

  it('triggers recoil offset on the firing barrel and copies to prev on prepareStep', () => {
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(10, () => new Bullet());
    const tank = new Tank(1, 0, 0);
    tank.active = true;
    tank.input.shooting = true;
    tank.input.aimX = 100;
    tank.input.aimY = 0;

    // 初始狀態為 0
    expect(tank.barrelRecoils[0]).toBe(0);

    // 模擬 tick 1: 開火
    tank.prepareStep();
    fireSystem.updateTankFiring(tank, bulletPool);

    // 驗證砲管 0 被注入後座力
    const expectedRecoil =
      BASE_BARREL_RECOIL_OFFSET *
      Math.sqrt(tank.definition.barrels[0].recoilMultiplier);
    expect(tank.barrelRecoils[0]).toBeCloseTo(expectedRecoil);

    // 模擬 tick 2: prepareStep 拷貝當前至 prev，並衰減
    tank.prepareStep();
    expect(tank.prevBarrelRecoils[0]).toBeCloseTo(expectedRecoil);

    tank.input.shooting = false; // 停止射擊
    fireSystem.updateTankFiring(tank, bulletPool);

    // 驗證衰減至 expectedRecoil * BARREL_RECOIL_DECAY_PER_TICK
    expect(tank.barrelRecoils[0]).toBeCloseTo(
      expectedRecoil * BARREL_RECOIL_DECAY_PER_TICK,
    );
  });

  it('alternates recoil independently on multi-barrel tanks (Twin)', () => {
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(20, () => new Bullet());
    const tank = new Tank(2, 0, 0);
    tank.setClass(TANKS_CONFIG.twin);
    tank.active = true;
    tank.input.shooting = true;
    tank.input.aimX = 100;
    tank.input.aimY = 0;

    // Twin 有兩管，相位分別為 0 與 0.5
    tank.prepareStep();
    fireSystem.updateTankFiring(tank, bulletPool);

    // 第 1 幀只有管 0 開火並收縮，管 1 處於相位冷卻中未開火
    expect(tank.barrelRecoils[0]).toBeGreaterThan(0);
    expect(tank.barrelRecoils[1]).toBe(0);
  });

  it('fully returns to resting position (0) after consecutive non-firing ticks', () => {
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(10, () => new Bullet());
    const tank = new Tank(3, 0, 0);
    tank.active = true;
    tank.barrelRecoils[0] = 8.0;

    // 連續推進 20 個不開火 tick (約 0.8 秒，足以衰減至 0)
    tank.input.shooting = false;
    for (let t = 0; t < 20; t++) {
      tank.prepareStep();
      fireSystem.updateTankFiring(tank, bulletPool);
    }

    expect(tank.barrelRecoils[0]).toBe(0);
  });

  it('resets recoil values when switching tank class or respawning', () => {
    const tank = new Tank(4, 0, 0);
    tank.barrelRecoils[0] = 8.0;
    tank.prevBarrelRecoils[0] = 8.0;

    tank.setClass(TANKS_CONFIG.destroyer);
    expect(tank.barrelRecoils[0]).toBe(0);
    expect(tank.prevBarrelRecoils[0]).toBe(0);

    tank.barrelRecoils[0] = 12.0;
    tank.respawn(100, 100);
    expect(tank.barrelRecoils[0]).toBe(0);
    expect(tank.prevBarrelRecoils[0]).toBe(0);
  });

  it('handles cosmetic barrels (Ranger) without spawning bullets while triggering synced recoil', () => {
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(10, () => new Bullet());
    const tank = new Tank(5, 0, 0);
    tank.setClass(TANKS_CONFIG.ranger);
    tank.active = true;
    tank.input.shooting = true;
    tank.input.aimX = 100;
    tank.input.aimY = 0;

    tank.prepareStep();
    fireSystem.updateTankFiring(tank, bulletPool);

    // 驗證只生成了 1 顆子彈 (來自 barrel 1 主砲，barrel 0 純外觀不生成子彈)
    expect(bulletPool.getActiveCount()).toBe(1);

    // 驗證兩管皆注入了後座力收縮 (同步後退動畫)
    expect(tank.barrelRecoils[0]).toBeGreaterThan(0);
    expect(tank.barrelRecoils[1]).toBeGreaterThan(0);
    expect(tank.barrelRecoils[0]).toBeCloseTo(tank.barrelRecoils[1]);
  });
});
