import { describe, expect, it } from 'vitest';
import { AISystem } from '../src/ai/AISystem';
import { GENE_SPECS } from '../src/ai/aiGenome';
import {
  AI_INTERCEPT_LOCK_TICKS,
  AI_INTERCEPT_MAX_ANGLE,
} from '../src/config/constants';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';

describe('M9 Frozen Redline Regression Guards', () => {
  it('strictly preserves M8 frozen constants for intercept angle and lock ticks', () => {
    // 嚴格保留 M8 已調優至 0.00% Jitter 的 AI_INTERCEPT_MAX_ANGLE = 0.62 與 4 ticks 攔截慣性
    expect(AI_INTERCEPT_MAX_ANGLE).toBe(0.62);
    expect(AI_INTERCEPT_LOCK_TICKS).toBe(4);
  });

  it('GENE_SPECS does not include intercept angle, intercept lock, or tangent sliding', () => {
    for (const spec of GENE_SPECS) {
      expect(spec.key.toLowerCase()).not.toContain('intercept');
      expect(spec.key.toLowerCase()).not.toContain('tangent');
      expect(spec.key.toLowerCase()).not.toContain('sliding');
    }
  });

  it('aim noise is NOT re-sampled every tick (preserves zero-jitter turret movement)', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.persona = 'newbie'; // reactionIntervalTicks = 8
    bot.active = true;
    bot.isAi = true;

    const enemy = new Tank(1002, 1300, 1000);
    enemy.active = true;
    enemy.isAi = true;

    const pool = new ObjectPool<Bullet>(16, () => new Bullet());

    // Tick 0: triggers decision refresh, samples aiNoiseOffset
    aiSystem.update([bot], [], [enemy, bot], pool, 0);
    const initialOffset = bot.aiNoiseOffset;

    // Next 6 ticks: within reaction interval (8 ticks), noise offset MUST stay identical!
    for (let t = 1; t <= 6; t++) {
      aiSystem.update([bot], [], [enemy, bot], pool, t);
      expect(bot.aiNoiseOffset).toBe(initialOffset);
    }
  });

  it('anti-wall-corner tangent sliding prevents zero-velocity deadlock when retreating near borders', () => {
    const aiSystem = new AISystem();
    // 將坦克置於地圖左下角 (200, 200)，邊界緩衝區內 (BORDER_BUFFER = 350)
    const bot = new Tank(1001, 200, 200);
    bot.active = true;
    bot.isAi = true;
    bot.hp = 10;
    bot.maxHp = 100; // hpRatio = 0.1 -> 觸發強烈撤退
    bot.aiStrafeDirection = 1;

    // 敵方在 (350, 350)，後撤方向朝向左下牆角 (負方向)，與邊界排斥力 (正方向) 點積 < -0.5
    const enemy = new Tank(1002, 350, 350);
    enemy.active = true;
    enemy.isAi = true;

    const pool = new ObjectPool<Bullet>(16, () => new Bullet());
    aiSystem.update([bot], [], [enemy, bot], pool, 1);

    // 檢查合成移動向量非零且具有沿牆面滑動的切線分量
    const moveMag = Math.hypot(bot.input.moveX, bot.input.moveY);
    expect(moveMag).toBeGreaterThan(0.2); // 絕不在牆角被抵消為 0 速度停滯
  });

  it('human-like off-axis bullet filtering: AI dodges off-axis bullets purely with body, never turns cannon', () => {
    const aiSystem = new AISystem();
    const bot = new Tank(1001, 1000, 1000);
    bot.active = true;
    bot.isAi = true;
    bot.rotation = 0; // 砲口朝右

    const enemy = new Tank(1002, 1500, 1000);
    enemy.active = true;
    enemy.isAi = true;

    // 側翼流彈 (夾角 90 度 > 0.62 rad)
    const pool = new ObjectPool<Bullet>(16, () => new Bullet());
    const idx = pool.acquire();
    const bullet = pool.items[idx];
    bullet.init(idx, 999, 1000, 850, 0, 12.27, 9, 20, 15);

    aiSystem.update([bot], [], [enemy, bot], pool, 1);

    expect(bot.aiInterceptBulletIdx).toBe(-1);
    expect(bot.input.aimX).toBe(1500); // 砲口牢牢對準敵方
  });
});
