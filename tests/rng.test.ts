import { describe, expect, it } from 'vitest';
import { Mulberry32 } from '../src/core/rng';

describe('Mulberry32 Deterministic PRNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const rngA = new Mulberry32(12345);
    const rngB = new Mulberry32(12345);

    for (let i = 0; i < 100; i++) {
      expect(rngA.nextFloat()).toBe(rngB.nextFloat());
    }
  });

  it('produces different sequences for different seeds', () => {
    const rngA = new Mulberry32(12345);
    const rngB = new Mulberry32(54321);

    let sameCount = 0;
    for (let i = 0; i < 50; i++) {
      if (rngA.nextFloat() === rngB.nextFloat()) sameCount++;
    }
    expect(sameCount).toBeLessThan(5);
  });

  it('reseeds correctly and restarts sequence', () => {
    const rng = new Mulberry32(999);
    const firstFive = [
      rng.nextFloat(),
      rng.nextFloat(),
      rng.nextFloat(),
      rng.nextFloat(),
      rng.nextFloat(),
    ];

    rng.reseed(999);
    for (let i = 0; i < 5; i++) {
      expect(rng.nextFloat()).toBe(firstFive[i]);
    }
  });

  it('nextInt generates integers in [0, maxExclusive)', () => {
    const rng = new Mulberry32(42);
    const max = 10;
    for (let i = 0; i < 200; i++) {
      const val = rng.nextInt(max);
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(max);
    }
  });

  it('range generates numbers in [min, max)', () => {
    const rng = new Mulberry32(777);
    for (let i = 0; i < 100; i++) {
      const v = rng.range(5.5, 12.3);
      expect(v).toBeGreaterThanOrEqual(5.5);
      expect(v).toBeLessThan(12.3);
    }
  });

  it('chance generates expected probability distribution', () => {
    const rng = new Mulberry32(31415);
    const trials = 2000;
    let trueCount = 0;
    for (let i = 0; i < trials; i++) {
      if (rng.chance(0.3)) trueCount++;
    }
    const ratio = trueCount / trials;
    expect(ratio).toBeGreaterThan(0.26);
    expect(ratio).toBeLessThan(0.34);
  });

  it('gaussian produces approximately normal distribution', () => {
    const rng = new Mulberry32(1337);
    const n = 3000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const g = rng.gaussian();
      sum += g;
      sumSq += g * g;
    }
    const mean = sum / n;
    const stdDev = Math.sqrt(sumSq / n - mean * mean);

    expect(Math.abs(mean)).toBeLessThan(0.1);
    expect(stdDev).toBeGreaterThan(0.9);
    expect(stdDev).toBeLessThan(1.1);
  });
});
