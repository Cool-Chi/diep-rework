import { describe, expect, it } from 'vitest';
import {
  BASIC_TANK_DEFINITION,
  FLANK_GUARD_TANK_DEFINITION,
  MACHINE_GUN_TANK_DEFINITION,
  SNIPER_TANK_DEFINITION,
  TANKS_CONFIG,
  type TankClassId,
  TWIN_TANK_DEFINITION,
} from '../src/config/tanks.config';

describe('Tanks Configuration & Evolution Tree (M4a Tier 2)', () => {
  it('defines Basic Tank as Tier 1 with 4 Tier 2 evolution paths', () => {
    expect(BASIC_TANK_DEFINITION.tier).toBe(1);
    expect(BASIC_TANK_DEFINITION.requiredLevel).toBe(1);
    expect(BASIC_TANK_DEFINITION.fovMultiplier).toBe(1.0);
    expect(BASIC_TANK_DEFINITION.evolutions).toEqual([
      'twin',
      'sniper',
      'machine_gun',
      'flank_guard',
    ]);
  });

  it('verifies all Tier 2 tanks require Level 15 and inherit from basic', () => {
    const tier2Ids: TankClassId[] = [
      'twin',
      'sniper',
      'machine_gun',
      'flank_guard',
    ];

    for (const id of tier2Ids) {
      const def = TANKS_CONFIG[id];
      expect(def).toBeDefined();
      expect(def.tier).toBe(2);
      expect(def.requiredLevel).toBe(15);
      expect(def.parentClassId).toBe('basic');
    }
  });

  it('configures Twin with alternating dual barrels (0 and 0.5 delayRatio)', () => {
    expect(TWIN_TANK_DEFINITION.barrels).toHaveLength(2);
    const [b0, b1] = TWIN_TANK_DEFINITION.barrels;
    expect(b0.offsetY).toBe(-12);
    expect(b1.offsetY).toBe(12);
    expect(b0.fireDelayRatio).toBe(0);
    expect(b1.fireDelayRatio).toBe(0.5);
    expect(b0.bulletDamageMultiplier).toBe(0.65);
    expect(b1.bulletDamageMultiplier).toBe(0.65);
  });

  it('configures Sniper with elongated barrel, higher bullet speed and 1.111 FOV', () => {
    expect(SNIPER_TANK_DEFINITION.fovMultiplier).toBe(1.111);
    expect(SNIPER_TANK_DEFINITION.barrels).toHaveLength(1);
    const b = SNIPER_TANK_DEFINITION.barrels[0];
    expect(b.length).toBe(50);
    expect(b.bulletSpeedMultiplier).toBe(1.5);
    expect(b.reloadMultiplier).toBe(1.5);
  });

  it('configures Machine Gun with trapezoidal tipWidth and spread', () => {
    expect(MACHINE_GUN_TANK_DEFINITION.barrels).toHaveLength(1);
    const b = MACHINE_GUN_TANK_DEFINITION.barrels[0];
    expect(b.length).toBe(42);
    expect(b.tipWidth).toBe(27);
    expect(b.spread).toBe(0.2);
    expect(b.reloadMultiplier).toBe(0.67);
  });

  it('configures Flank Guard with opposite 0 and PI barrels', () => {
    expect(FLANK_GUARD_TANK_DEFINITION.barrels).toHaveLength(2);
    const [front, rear] = FLANK_GUARD_TANK_DEFINITION.barrels;
    expect(front.angle).toBe(0);
    expect(rear.angle).toBe(Math.PI);
    expect(rear.length).toBeLessThan(front.length);
  });

  it('verifies all 4 Tier 3 tanks require Level 30 and match evolution hierarchy', () => {
    const tier3Ids: TankClassId[] = [
      'triple_shot',
      'assassin',
      'destroyer',
      'twin_flank',
    ];

    for (const id of tier3Ids) {
      const def = TANKS_CONFIG[id];
      expect(def).toBeDefined();
      expect(def.tier).toBe(3);
      expect(def.requiredLevel).toBe(30);
      expect(def.evolutions).toHaveLength(0);
    }

    // 驗證進化鏈
    expect(TWIN_TANK_DEFINITION.evolutions).toEqual(['triple_shot']);
    expect(SNIPER_TANK_DEFINITION.evolutions).toEqual(['assassin']);
    expect(MACHINE_GUN_TANK_DEFINITION.evolutions).toEqual(['destroyer']);
    expect(FLANK_GUARD_TANK_DEFINITION.evolutions).toEqual(['twin_flank']);
  });

  it('configures Tier 3 combat specs: Assassin FOV 1.25 and Destroyer width 36 & recoil 3.5', () => {
    const assassin = TANKS_CONFIG.assassin;
    expect(assassin.fovMultiplier).toBe(1.25);
    expect(assassin.barrels[0].length).toBe(60);
    expect(assassin.barrels[0].bulletSpeedMultiplier).toBe(1.6);

    const destroyer = TANKS_CONFIG.destroyer;
    expect(destroyer.barrels[0].width).toBe(36);
    expect(destroyer.barrels[0].recoilMultiplier).toBe(3.5);
    expect(destroyer.barrels[0].bulletSizeMultiplier).toBe(2.0);
    expect(destroyer.barrels[0].bulletDamageMultiplier).toBe(3.5);

    const tripleShot = TANKS_CONFIG.triple_shot;
    expect(tripleShot.barrels).toHaveLength(3);
    const angles = tripleShot.barrels.map((b) => b.angle);
    expect(angles).toContain(0);
    expect(angles).toContain(-Math.PI / 4);
    expect(angles).toContain(Math.PI / 4);

    const twinFlank = TANKS_CONFIG.twin_flank;
    expect(twinFlank.barrels).toHaveLength(4);
  });
});
