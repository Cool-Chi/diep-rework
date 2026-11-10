import { describe, expect, it } from 'vitest';
import { BASE_BARREL_LENGTH } from '../src/config/constants';
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
    expect(b.length).toBe(70);
    expect(b.bulletSpeedMultiplier).toBe(1.5);
    expect(b.reloadMultiplier).toBe(1.5);
  });

  it('configures Machine Gun with trapezoidal tipWidth and spread', () => {
    expect(MACHINE_GUN_TANK_DEFINITION.barrels).toHaveLength(1);
    const b = MACHINE_GUN_TANK_DEFINITION.barrels[0];
    expect(b.length).toBe(44);
    expect(b.tipWidth).toBe(28);
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

  it('verifies all 8 Tier 3 tanks require Level 30 and match evolution hierarchy', () => {
    const tier3Ids: TankClassId[] = [
      'triple_shot',
      'assassin',
      'destroyer',
      'twin_flank',
      'quad_tank',
      'hunter',
      'gunner',
      'tri_angle',
    ];

    for (const id of tier3Ids) {
      const def = TANKS_CONFIG[id];
      expect(def).toBeDefined();
      expect(def.tier).toBe(3);
      expect(def.requiredLevel).toBe(30);
    }

    // 驗證 Tier 3 進化至 Tier 4 之拓撲鏈
    expect(TANKS_CONFIG.triple_shot.evolutions).toEqual([
      'triplet',
      'penta_shot',
    ]);
    expect(TANKS_CONFIG.quad_tank.evolutions).toEqual(['octo_tank']);
    expect(TANKS_CONFIG.assassin.evolutions).toEqual(['ranger']);
    expect(TANKS_CONFIG.hunter.evolutions).toEqual(['predator']);
    expect(TANKS_CONFIG.destroyer.evolutions).toEqual(['annihilator']);
    expect(TANKS_CONFIG.tri_angle.evolutions).toEqual(['booster', 'fighter']);
    expect(TANKS_CONFIG.twin_flank.evolutions).toEqual([]);
    expect(TANKS_CONFIG.gunner.evolutions).toEqual([]);

    // 驗證進化鏈
    expect(TWIN_TANK_DEFINITION.evolutions).toEqual([
      'triple_shot',
      'quad_tank',
      'twin_flank',
    ]);
    expect(SNIPER_TANK_DEFINITION.evolutions).toEqual(['assassin', 'hunter']);
    expect(MACHINE_GUN_TANK_DEFINITION.evolutions).toEqual([
      'destroyer',
      'gunner',
    ]);
    expect(FLANK_GUARD_TANK_DEFINITION.evolutions).toEqual([
      'tri_angle',
      'quad_tank',
      'twin_flank',
    ]);
  });

  it('configures new Tier 3 tank specs (Quad Tank, Hunter, Gunner, Tri-Angle)', () => {
    const quad = TANKS_CONFIG.quad_tank;
    expect(quad.barrels).toHaveLength(4);
    const quadAngles = quad.barrels.map((b) => b.angle);
    expect(quadAngles).toContain(0);
    expect(quadAngles).toContain(Math.PI / 2);
    expect(quadAngles).toContain(Math.PI);
    expect(quadAngles).toContain(-Math.PI / 2);

    const hunter = TANKS_CONFIG.hunter;
    expect(hunter.barrels).toHaveLength(2);
    expect(hunter.fovMultiplier).toBe(1.15);
    // 驗證底層細長 (62/18)、表層短粗 (48/24) 的疊管結構
    expect(hunter.barrels[0].width).toBe(18);
    expect(hunter.barrels[0].length).toBe(62);
    expect(hunter.barrels[1].width).toBe(24);
    expect(hunter.barrels[1].length).toBe(48);

    const gunner = TANKS_CONFIG.gunner;
    expect(gunner.barrels).toHaveLength(4);
    // 外側短管在底層 (長 38, offsetY ±12)，內側長管在表層 (長 46, offsetY ±5)
    expect(gunner.barrels[0].length).toBe(38);
    expect(gunner.barrels[0].offsetY).toBe(-12);
    expect(gunner.barrels[1].length).toBe(38);
    expect(gunner.barrels[1].offsetY).toBe(12);
    expect(gunner.barrels[2].length).toBe(46);
    expect(gunner.barrels[2].offsetY).toBe(-5);
    expect(gunner.barrels[3].length).toBe(46);
    expect(gunner.barrels[3].offsetY).toBe(5);
    for (const b of gunner.barrels) {
      expect(b.width).toBe(10);
      expect(b.bulletSizeMultiplier).toBe(0.5);
    }

    const triAngle = TANKS_CONFIG.tri_angle;
    expect(triAngle.barrels).toHaveLength(3);
    expect(triAngle.barrels[1].recoilMultiplier).toBe(1.6);
    expect(triAngle.barrels[2].recoilMultiplier).toBe(1.6);
  });

  it('configures Tier 3 combat specs: Assassin FOV 1.25 and Destroyer width 36 & recoil 3.5', () => {
    const assassin = TANKS_CONFIG.assassin;
    expect(assassin.fovMultiplier).toBe(1.25);
    expect(assassin.barrels[0].length).toBe(82);
    expect(assassin.barrels[0].bulletSpeedMultiplier).toBe(1.6);

    const destroyer = TANKS_CONFIG.destroyer;
    expect(destroyer.barrels[0].width).toBe(36);
    expect(destroyer.barrels[0].length).toBe(48);
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

  it('verifies all 8 Tier 4 tanks require Level 45 and inherit correctly', () => {
    const tier4Ids: TankClassId[] = [
      'triplet',
      'penta_shot',
      'octo_tank',
      'ranger',
      'predator',
      'annihilator',
      'booster',
      'fighter',
    ];

    for (const id of tier4Ids) {
      const def = TANKS_CONFIG[id];
      expect(def).toBeDefined();
      expect(def.tier).toBe(4);
      expect(def.requiredLevel).toBe(45);
      expect(def.evolutions).toHaveLength(0); // 終極形態無後續進化
    }
  });

  it('configures Tier 4 combat specs accurately', () => {
    // Ranger
    const ranger = TANKS_CONFIG.ranger;
    expect(ranger.fovMultiplier).toBe(1.428);
    expect(ranger.barrels[0].length).toBe(95);
    expect(ranger.barrels[0].bulletSpeedMultiplier).toBe(1.8);

    // Annihilator
    const annihilator = TANKS_CONFIG.annihilator;
    expect(annihilator.barrels[0].width).toBe(48);
    expect(annihilator.barrels[0].length).toBe(46);
    expect(annihilator.barrels[0].recoilMultiplier).toBe(4.5);
    expect(annihilator.barrels[0].bulletSizeMultiplier).toBe(2.67);

    // Predator (底層細長 74/15 -> 中層 60/20 -> 表層短粗 46/26 覆蓋根部)
    const predator = TANKS_CONFIG.predator;
    expect(predator.fovMultiplier).toBe(1.35);
    expect(predator.barrels).toHaveLength(3);
    expect(predator.barrels[0].width).toBe(15);
    expect(predator.barrels[0].length).toBe(74);
    expect(predator.barrels[1].width).toBe(20);
    expect(predator.barrels[1].length).toBe(60);
    expect(predator.barrels[2].width).toBe(26);
    expect(predator.barrels[2].length).toBe(46);

    // Octo Tank
    const octo = TANKS_CONFIG.octo_tank;
    expect(octo.barrels).toHaveLength(8);

    // Triplet (兩側在底層，中央在表層)
    const triplet = TANKS_CONFIG.triplet;
    expect(triplet.barrels).toHaveLength(3);
    expect(triplet.barrels[0].offsetY).toBe(-12);
    expect(triplet.barrels[0].length).toBe(45);
    expect(triplet.barrels[1].offsetY).toBe(12);
    expect(triplet.barrels[1].length).toBe(45);
    expect(triplet.barrels[2].offsetY).toBe(0);
    expect(triplet.barrels[2].length).toBe(54);

    // Penta Shot (外側底層 -> 內側中層 -> 中央表層)
    const penta = TANKS_CONFIG.penta_shot;
    expect(penta.barrels).toHaveLength(5);
    expect(penta.barrels[0].length).toBe(40);
    expect(penta.barrels[0].angle).toBe(-Math.PI / 4);
    expect(penta.barrels[1].length).toBe(40);
    expect(penta.barrels[1].angle).toBe(Math.PI / 4);
    expect(penta.barrels[2].length).toBe(48);
    expect(penta.barrels[2].angle).toBe(-Math.PI / 8);
    expect(penta.barrels[3].length).toBe(48);
    expect(penta.barrels[3].angle).toBe(Math.PI / 8);
    expect(penta.barrels[4].length).toBe(56);
    expect(penta.barrels[4].angle).toBe(0);

    // Booster (外側推進管底層 -> 內側推進管中層 -> 前主砲表層)
    const booster = TANKS_CONFIG.booster;
    expect(booster.barrels).toHaveLength(5);
    expect(booster.barrels[0].length).toBe(35);
    expect(booster.barrels[0].angle).toBeCloseTo((155 * Math.PI) / 180);
    expect(booster.barrels[1].length).toBe(35);
    expect(booster.barrels[1].angle).toBeCloseTo(-(155 * Math.PI) / 180);
    expect(booster.barrels[2].length).toBe(42);
    expect(booster.barrels[2].angle).toBeCloseTo((145 * Math.PI) / 180);
    expect(booster.barrels[3].length).toBe(42);
    expect(booster.barrels[3].angle).toBeCloseTo(-(145 * Math.PI) / 180);
    expect(booster.barrels[4].length).toBe(BASE_BARREL_LENGTH);
    expect(booster.barrels[4].angle).toBe(0);

    const fighter = TANKS_CONFIG.fighter;
    expect(fighter.barrels).toHaveLength(5);
  });
});
