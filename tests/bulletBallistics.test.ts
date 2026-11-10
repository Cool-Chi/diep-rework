import { describe, expect, it } from 'vitest';
import {
  BASE_BULLET_RADIUS,
  BULLET_FADEOUT_TICKS,
} from '../src/config/constants';
import {
  BASIC_TANK_DEFINITION,
  DESTROYER_TANK_DEFINITION,
  MACHINE_GUN_TANK_DEFINITION,
  SNIPER_TANK_DEFINITION,
  TANKS_CONFIG,
  TWIN_TANK_DEFINITION,
} from '../src/config/tanks.config';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { FireSystem } from '../src/systems/FireSystem';

describe('Bullet Ballistics & Fade-out Mechanics', () => {
  it('correctly calculates bullet fadeProgress during the last BULLET_FADEOUT_TICKS', () => {
    const bullet = new Bullet();
    bullet.init(0, 1, 0, 0, 1, 0, BASE_BULLET_RADIUS, 2, 7, 75);

    // 飛行中期：大於 8 ticks，不淡出
    bullet.remainingTicks = 50;
    expect(bullet.fadeProgress).toBe(1.0);

    bullet.remainingTicks = BULLET_FADEOUT_TICKS; // 8 ticks
    expect(bullet.fadeProgress).toBe(1.0);

    // 漸逝中段：4 ticks -> 50%
    bullet.remainingTicks = 4;
    expect(bullet.fadeProgress).toBeCloseTo(0.5);

    // 漸逝末段：2 ticks -> 25%
    bullet.remainingTicks = 2;
    expect(bullet.fadeProgress).toBeCloseTo(0.25);

    // 壽命歸零：0%
    bullet.remainingTicks = 0;
    expect(bullet.fadeProgress).toBe(0.0);

    // 負數守護
    bullet.remainingTicks = -1;
    expect(bullet.fadeProgress).toBe(0.0);
  });

  it('anchors bullet radius to barrel tip width across tank classes', () => {
    const fireSystem = new FireSystem();
    const pool = new ObjectPool<Bullet>(10, () => new Bullet());

    // 1. Basic Tank: 砲口 18 -> 半徑 9
    const basicTank = new Tank(1, 0, 0);
    basicTank.setClass(BASIC_TANK_DEFINITION);
    basicTank.input.shooting = true;
    fireSystem.updateTankFiring(basicTank, pool);

    expect(pool.getActiveCount()).toBe(1);
    const basicBullet = pool.items[0];
    expect(basicBullet.radius).toBe(9);
    expect(basicBullet.remainingTicks).toBe(75);
    pool.clear();

    // 2. Destroyer: 巨砲口 36 -> 半徑 18 (2.0x)
    const destroyerTank = new Tank(1, 0, 0);
    destroyerTank.setClass(DESTROYER_TANK_DEFINITION);
    destroyerTank.input.shooting = true;
    fireSystem.updateTankFiring(destroyerTank, pool);

    expect(pool.getActiveCount()).toBe(1);
    const destroyerBullet = pool.items[0];
    expect(destroyerBullet.radius).toBe(18); // BASE_BULLET_RADIUS 9 * 2.0 = 18 (對齊砲口寬度 36)
    expect(destroyerBullet.damage).toBe(destroyerTank.bulletDamage * 3.5);
    expect(destroyerBullet.hp).toBe(destroyerTank.bulletHp * 2.0);
    expect(destroyerBullet.remainingTicks).toBe(70);
    pool.clear();

    // 3. Twin: 雙管各 0.9x 半徑 (18 * 0.5 * 0.9 = 8.1)
    const twinTank = new Tank(1, 0, 0);
    twinTank.setClass(TWIN_TANK_DEFINITION);
    twinTank.input.shooting = true;
    fireSystem.updateTankFiring(twinTank, pool);

    expect(pool.getActiveCount()).toBe(1); // 基準管先發射
    const twinBullet = pool.items[0];
    expect(twinBullet.radius).toBeCloseTo(8.1);
    expect(twinBullet.remainingTicks).toBe(75);
    pool.clear();
  });

  it('verifies specialized bullet lifespans for sniper-branch and rapid classes', () => {
    // Sniper: 105 ticks
    expect(SNIPER_TANK_DEFINITION.barrels[0].bulletLifespanTicks).toBe(105);
    // Assassin: 125 ticks
    expect(TANKS_CONFIG.assassin.barrels[0].bulletLifespanTicks).toBe(125);
    // Machine Gun: 65 ticks
    expect(MACHINE_GUN_TANK_DEFINITION.barrels[0].bulletLifespanTicks).toBe(65);
    // Destroyer: 70 ticks
    expect(DESTROYER_TANK_DEFINITION.barrels[0].bulletLifespanTicks).toBe(70);
    // Basic: 75 ticks
    expect(BASIC_TANK_DEFINITION.barrels[0].bulletLifespanTicks).toBe(75);
  });

  it('generates randomized bullet radii for Machine Gun trapezoidal spray', () => {
    const fireSystem = new FireSystem();
    const pool = new ObjectPool<Bullet>(20, () => new Bullet());
    const mgTank = new Tank(1, 0, 0);
    mgTank.setClass(MACHINE_GUN_TANK_DEFINITION);

    const radii: number[] = [];
    for (let i = 0; i < 10; i++) {
      mgTank.barrelCooldowns[0] = 0;
      mgTank.input.shooting = true;
      fireSystem.updateTankFiring(mgTank, pool);
      const activeIdx = pool.getActiveCount() - 1;
      radii.push(pool.items[activeIdx].radius);
    }

    // 驗證隨機性：10 發子彈中至少存在不同的尺寸
    const uniqueRadii = new Set(radii);
    expect(uniqueRadii.size).toBeGreaterThan(1);
    // 基準 9，浮動 0.85 ~ 1.10 -> 半徑約 7.65 ~ 9.9
    for (const r of radii) {
      expect(r).toBeGreaterThanOrEqual(9 * 0.84);
      expect(r).toBeLessThanOrEqual(9 * 1.11);
    }
  });
});
