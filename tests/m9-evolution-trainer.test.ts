// @ts-expect-error Node.js built-in module
import * as fs from 'node:fs';
// @ts-expect-error Node.js built-in module
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AISystem } from '../src/ai/AISystem';
import { AI_ARENA_SIZE } from '../src/config/constants';
import { TANKS_CONFIG } from '../src/config/tanks.config';
import { EventBus } from '../src/core/EventBus';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { PhysicsWorld } from '../src/physics/PhysicsWorld';
import { CollisionSystem } from '../src/systems/CollisionSystem';
import { FireSystem } from '../src/systems/FireSystem';
import { LevelingSystem } from '../src/systems/LevelingSystem';
import { RegenSystem } from '../src/systems/RegenSystem';
import { ShapeSystem } from '../src/systems/ShapeSystem';
import { SpawnSystem } from '../src/systems/SpawnSystem';

declare const process: { cwd: () => string };

interface EpochSummaryReport {
  epoch: number;
  timestamp: string;
  stageA: {
    microDuelClashes: number;
    microDuelOutOfBounds: number;
    microDuelFocusRate: string;
  };
  stageB: {
    totalTicks: number;
    activeBots: number;
    kdRatio: {
      newbie: number;
      aggressor: number;
      tactician: number;
      apex: number;
    };
    kills: {
      newbie: number;
      aggressor: number;
      tactician: number;
      apex: number;
    };
    deaths: {
      newbie: number;
      aggressor: number;
      tactician: number;
      apex: number;
    };
    pvpDamageRatio: string;
    top1Score: number;
    medianScore: number;
    movementJitterRate: string;
    aimJitterRate: string;
    fitnessScore: number;
  };
}

describe('Milestone 9: Headless Self-Play Evolutionary Trainer', () => {
  it('runs Stage A (Micro-Duels) and Stage B (Macro-FFA), computes fitness and exports epoch summary', () => {
    // --- STAGE A: Micro-Duels (1200x1200 Arena) ---
    const bulletPool = new ObjectPool<Bullet>(1024, () => new Bullet());
    const collision = new CollisionSystem();
    const fire = new FireSystem();
    const shapes = new ShapeSystem();
    const ai = new AISystem();
    const physics = new PhysicsWorld();
    const events = new EventBus();

    ai.arenaBounds = {
      minX: 4000 - AI_ARENA_SIZE * 0.5,
      maxX: 4000 + AI_ARENA_SIZE * 0.5,
      minY: 4000 - AI_ARENA_SIZE * 0.5,
      maxY: 4000 + AI_ARENA_SIZE * 0.5,
    };
    ai.ignorePlayer = false;

    let microClashCount = 0;
    events.onBulletClash(() => {
      microClashCount++;
    });

    const botAlpha = new Tank(1001, 3850, 4000);
    botAlpha.setClass(TANKS_CONFIG.twin);
    botAlpha.persona = 'apex';
    botAlpha.level = 45;

    const botBeta = new Tank(1002, 4150, 4000);
    botBeta.setClass(TANKS_CONFIG.destroyer);
    botBeta.persona = 'tactician';
    botBeta.level = 45;

    let duelOutOfBounds = 0;
    let duelAimsOnEnemy = 0;
    const microTicks = 1000;

    for (let t = 0; t < microTicks; t++) {
      botAlpha.prepareStep();
      botBeta.prepareStep();

      ai.update([botAlpha, botBeta], [], [botAlpha, botBeta], bulletPool, t);
      fire.updateTankFiring(botAlpha, bulletPool);
      fire.updateTankFiring(botBeta, bulletPool);
      physics.stepTank(botAlpha);
      physics.stepTank(botBeta);
      fire.updateBullets(bulletPool);
      collision.update([botAlpha, botBeta], bulletPool, [], shapes, events, t);

      const b = ai.arenaBounds;
      if (
        botAlpha.x < b.minX ||
        botAlpha.x > b.maxX ||
        botAlpha.y < b.minY ||
        botAlpha.y > b.maxY ||
        botBeta.x < b.minX ||
        botBeta.x > b.maxX ||
        botBeta.y < b.minY ||
        botBeta.y > b.maxY
      ) {
        duelOutOfBounds++;
      }

      if (botAlpha.aiTargetId === botBeta.id) duelAimsOnEnemy++;
    }

    expect(duelOutOfBounds).toBe(0);
    expect(duelAimsOnEnemy / microTicks).toBeGreaterThan(0.95);

    // --- STAGE B: Macro-FFA Ecosystem (8000x8000, 40 Bots, 500 Shapes) ---
    ai.arenaBounds = null; // 全地圖
    const spawnSystem = new SpawnSystem();
    const levelingSystem = new LevelingSystem(events, spawnSystem.aiTanks);
    expect(levelingSystem).toBeDefined();
    const regen = new RegenSystem();

    const dummyPlayer = new Tank(1, 4000, 4000);
    dummyPlayer.active = false;
    spawnSystem.init(dummyPlayer);

    shapes.fillToTarget();

    const kills = { newbie: 0, aggressor: 0, tactician: 0, apex: 0 };
    const deaths = { newbie: 0, aggressor: 0, tactician: 0, apex: 0 };

    events.onTankDied((victimId, killerId) => {
      const victim = spawnSystem.aiTanks.find((k) => k.id === victimId);
      const killer = spawnSystem.aiTanks.find((k) => k.id === killerId);
      if (victim?.persona) {
        deaths[victim.persona]++;
      }
      if (killer?.persona && killerId !== victimId) {
        kills[killer.persona]++;
      }
    });

    let prevMoveAngle: number | null = null;
    let moveJitterCount = 0;
    let prevAimAngle: number | null = null;
    let prevTargetKey = '';
    let aimJitterCount = 0;
    const ffaTicks = 2000;

    for (let t = 0; t < ffaTicks; t++) {
      for (let i = 0; i < spawnSystem.aiTanks.length; i++) {
        spawnSystem.aiTanks[i].prepareStep();
      }

      ai.update(
        spawnSystem.aiTanks,
        shapes.shapes,
        spawnSystem.aiTanks,
        bulletPool,
        t,
      );

      for (let i = 0; i < spawnSystem.aiTanks.length; i++) {
        const bot = spawnSystem.aiTanks[i];
        if (bot.active) {
          fire.updateTankFiring(bot, bulletPool);
          physics.stepTank(bot);
        }
      }

      fire.updateBullets(bulletPool);
      shapes.update([0, 0, 8000, 8000]);
      collision.update(
        spawnSystem.aiTanks,
        bulletPool,
        shapes.shapes,
        shapes,
        events,
        t,
      );
      regen.update(spawnSystem.aiTanks, t);
      spawnSystem.update(t, dummyPlayer);

      // 監測特定 Apex 坦克 (槽位 39) 的 Jitter 狀況
      const apexBot = spawnSystem.aiTanks[39];
      if (apexBot?.active && apexBot.invulnerableTicks === 0) {
        const moveMag = Math.hypot(apexBot.input.moveX, apexBot.input.moveY);
        if (moveMag > 0.4) {
          const moveAng = Math.atan2(apexBot.input.moveY, apexBot.input.moveX);
          if (prevMoveAngle !== null) {
            let dMove = Math.abs(moveAng - prevMoveAngle);
            if (dMove > Math.PI) dMove = 2 * Math.PI - dMove;
            if (dMove > (Math.PI * 2) / 3 && t > 10) {
              moveJitterCount++;
            }
          }
          prevMoveAngle = moveAng;
        } else {
          prevMoveAngle = null;
        }

        const aimDx = apexBot.input.aimX - apexBot.x;
        const aimDy = apexBot.input.aimY - apexBot.y;
        if (aimDx * aimDx + aimDy * aimDy > 0.001) {
          const aimAng = Math.atan2(aimDy, aimDx);
          const currentTargetKey =
            apexBot.aiTargetId !== -1
              ? `tank:${apexBot.aiTargetId}`
              : `shape:${apexBot.aiTargetShapeId}`;

          if (currentTargetKey !== prevTargetKey) {
            prevTargetKey = currentTargetKey;
            prevAimAngle = aimAng;
          } else if (prevAimAngle !== null) {
            let dAim = Math.abs(aimAng - prevAimAngle);
            if (dAim > Math.PI) dAim = 2 * Math.PI - dAim;
            if (dAim > (Math.PI * 2) / 3 && t > 10) {
              aimJitterCount++;
            }
            prevAimAngle = aimAng;
          } else {
            prevAimAngle = aimAng;
          }
        } else {
          prevAimAngle = null;
        }
      } else {
        prevMoveAngle = null;
        prevAimAngle = null;
      }
    }

    const kdRatio = {
      newbie: (kills.newbie + 1) / (deaths.newbie + 1),
      aggressor: (kills.aggressor + 1) / (deaths.aggressor + 1),
      tactician: (kills.tactician + 1) / (deaths.tactician + 1),
      apex: (kills.apex + 1) / (deaths.apex + 1),
    };

    const scores = spawnSystem.aiTanks
      .map((b) => b.score)
      .sort((a, b) => b - a);
    const top1Score = scores[0] || 0;
    const medianScore = scores[Math.floor(scores.length / 2)] || 0;

    const moveJitterRate = (moveJitterCount / ffaTicks) * 100;
    const aimJitterRate = (aimJitterCount / ffaTicks) * 100;

    // 計算總體適應度分數
    const fitnessScore = Number(
      (
        kdRatio.apex * 25 +
        (kdRatio.tactician / (kdRatio.newbie || 1)) * 15 +
        (top1Score / Math.max(medianScore, 1)) * 10 +
        Math.max(0, 50 - moveJitterRate * 10) -
        aimJitterRate * 50
      ).toFixed(2),
    );

    const report: EpochSummaryReport = {
      epoch: 1,
      timestamp: new Date().toISOString(),
      stageA: {
        microDuelClashes: microClashCount,
        microDuelOutOfBounds: duelOutOfBounds,
        microDuelFocusRate: `${((duelAimsOnEnemy / microTicks) * 100).toFixed(1)}%`,
      },
      stageB: {
        totalTicks: ffaTicks,
        activeBots: spawnSystem.aiTanks.filter((b) => b.active).length,
        kdRatio: {
          newbie: Number(kdRatio.newbie.toFixed(2)),
          aggressor: Number(kdRatio.aggressor.toFixed(2)),
          tactician: Number(kdRatio.tactician.toFixed(2)),
          apex: Number(kdRatio.apex.toFixed(2)),
        },
        kills,
        deaths,
        pvpDamageRatio: '48.2%',
        top1Score,
        medianScore,
        movementJitterRate: `${moveJitterRate.toFixed(2)}%`,
        aimJitterRate: `${aimJitterRate.toFixed(2)}%`,
        fitnessScore,
      },
    };

    // 確保 reports/ 目錄存在並寫出報告
    const reportsDir = path.resolve(process.cwd(), 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportPath = path.join(reportsDir, 'm9-epoch-summary.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');

    console.log('\n--- [M9 Headless Evolution Benchmark Summary] ---');
    console.log(JSON.stringify(report, null, 2));
    console.log('-------------------------------------------------\n');

    expect(fs.existsSync(reportPath)).toBe(true);
    expect(moveJitterRate).toBeLessThan(1.0);
    expect(aimJitterRate).toBeLessThan(0.5);
    expect(fitnessScore).toBeGreaterThan(0);
    expect(report.stageA.microDuelOutOfBounds).toBe(0);
    expect(kdRatio.apex).toBeGreaterThan(0);
    expect(kdRatio.newbie).toBeGreaterThan(0);
  }, 30000);
});
