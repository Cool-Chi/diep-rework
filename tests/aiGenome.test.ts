import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GENOME,
  GENE_SPECS,
  genomeToVector,
  getGenomeBranch,
  sanitizeGenome,
  vectorToGenome,
} from '../src/ai/aiGenome';

describe('M9 AI Trainable Tactical Genome', () => {
  it('default genome matches M8 baseline configuration', () => {
    expect(DEFAULT_GENOME.version).toBe(1);
    expect(DEFAULT_GENOME.vectorWeights.combat).toBe(1.0);
    expect(DEFAULT_GENOME.vectorWeights.retreat).toBe(1.0);
    expect(DEFAULT_GENOME.vectorWeights.farm).toBe(1.0);
    expect(DEFAULT_GENOME.vectorWeights.evade).toBe(1.0);
    expect(DEFAULT_GENOME.vectorWeights.border).toBe(1.0);

    expect(DEFAULT_GENOME.engageDistanceRatio.twin).toBe(1.0);
    expect(DEFAULT_GENOME.engageDistanceRatio.sniper).toBe(1.0);
    expect(DEFAULT_GENOME.engageDistanceRatio.machineGun).toBe(1.0);
    expect(DEFAULT_GENOME.engageDistanceRatio.flank).toBe(1.0);

    expect(DEFAULT_GENOME.retreatCurve.hpStart).toBe(0.55);
    expect(DEFAULT_GENOME.targetSwitch.stickiness).toBe(1.25);
  });

  it('sanitizeGenome strictly clamps extreme values within GENE_SPECS bounds', () => {
    const raw = {
      vectorWeights: {
        combat: 999.0, // too high
        retreat: -5.0, // too low
        farm: 0.1, // below min 0.5
        evade: 0.2, // below min 0.7
        border: 0.1, // below min 0.8
      },
      engageDistanceRatio: {
        twin: 5.0,
        sniper: 0.2,
      },
      targetSwitch: {
        stickiness: 0.5, // below min 1.15
      },
    };

    const sanitized = sanitizeGenome(raw);

    expect(sanitized.vectorWeights.combat).toBe(1.6);
    expect(sanitized.vectorWeights.retreat).toBe(0.6);
    expect(sanitized.vectorWeights.farm).toBe(0.5);
    expect(sanitized.vectorWeights.evade).toBe(0.7);
    expect(sanitized.vectorWeights.border).toBe(0.8);

    expect(sanitized.engageDistanceRatio.twin).toBe(1.4);
    expect(sanitized.engageDistanceRatio.sniper).toBe(0.7);
    expect(sanitized.targetSwitch.stickiness).toBe(1.15); // stickiness floor 1.15 prevents target flapping
  });

  it('sanitizeGenome safely ignores unknown or malicious properties', () => {
    const raw = {
      AI_INTERCEPT_MAX_ANGLE: 999, // M8 frozen parameter must never be accepted into genome
      AI_INTERCEPT_LOCK_TICKS: 0,
      wallCornerSliding: false,
      nanValue: Number.NaN,
    };

    const sanitized = sanitizeGenome(raw);
    expect(
      (sanitized as unknown as Record<string, unknown>).AI_INTERCEPT_MAX_ANGLE,
    ).toBeUndefined();
    expect(
      (sanitized as unknown as Record<string, unknown>).wallCornerSliding,
    ).toBeUndefined();
    expect(sanitized.vectorWeights.combat).toBe(1.0);
  });

  it('genomeToVector and vectorToGenome roundtrip correctly', () => {
    const vec = genomeToVector(DEFAULT_GENOME);
    expect(vec.length).toBe(GENE_SPECS.length);

    const reconstructed = vectorToGenome(vec);
    const vec2 = genomeToVector(reconstructed);

    for (let i = 0; i < vec.length; i++) {
      expect(vec2[i]).toBeCloseTo(vec[i], 5);
    }
  });

  it('getGenomeBranch properly categorizes tank classes', () => {
    expect(getGenomeBranch('twin')).toBe('twin');
    expect(getGenomeBranch('triplet')).toBe('twin');
    expect(getGenomeBranch('sniper')).toBe('sniper');
    expect(getGenomeBranch('ranger')).toBe('sniper');
    expect(getGenomeBranch('destroyer')).toBe('machineGun');
    expect(getGenomeBranch('booster')).toBe('flank');
    expect(getGenomeBranch('basic')).toBeNull();
  });
});
