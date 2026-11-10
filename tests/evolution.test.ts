import { describe, expect, it } from 'vitest';
import type { TankClassId } from '../src/config/tanks.config';
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
      eventBus.emitClassChanged(1, cid as TankClassId);
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

  it('triggers Tier 3 evolutionAvailable event when Tier 2 Tank reaches Lv 30 (6184 score)', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 100, 100);
    const leveling = new LevelingSystem(eventBus, [tank]);

    let availableCandidates: string[] = [];
    eventBus.onEvolutionAvailable((_tankId, candidates) => {
      availableCandidates = [...candidates];
    });

    // 1. 先升至 Lv 15 並進化為 Sniper
    leveling.addScore(tank, 787, eventBus);
    leveling.evolveTank(tank, 'sniper', eventBus);
    expect(tank.definition.id).toBe('sniper');
    expect(tank.definition.tier).toBe(2);

    // 2. 升至 Lv 29 (5525 分)，未滿 30，不觸發 Tier 3 進化
    leveling.addScore(tank, 5525 - 787, eventBus);
    expect(tank.level).toBe(29);
    availableCandidates = [];
    leveling.checkEvolution(tank, eventBus);
    expect(availableCandidates).toHaveLength(0);

    // 3. 升至 Lv 30 (累計 6184 分)，觸發 Assassin 與 Hunter 進化
    leveling.addScore(tank, 6184 - 5525, eventBus);
    expect(tank.level).toBe(30);
    expect(availableCandidates).toEqual(['assassin', 'hunter']);

    // 4. 進化為 Assassin
    const success = leveling.evolveTank(tank, 'assassin', eventBus);
    expect(success).toBe(true);
    expect(tank.definition.id).toBe('assassin');
    expect(tank.definition.tier).toBe(3);
    expect(tank.definition.fovMultiplier).toBe(1.25);
  });

  it('verifies EvolutionPanel Ignore button hides panel and auto-reopens on mouse approach', () => {
    const eventBus = new EventBus();
    const panel = new EvolutionPanel(eventBus);
    panel.resize(1.0);

    panel.show(['twin', 'sniper', 'machine_gun', 'flank_guard']);
    expect(panel.visible).toBe(true);
    expect(panel.isIgnored).toBe(false);

    // 點擊 Ignore 按鈕 (位置在 Y: 16 + 104*2 + 8 + 8 = 240 附近)
    // 依 layout: screenX=16, screenY=16, panel cards = 216x216, ignoreBtn localY = 216 + 8 = 224.
    // 螢幕座標 = 16 + 224 + 14 = 254.
    const clickHandled = panel.handlePointerDown(40, 250);
    expect(clickHandled).toBe(true);
    expect(panel.isIgnored).toBe(true);
    expect(panel.containsPoint(40, 40)).toBe(false); // 被忽略時不阻擋射擊

    // 冷卻時間內靠近不重開
    panel.handlePointerMove(50, 50);
    expect(panel.isIgnored).toBe(true);

    // 經過 2.1 秒冷卻結束
    panel.update(2.1);
    // 滑鼠再次靠近左上角 (50, 50)
    panel.handlePointerMove(50, 50);
    expect(panel.isIgnored).toBe(false);
    expect(panel.visible).toBe(true);

    panel.destroy();
  });

  it('seamlessly presents Tier 3 evolution options when a Lv 30 Basic tank evolves into Tier 2', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 100, 100);
    const leveling = new LevelingSystem(eventBus, [tank]);
    const panel = new EvolutionPanel(eventBus);
    panel.resize(1.0);

    // 監聽轉職與進化事件
    eventBus.onClassUpgradeRequested((classId) => {
      leveling.evolveTank(tank, classId, eventBus);
    });
    eventBus.onEvolutionAvailable((_tankId, candidates) => {
      panel.show(candidates);
    });

    // 1. 直接將 Basic Tank 升至 Lv 30 (6184 分)
    leveling.addScore(tank, 6184, eventBus);
    expect(tank.level).toBe(30);
    expect(tank.definition.id).toBe('basic');
    expect(panel.visible).toBe(true); // 顯示 Tier 2 的 4 款卡牌

    // 2. 模擬點選第 0 張卡牌 (Twin)
    // Twin 卡牌範圍約 (16, 16) ~ (120, 120)
    const handled = panel.handlePointerDown(50, 50);
    expect(handled).toBe(true);

    // 3. 驗證坦克成功轉為 Twin，且 EvolutionPanel 立即切換為 Tier 3 (Triple Shot)
    expect(tank.definition.id).toBe('twin');
    expect(tank.definition.tier).toBe(2);
    expect(panel.visible).toBe(true); // 面板依然保持展開！

    // 4. 再次點擊卡牌 (此時候選只有 1 張 Triple Shot)
    panel.handlePointerDown(50, 50);
    expect(tank.definition.id).toBe('triple_shot');
    expect(tank.definition.tier).toBe(3);
    expect(panel.visible).toBe(false); // 無後續進化，面板關閉

    panel.destroy();
  });

  it('does not hide player EvolutionPanel when an AI tank dies or changes class', () => {
    const eventBus = new EventBus();
    const player = new Tank(1, 100, 100);
    const aiBot = new Tank(1001, 200, 200);
    aiBot.isAi = true;

    const leveling = new LevelingSystem(eventBus, [player, aiBot]);
    const panel = new EvolutionPanel(eventBus);
    panel.playerTankId = player.id;
    panel.resize(1.0);

    eventBus.onEvolutionAvailable((tankId, candidates) => {
      if (tankId === player.id) {
        panel.show(candidates);
      }
    });

    // 玩家升到 Lv 15，彈出進化面板
    leveling.addScore(player, 787, eventBus);
    expect(player.level).toBe(15);
    expect(panel.visible).toBe(true);

    // 模擬 AI 陣亡並 resetTank，廣播 emitClassChanged(aiBot.id, 'basic')
    leveling.resetTank(aiBot, eventBus);

    // 玩家的進化面板依然穩定顯示！
    expect(panel.visible).toBe(true);

    panel.destroy();
  });

  it('progresses full path from Basic -> Tier 2 -> Tier 3 -> Tier 4 at Level 45', () => {
    const eventBus = new EventBus();
    const tank = new Tank(1, 100, 100);
    const leveling = new LevelingSystem(eventBus, [tank]);

    let candidates: string[] = [];
    eventBus.onEvolutionAvailable((_id, cands) => {
      candidates = [...cands];
    });

    // 1. 升至 Lv 15，轉職 Machine Gun
    leveling.addScore(tank, 787, eventBus);
    expect(tank.level).toBe(15);
    expect(candidates).toContain('machine_gun');
    leveling.evolveTank(tank, 'machine_gun', eventBus);
    expect(tank.definition.id).toBe('machine_gun');

    // 2. 升至 Lv 30，轉職 Destroyer
    leveling.addScore(tank, 6184 - 787, eventBus);
    expect(tank.level).toBe(30);
    expect(candidates).toEqual(['destroyer', 'gunner']);
    leveling.evolveTank(tank, 'destroyer', eventBus);
    expect(tank.definition.id).toBe('destroyer');

    // 3. 升至 Lv 45，觸發 Annihilator 進化
    leveling.addScore(tank, 23536 - 6184, eventBus);
    expect(tank.level).toBe(45);
    expect(candidates).toEqual(['annihilator']);
    const evolved = leveling.evolveTank(tank, 'annihilator', eventBus);
    expect(evolved).toBe(true);
    expect(tank.definition.id).toBe('annihilator');
    expect(tank.definition.tier).toBe(4);
    expect(tank.definition.barrels[0].width).toBe(48);
  });
});
