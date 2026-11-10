import { describe, expect, it } from 'vitest';
import { Tank } from '../src/entities/Tank';
import { SpawnSystem, TARGET_AI_COUNT } from '../src/systems/SpawnSystem';

describe('Milestone 5: SpawnSystem (AI Ecosystem & Tier Scaling)', () => {
  it('pre-allocates target count of AI tanks upon instantiation', () => {
    const spawnSystem = new SpawnSystem();
    expect(spawnSystem.aiTanks).toHaveLength(TARGET_AI_COUNT);
    expect(TARGET_AI_COUNT).toBe(20);

    for (let i = 0; i < spawnSystem.aiTanks.length; i++) {
      const bot = spawnSystem.aiTanks[i];
      expect(bot.isAi).toBe(true);
      expect(bot.active).toBe(false);
      expect(bot.id).toBeGreaterThanOrEqual(1000);
    }
  });

  it('initializes all 20 AI bots with names, colors, and valid attributes', () => {
    const spawnSystem = new SpawnSystem();
    const player = new Tank(1, 2000, 2000);
    player.level = 1;

    spawnSystem.init(player);

    for (let i = 0; i < spawnSystem.aiTanks.length; i++) {
      const bot = spawnSystem.aiTanks[i];
      expect(bot.active).toBe(true);
      expect(bot.name.length).toBeGreaterThan(0);
      expect(bot.color).toBeGreaterThan(0);
      expect(bot.hp).toBe(bot.maxHp);
      expect(bot.definition.tier).toBeLessThanOrEqual(2);
    }
  });

  it('scales AI tank tiers appropriately based on player level', () => {
    const spawnSystem = new SpawnSystem();
    const player = new Tank(1, 2000, 2000);

    // 當玩家為 Lv 30 以上時，AI 生態應包含高級階層 (Tier 2 或 Tier 3)
    player.level = 30;
    spawnSystem.init(player);

    const tiers = spawnSystem.aiTanks.map((b) => b.definition.tier);
    // 應有坦克進階至 Tier 2 或 Tier 3
    const hasAdvancedTanks = tiers.some((t) => t >= 2);
    expect(hasAdvancedTanks).toBe(true);
  });

  it('enqueues dead AI and respawns after 75 ticks delay', () => {
    const spawnSystem = new SpawnSystem();
    const player = new Tank(1, 2000, 2000);
    spawnSystem.init(player);

    const victim = spawnSystem.aiTanks[0];
    expect(victim.active).toBe(true);
    const victimId = victim.id;

    // 模擬 AI 被擊殺 (currentTick = 100)
    spawnSystem.handleTankDeath(victimId, 100);
    expect(victim.active).toBe(false);

    // 經過 50 ticks (tick 150 < 100 + 75)，尚未重生
    spawnSystem.update(150, player);
    expect(victim.active).toBe(false);

    // 經過 75 ticks (tick 175 >= 175)，完成重生
    spawnSystem.update(175, player);
    expect(victim.active).toBe(true);
    expect(victim.hp).toBe(victim.maxHp);
  });

  it('allows forced class spawning and cleans up all AI on clearAllAi', () => {
    const spawnSystem = new SpawnSystem();
    const player = new Tank(1, 2000, 2000);
    spawnSystem.init(player);

    // 強制將第一個 bot 生成為 Destroyer
    const bot = spawnSystem.aiTanks[0];
    spawnSystem.spawnAiTank(bot, player.level, player.x, player.y, 'destroyer');
    expect(bot.definition.id).toBe('destroyer');
    expect(bot.definition.tier).toBe(3);
    expect(bot.active).toBe(true);

    // 清除全場 AI
    spawnSystem.clearAllAi();
    for (let i = 0; i < spawnSystem.aiTanks.length; i++) {
      expect(spawnSystem.aiTanks[i].active).toBe(false);
    }
    expect(spawnSystem.getActiveAiCount()).toBe(0);
  });
});
