import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import { ObjectPool } from '../src/core/ObjectPool';
import { Bullet } from '../src/entities/Bullet';
import { Tank } from '../src/entities/Tank';
import { FireSystem } from '../src/systems/FireSystem';
import { LevelingSystem } from '../src/systems/LevelingSystem';
import { EvolutionPanel } from '../src/ui/EvolutionPanel';

describe('Milestone 4a: Evolution & Class Specialization', () => {
  it('triggers evolutionAvailable event when Tank reaches Lv 15', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 100, 100);
    const leveling = new LevelingSystem(eventBus, [tank]);

    let availableCandidates: string[] = [];
    eventBus.onEvolutionAvailable((_tankId, candidates) => {
      availableCandidates = [...candidates];
    });

    // 1. 低於 Lv 15 (786 分 = Lv 14)，不觸發進化
    leveling.addScore(tank, 786, eventBus);
    expect(tank.level).toBe(14);
    expect(availableCandidates).toHaveLength(0);

    // 2. 達到 Lv 15 (再 +1 分 = 787 分)，觸發 4 款 Tier 2 轉職候選
    leveling.addScore(tank, 1, eventBus);
    expect(tank.level).toBe(15);
    expect(availableCandidates).toEqual([
      'twin',
      'sniper',
      'machine_gun',
      'flank_guard',
    ]);
  });

  it('evolves tank into Twin and verifies alternating dual-barrel firing', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 200, 200);
    const leveling = new LevelingSystem(eventBus, [tank]);
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(64, () => new Bullet());

    // 升至 Lv 15 並轉職為 Twin
    leveling.addScore(tank, 787, eventBus);
    const success = leveling.evolveTank(tank, 'twin', eventBus);
    expect(success).toBe(true);
    expect(tank.definition.id).toBe('twin');
    expect(tank.definition.barrels).toHaveLength(2);

    // 模擬瞄準正右方 (0 rad) 並長按開火
    tank.input.aimX = 300;
    tank.input.aimY = 200;
    tank.input.shooting = true;

    // Tick 0: 第一次開火，管 0 發射，管 1 注入相位延遲 (約 8 ticks)
    fireSystem.updateTankFiring(tank, bulletPool);
    expect(bulletPool.getActiveCount()).toBe(1);

    // 檢查發射的子彈（由管 0 發出，橫向偏移 Y = -12）
    const b0 = bulletPool.items[0];
    expect(b0.y).toBeCloseTo(200 - 12 * 1.149, 1);

    // Tick 1~6: 兩管皆在冷卻中，無子彈發射
    for (let t = 1; t <= 6; t++) {
      fireSystem.updateTankFiring(tank, bulletPool);
    }
    expect(bulletPool.getActiveCount()).toBe(1);

    // Tick 8: 管 1 延遲結束，發射第二發（橫向偏移 Y = +12）
    fireSystem.updateTankFiring(tank, bulletPool);
    fireSystem.updateTankFiring(tank, bulletPool);
    expect(bulletPool.getActiveCount()).toBe(2);
    const b1 = bulletPool.items[1];
    expect(b1.y).toBeCloseTo(200 + 12 * 1.149, 1);
  });

  it('evolves tank into Sniper and verifies FOV and higher bullet speed', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 200, 200);
    const leveling = new LevelingSystem(eventBus, [tank]);
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(64, () => new Bullet());

    leveling.addScore(tank, 787, eventBus);
    leveling.evolveTank(tank, 'sniper', eventBus);

    expect(tank.definition.fovMultiplier).toBe(1.111);

    tank.input.aimX = 300;
    tank.input.aimY = 200;
    tank.input.shooting = true;

    fireSystem.updateTankFiring(tank, bulletPool);
    const bullet = bulletPool.items[0];

    // Sniper 子彈速度為 1.5x
    const expectedVx = (184 / 15) * 1.5;
    expect(bullet.vx).toBeCloseTo(expectedVx, 2);
  });

  it('evolves tank into Flank Guard and verifies simultaneous front and rear firing', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 500, 500);
    const leveling = new LevelingSystem(eventBus, [tank]);
    const fireSystem = new FireSystem();
    const bulletPool = new ObjectPool<Bullet>(64, () => new Bullet());

    leveling.addScore(tank, 787, eventBus);
    leveling.evolveTank(tank, 'flank_guard', eventBus);

    tank.input.aimX = 600;
    tank.input.aimY = 500;
    tank.input.shooting = true;

    fireSystem.updateTankFiring(tank, bulletPool);
    // 同時射出 2 顆子彈 (前向 + 後向)
    expect(bulletPool.getActiveCount()).toBe(2);

    const bFront = bulletPool.items[0];
    const bRear = bulletPool.items[1];

    expect(bFront.vx).toBeGreaterThan(0); // 朝右
    expect(bRear.vx).toBeLessThan(0); // 朝左 (背向)
  });

  it('isolates HUD interactions in EvolutionPanel and emits class upgrade on card click', () => {
    const eventBus = new EventBus();
    const panel = new EvolutionPanel(eventBus);
    panel.resize(1.0);

    let requestedClass = '';
    eventBus.onClassUpgradeRequested((cid) => {
      requestedClass = cid;
    });

    // 初始隱藏
    expect(panel.visible).toBe(false);
    expect(panel.containsPoint(50, 50)).toBe(false);

    // 展開面板
    panel.show(['twin', 'sniper', 'machine_gun', 'flank_guard']);
    expect(panel.visible).toBe(true);

    // 命中卡牌 0 (Twin, 約 16~88, 16~88)
    expect(panel.containsPoint(40, 40)).toBe(true);
    const handled = panel.handlePointerDown(40, 40);
    expect(handled).toBe(true);
    expect(requestedClass).toBe('twin');
    expect(panel.visible).toBe(false); // 點選後自動關閉

    panel.destroy();
  });
});
