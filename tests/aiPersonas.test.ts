import { describe, expect, it } from 'vitest';
import {
  AI_PERSONAS,
  getRecoilBoostMode,
  PERSONA_IDS,
  personaForSlot,
} from '../src/ai/aiPersonas.config';
import { applyAiBuild } from '../src/ai/aiTactics';
import { TANKS_CONFIG } from '../src/config/tanks.config';
import { Mulberry32 } from '../src/core/rng';
import { Tank } from '../src/entities/Tank';

describe('M9 AI Personas & Build Archetypes', () => {
  it('personaForSlot creates exact 40/25/25/10 distribution for 40 AI slots', () => {
    const counts = { newbie: 0, aggressor: 0, tactician: 0, apex: 0 };
    for (let slot = 0; slot < 40; slot++) {
      const p = personaForSlot(slot, 40);
      counts[p]++;
    }

    expect(counts.newbie).toBe(16); // 40%
    expect(counts.aggressor).toBe(10); // 25%
    expect(counts.tactician).toBe(10); // 25%
    expect(counts.apex).toBe(4); // 10%
  });

  it('all personas are defined with reasonable behavior parameters', () => {
    for (const pid of PERSONA_IDS) {
      const persona = AI_PERSONAS[pid];
      expect(persona).toBeDefined();
      expect(persona.reactionIntervalTicks).toBeGreaterThanOrEqual(1);
      expect(persona.aimNoiseRad).toBeGreaterThanOrEqual(0);
      expect(persona.leadFactor).toBeGreaterThanOrEqual(0);
      expect(persona.leadFactor).toBeLessThanOrEqual(1.0);
      expect(persona.minStatFloor.length).toBe(8);
    }

    // Apex keeps small noise (0.02 rad) to avoid perfect robotic aim
    expect(AI_PERSONAS.apex.aimNoiseRad).toBe(0.02);
    // Newbie has higher reaction interval (8 ticks) and noise (0.14 rad)
    expect(AI_PERSONAS.newbie.reactionIntervalTicks).toBe(8);
  });

  it('minStatFloor prevents useless glass builds when stat points are scarce', () => {
    const bot = new Tank(1001, 1000, 1000);
    bot.setClass(TANKS_CONFIG.basic);
    bot.persona = 'newbie';
    bot.statPoints = 5; // scarce points
    bot.statLevels.fill(0);

    const rng = new Mulberry32(101);
    applyAiBuild(bot, rng);

    // Floor order: Reload (stat 6) > BulletPen (stat 4) > BulletSpd (stat 3) > BulletDmg (stat 5) > MaxHP (stat 1)
    // Newbie floor: [0, 1, 0, 1, 2, 1, 2, 1]
    // 5 points should satisfy Reload >= 1, BulletPen >= 1, BulletSpd >= 1, BulletDmg >= 1, etc.
    expect(bot.statLevels[6]).toBeGreaterThanOrEqual(1); // Reload
    expect(bot.statLevels[4]).toBeGreaterThanOrEqual(1); // BulletPen
    expect(bot.statPoints).toBe(0);
  });

  it('getRecoilBoostMode strictly enforces tank class constraints', () => {
    // Rear barrels: Tri-Angle / Booster / Fighter
    expect(getRecoilBoostMode('tri_angle')).toBe('rear');
    expect(getRecoilBoostMode('booster')).toBe('rear');
    expect(getRecoilBoostMode('fighter')).toBe('rear');

    // High recoil: Destroyer / Annihilator / Machine Gun / Penta Shot
    expect(getRecoilBoostMode('destroyer')).toBe('backfire');
    expect(getRecoilBoostMode('annihilator')).toBe('backfire');
    expect(getRecoilBoostMode('machine_gun')).toBe('backfire');
    expect(getRecoilBoostMode('penta_shot')).toBe('backfire');

    // Snipers and others strictly forbidden from backfire
    expect(getRecoilBoostMode('sniper')).toBe('none');
    expect(getRecoilBoostMode('assassin')).toBe('none');
    expect(getRecoilBoostMode('hunter')).toBe('none');
    expect(getRecoilBoostMode('ranger')).toBe('none');
    expect(getRecoilBoostMode('predator')).toBe('none');
    expect(getRecoilBoostMode('basic')).toBe('none');
  });
});
