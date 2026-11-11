import { describe, expect, it } from 'vitest';
import { BASE_BULLET_SPEED, BASE_TANK_RADIUS } from '../src/config/constants';
import {
  STAT_BODY_DAMAGE,
  STAT_BULLET_DAMAGE,
  STAT_BULLET_PENETRATION,
  STAT_BULLET_SPEED,
  STAT_HEALTH_REGEN,
  STAT_MAX_HEALTH,
  STAT_MOVEMENT_SPEED,
  STAT_RELOAD,
} from '../src/config/stats.config';
import { recomputeDerivedStats } from '../src/core/deriveStats';
import { Tank } from '../src/entities/Tank';

describe('Derived Stats Computation and Synchronous Scaling (M3a)', () => {
  it('Lv 1 且全 0 點狀態下衍生屬性完全等同 M2 基準值', () => {
    const tank = new Tank(1, 0, 0);
    recomputeDerivedStats(tank);

    expect(tank.level).toBe(1);
    expect(tank.radius).toBe(BASE_TANK_RADIUS); // 25
    expect(tank.maxHp).toBe(50);
    expect(tank.hp).toBe(50);
    expect(tank.bodyDamage).toBe(20);
    expect(tank.bodyDamageToTank).toBe(30);
    expect(tank.bodyDamageToBullet).toBe(5);
    expect(tank.bulletHp).toBeCloseTo(1.2, 5);
    expect(tank.bulletDamage).toBe(7);
    expect(tank.reloadTicks).toBe(15);
    expect(tank.bulletSpeed).toBe(BASE_BULLET_SPEED);
    expect(tank.moveAccelScale).toBeCloseTo(1.0, 5);
  });

  it('Lv 30 坦克半徑按 1.01^29 擴大', () => {
    const tank = new Tank(1, 0, 0);
    tank.level = 30;
    recomputeDerivedStats(tank);

    const expectedRadius = 25 * 1.01 ** 29;
    expect(tank.radius).toBeCloseTo(expectedRadius, 5);
  });

  it('最大生命值增加時，當前生命值同步等額增加 (hp += delta)', () => {
    const tank = new Tank(1, 0, 0);
    tank.hp = 30; // 受到傷害後剩餘 30/50 血
    tank.maxHp = 50;

    // 投資 1 點 MaxHealth (+20 maxHp)
    tank.statLevels[STAT_MAX_HEALTH] = 1;
    recomputeDerivedStats(tank);

    expect(tank.maxHp).toBe(70);
    // 當前生命值同步增加 20 點: 30 + 20 = 50
    expect(tank.hp).toBe(50);

    // 升級至 Lv 2 (+2 maxHp)
    tank.level = 2;
    recomputeDerivedStats(tank);

    expect(tank.maxHp).toBe(72);
    expect(tank.hp).toBe(52);
  });

  it('滿點 (p=7) 衍生戰鬥屬性符合原版 Golden Values', () => {
    const tank = new Tank(1, 0, 0);
    tank.statLevels[STAT_HEALTH_REGEN] = 7;
    tank.statLevels[STAT_MAX_HEALTH] = 7;
    tank.statLevels[STAT_BODY_DAMAGE] = 7;
    tank.statLevels[STAT_BULLET_SPEED] = 7;
    tank.statLevels[STAT_BULLET_PENETRATION] = 7;
    tank.statLevels[STAT_BULLET_DAMAGE] = 7;
    tank.statLevels[STAT_RELOAD] = 7;
    tank.statLevels[STAT_MOVEMENT_SPEED] = 7;

    recomputeDerivedStats(tank);

    expect(tank.maxHp).toBe(190); // 50 + 20*7
    expect(tank.bodyDamage).toBe(48); // (7+5)*4
    expect(tank.bodyDamageToTank).toBe(72); // (7+5)*6
    expect(tank.bodyDamageToBullet).toBe(12); // 7+5
    expect(tank.bulletHp).toBeCloseTo(8.9, 5); // 1.2 + 1.1*7
    expect(tank.bulletDamage).toBe(28); // 7 + 3*7
    expect(tank.reloadTicks).toBe(8); // 15 - 7
    expect(tank.bulletSpeed).toBeCloseTo(16.2, 4); // 9.2 + 1.0*7
    expect(tank.moveAccelScale).toBeGreaterThan(1.0);
  });
});
