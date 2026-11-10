import { describe, expect, it } from 'vitest';
import { STAT_HEALTH_REGEN } from '../src/config/stats.config';
import { recomputeDerivedStats } from '../src/core/deriveStats';
import { Tank } from '../src/entities/Tank';
import { RegenSystem } from '../src/systems/RegenSystem';

describe('RegenSystem (Natural regen & 30-sec Hyper Regen)', () => {
  it('regenerates health each tick when damaged (standard regen)', () => {
    const regenSystem = new RegenSystem();
    const tank = new Tank(1, 0, 0);
    tank.statLevels[STAT_HEALTH_REGEN] = 5; // 投資 5 點自然回血
    recomputeDerivedStats(tank);

    tank.hp = 20;
    tank.lastDamageTick = 100;

    // 當前 tick 為 150 (未達 750 ticks 的 30 秒門檻)
    regenSystem.update([tank], 150);

    expect(tank.hp).toBeGreaterThan(20);
    expect(tank.hp).toBeCloseTo(20 + tank.regenPerTick, 5);
  });

  it('triggers Hyper Regen after 30 seconds (750 ticks) unhurt', () => {
    const regenSystem = new RegenSystem();
    const tank = new Tank(1, 0, 0);
    // 0 點回血
    tank.statLevels[STAT_HEALTH_REGEN] = 0;
    recomputeDerivedStats(tank);

    tank.hp = 10;
    tank.lastDamageTick = 0;

    // tick 749 (未達 750 tick 門檻)
    regenSystem.update([tank], 749);
    const hpAt749 = tank.hp;

    // tick 750 (恰好滿 30 秒，觸發 Hyper Regen)
    regenSystem.update([tank], 750);
    const hpGainHyper = tank.hp - hpAt749;

    // Hyper Regen 額外每秒 15% 最大生命 (50 * 0.15 / 25 = 0.3 HP/tick)
    expect(hpGainHyper).toBeGreaterThan(0.3);
  });

  it('caps regeneration at maxHp and does not overflow', () => {
    const regenSystem = new RegenSystem();
    const tank = new Tank(1, 0, 0);
    tank.hp = 49.9;
    tank.maxHp = 50;
    tank.lastDamageTick = 0;

    // 觸發大量回血
    regenSystem.update([tank], 1000);

    expect(tank.hp).toBe(50);
  });
});
