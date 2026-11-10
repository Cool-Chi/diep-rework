import { describe, expect, it } from 'vitest';
import {
  STAT_BULLET_DAMAGE,
  STAT_MAX_HEALTH,
  STAT_RELOAD,
} from '../src/config/stats.config';
import { EventBus } from '../src/core/EventBus';
import { Tank } from '../src/entities/Tank';
import { LevelingSystem } from '../src/systems/LevelingSystem';

describe('LevelingSystem (Score, Level up, Stat allocation & Reset)', () => {
  it('adds score, triggers level up and distributes correct stat points', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 0, 0);
    const levelingSystem = new LevelingSystem(eventBus, [tank]);

    let levelUpCalls = 0;
    let lastLevel = 1;
    eventBus.onLevelUp((_id, lvl) => {
      levelUpCalls++;
      lastLevel = lvl;
    });

    let statPointsReported = 0;
    eventBus.onStatPointsChanged((_id, pts) => {
      statPointsReported = pts;
    });

    // 1. +10 分（打爆方塊）-> Lv 2 (門檻 4 分)，獲得 1 點技能點
    levelingSystem.addScore(tank, 10, eventBus);
    expect(tank.score).toBe(10);
    expect(tank.level).toBe(2);
    expect(tank.statPoints).toBe(1);
    expect(lastLevel).toBe(2);
    expect(statPointsReported).toBe(1);
    expect(levelUpCalls).toBe(1);

    // 2. 升至 Lv 15 (787 分) -> 應累計 14 點技能點
    levelingSystem.addScore(tank, 787 - 10, eventBus);
    expect(tank.score).toBe(787);
    expect(tank.level).toBe(15);
    expect(tank.statPoints).toBe(14);

    // 3. 升至 Lv 30 (6184 分) -> 應累計 28 點技能點 (Lv 29 不給點，Lv 30 共 28 點)
    levelingSystem.addScore(tank, 6184 - 787, eventBus);
    expect(tank.score).toBe(6184);
    expect(tank.level).toBe(30);
    expect(tank.statPoints).toBe(28);

    // 4. 升至 Lv 45 (23536 分) -> 應累計 33 點技能點
    levelingSystem.addScore(tank, 23536 - 6184, eventBus);
    expect(tank.score).toBe(23536);
    expect(tank.level).toBe(45);
    expect(tank.statPoints).toBe(33);

    // 5. 超過 Lv 45 滿級門檻繼續加分 -> 等級維持 45，不給予額外點數
    levelingSystem.addScore(tank, 5000, eventBus);
    expect(tank.score).toBe(28536);
    expect(tank.level).toBe(45);
    expect(tank.statPoints).toBe(33);
  });

  it('spends stat points up to maximum 7 and updates derived stats immediately', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 0, 0);
    const levelingSystem = new LevelingSystem(eventBus, [tank]);

    // 給予 10 點技能點
    tank.statPoints = 10;

    // 投資 1 點 Reload
    expect(tank.reloadTicks).toBe(15);
    const success = levelingSystem.spendStatPoint(tank, STAT_RELOAD, eventBus);
    expect(success).toBe(true);
    expect(tank.statLevels[STAT_RELOAD]).toBe(1);
    expect(tank.statPoints).toBe(9);
    // 衍生屬性立即更新：15 - 1 = 14 ticks
    expect(tank.reloadTicks).toBe(14);

    // 投資 1 點 Bullet Damage
    expect(tank.bulletDamage).toBe(7);
    levelingSystem.spendStatPoint(tank, STAT_BULLET_DAMAGE, eventBus);
    expect(tank.statLevels[STAT_BULLET_DAMAGE]).toBe(1);
    // 衍生屬性立即更新：7 + 3 = 10
    expect(tank.bulletDamage).toBe(10);

    // 投資 1 點 Max Health
    const oldMax = tank.maxHp;
    levelingSystem.spendStatPoint(tank, STAT_MAX_HEALTH, eventBus);
    expect(tank.statLevels[STAT_MAX_HEALTH]).toBe(1);
    expect(tank.maxHp).toBe(oldMax + 20);
    expect(tank.hp).toBe(oldMax + 20);

    // 單項加點滿 7 點後無法繼續投資
    tank.statLevels[STAT_RELOAD] = 7;
    const overSpend = levelingSystem.spendStatPoint(
      tank,
      STAT_RELOAD,
      eventBus,
    );
    expect(overSpend).toBe(false);
    expect(tank.statLevels[STAT_RELOAD]).toBe(7);

    // 點數歸零後無法投資
    tank.statPoints = 0;
    const noPoint = levelingSystem.spendStatPoint(
      tank,
      STAT_BULLET_DAMAGE,
      eventBus,
    );
    expect(noPoint).toBe(false);

    // 非法索引拒絕
    tank.statPoints = 5;
    expect(levelingSystem.spendStatPoint(tank, -1, eventBus)).toBe(false);
    expect(levelingSystem.spendStatPoint(tank, 8, eventBus)).toBe(false);
  });

  it('awards XP on shape destroyed and kill reward on tank died', () => {
    const eventBus = new EventBus();
    const killer = new Tank(1, 100, 100);
    const victim = new Tank(2, 200, 200);
    victim.score = 2000;
    victim.level = 20;

    new LevelingSystem(eventBus, [killer, victim]);

    // 1. 擊破方塊 (10 XP)
    eventBus.emitShapeDestroyed('square', killer.id);
    expect(killer.score).toBe(10);

    // 2. 擊破三角 (25 XP)
    eventBus.emitShapeDestroyed('triangle', killer.id);
    expect(killer.score).toBe(35);

    // 3. 擊破五邊形 (130 XP)
    eventBus.emitShapeDestroyed('pentagon', killer.id);
    expect(killer.score).toBe(165);

    // 4. 擊殺坦克：獲得受害者 100% 分數 (2000 分)
    eventBus.emitTankDied(victim.id, killer.id);
    expect(killer.score).toBe(165 + 2000);

    // 受害者重置為 Lv 1 與 0 分
    expect(victim.score).toBe(0);
    expect(victim.level).toBe(1);
    expect(victim.statPoints).toBe(0);
  });
});
