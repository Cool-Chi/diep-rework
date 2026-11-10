import { describe, expect, it } from 'vitest';
import { pointsForLevel, SCORE_FOR_LEVEL } from '../src/config/levels.config';
import { Camera } from '../src/core/Camera';
import { ObjectPool } from '../src/core/ObjectPool';
import { Particle } from '../src/entities/Particle';
import { Tank } from '../src/entities/Tank';

describe('Milestone 6: Game Over, Respawn & Particle System', () => {
  it('correctly calculates half-level respawn values and skill points', () => {
    // 驗證原版折半重生規則：Math.max(1, Math.floor(deadLevel / 2))
    const testCases = [
      { deadLevel: 30, expectedLevel: 15, expectedPoints: 14 },
      { deadLevel: 29, expectedLevel: 14, expectedPoints: 13 },
      { deadLevel: 15, expectedLevel: 7, expectedPoints: 6 },
      { deadLevel: 14, expectedLevel: 7, expectedPoints: 6 },
      { deadLevel: 4, expectedLevel: 2, expectedPoints: 1 },
      { deadLevel: 1, expectedLevel: 1, expectedPoints: 0 },
    ];

    for (let i = 0; i < testCases.length; i++) {
      const { deadLevel, expectedLevel, expectedPoints } = testCases[i];
      const respawnLevel = Math.max(1, Math.floor(deadLevel / 2));
      expect(respawnLevel).toBe(expectedLevel);

      const respawnScore = SCORE_FOR_LEVEL[respawnLevel - 1];
      expect(respawnScore).toBeGreaterThanOrEqual(0);

      const points = pointsForLevel(respawnLevel);
      expect(points).toBe(expectedPoints);
    }
  });

  it('manages particle initialization, velocity damping, and automatic expiration in ObjectPool', () => {
    const pool = new ObjectPool<Particle>(16, () => new Particle());
    const idx = pool.acquire();
    expect(idx).toBeGreaterThanOrEqual(0);

    const particle = pool.items[idx];
    particle.init(100, 100, 10, 0, 0x00ff88, 5, 5, 0.9);

    expect(particle.active).toBe(true);
    expect(particle.lifeTicks).toBe(0);

    // 推進 3 ticks，位置增加且速度因阻尼衰減
    for (let t = 0; t < 3; t++) {
      particle.step();
    }
    expect(particle.lifeTicks).toBe(3);
    expect(particle.x).toBeGreaterThan(100);
    expect(particle.vx).toBeLessThan(10);
    expect(particle.active).toBe(true);

    // 再推進 2 ticks (共 5 ticks = maxLifeTicks)，粒子標記 inactive
    for (let t = 0; t < 2; t++) {
      particle.step();
    }
    expect(particle.lifeTicks).toBe(5);
    expect(particle.active).toBe(false);

    // 回收進池中
    pool.release(idx);
    expect(pool.isActive(idx)).toBe(false);
  });

  it('applies screen shake and smoothly decays over time in Camera', () => {
    const camera = new Camera(2000, 2000);
    expect(camera.shakeIntensity).toBe(0);
    expect(camera.shakeOffsetX).toBe(0);

    // 施加震動
    camera.addShake(12.0);
    expect(camera.shakeIntensity).toBe(12.0);

    // 推進 0.05 秒渲染幀，產生震動偏移且強度開始衰減
    camera.update(0.05);
    expect(camera.shakeIntensity).toBeLessThan(12.0);
    expect(camera.shakeIntensity).toBeGreaterThan(0);
    expect(camera.renderX).not.toBe(camera.x);

    // 推進 1.0 秒，震動完全衰減至 0
    camera.update(1.0);
    expect(camera.shakeIntensity).toBe(0);
    expect(camera.shakeOffsetX).toBe(0);
    expect(camera.shakeOffsetY).toBe(0);
    expect(camera.renderX).toBe(camera.x);
  });

  it('sets spectator target and follows killer position when player dies', () => {
    const camera = new Camera(2000, 2000);
    const killer = new Tank(1001, 2800, 2500);
    killer.active = true;

    // 設定觀戰目標為擊殺者
    camera.spectateTarget = killer;
    camera.setTarget(1000, 1000); // 傳入原玩家位置

    // 相機應鎖定擊殺者目標座標
    expect(camera.targetX).toBe(2800);
    expect(camera.targetY).toBe(2500);

    // 推進相機平滑移向擊殺者
    camera.update(0.5);
    expect(camera.x).toBeGreaterThan(2000);
    expect(camera.y).toBeGreaterThan(2000);
  });
});
