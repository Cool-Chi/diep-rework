import { applyAiBuild } from '../ai/aiTactics';
import { KILL_REWARD_RATIO } from '../config/constants';
import { levelForScore, pointsForLevel } from '../config/levels.config';
import { MAX_STAT_POINTS, TOTAL_STATS } from '../config/stats.config';
import {
  BASIC_TANK_DEFINITION,
  TANKS_CONFIG,
  type TankClassId,
} from '../config/tanks.config';
import { recomputeDerivedStats } from '../core/deriveStats';
import type { EventBus } from '../core/EventBus';
import type { ShapeType } from '../entities/Shape';
import type { Tank } from '../entities/Tank';

/**
 * 等級與升級系統 (LevelingSystem)
 * 負責維護實體分數 (Score = XP)、等級查表、技能點數發放與屬性點數加點結算
 */
export class LevelingSystem {
  public tanks: Tank[] = [];

  constructor(eventBus?: EventBus, tanks?: Tank[]) {
    if (tanks) {
      this.tanks = tanks;
    }
    if (eventBus) {
      this.bindEvents(eventBus);
    }
  }

  /**
   * 綁定 EventBus 監聽形狀摧毀與擊殺事件
   */
  public bindEvents(eventBus: EventBus): void {
    eventBus.onShapeDestroyed((kind: ShapeType, killerId: number) => {
      const killer = this.findTank(killerId);
      if (killer) {
        this.addScore(killer, this.getShapeXp(kind), eventBus);
      }
    });

    eventBus.onTankDied((victimId: number, killerId = -1) => {
      if (killerId >= 0 && killerId !== victimId) {
        const killer = this.findTank(killerId);
        const victim = this.findTank(victimId);
        if (killer && victim) {
          this.awardKill(killer, victim.score, eventBus);
        }
      }
      const victim = this.findTank(victimId);
      // 玩家 (id === 1) 死亡不在此處立即重置為 Lv 1，由 Game.respawnPlayer() 在玩家點擊重生時結算折半等級
      if (victim && victim.id !== 1) {
        this.resetTank(victim, eventBus);
      }
    });
  }

  public registerTank(tank: Tank): void {
    if (!this.tanks.includes(tank)) {
      this.tanks.push(tank);
    }
  }

  public findTank(id: number): Tank | undefined {
    const len = this.tanks.length;
    for (let i = 0; i < len; i++) {
      if (this.tanks[i].id === id) {
        return this.tanks[i];
      }
    }
    return undefined;
  }

  /**
   * 取得指定幾何形狀的經驗值分數 (XP)
   * 方塊: 10, 三角: 25, 五邊形: 130
   */
  public getShapeXp(kind: ShapeType): number {
    switch (kind) {
      case 'square':
        return 10;
      case 'triangle':
        return 25;
      case 'pentagon':
        return 130;
    }
  }

  /**
   * 為坦克增加經驗分數，並處理升級與技能點數發放
   */
  public addScore(tank: Tank, delta: number, eventBus?: EventBus): void {
    if (delta <= 0 || !tank.active) return;

    tank.score += delta;
    eventBus?.emitScoreChanged(tank.id, tank.score);
    const newLevel = levelForScore(tank.score);

    if (newLevel > tank.level) {
      const oldEarnedPoints = pointsForLevel(tank.level);
      const newEarnedPoints = pointsForLevel(newLevel);
      const pointDelta = newEarnedPoints - oldEarnedPoints;

      tank.level = newLevel;
      if (pointDelta > 0) {
        tank.statPoints += pointDelta;
        if (tank.isAi) {
          applyAiBuild(tank);
        }
      }

      recomputeDerivedStats(tank);
      eventBus?.emitLevelUp(tank.id, tank.level);
      eventBus?.emitStatPointsChanged(tank.id, tank.statPoints);
      this.checkEvolution(tank, eventBus);
    }
  }

  /**
   * 檢查坦克是否達成轉職條件並發布可進化事件 (Tier 1 @ Lv 15, Tier 2 @ Lv 30)
   */
  public checkEvolution(tank: Tank, eventBus?: EventBus): void {
    if (!tank.active || tank.definition.evolutions.length === 0) return;

    if (
      (tank.definition.tier === 1 && tank.level >= 15) ||
      (tank.definition.tier === 2 && tank.level >= 30)
    ) {
      if (tank.isAi) {
        // AI 坦克達標時自動隨機轉職對應階層職業
        const cands = tank.definition.evolutions;
        const picked = cands[Math.floor(Math.random() * cands.length)];
        this.evolveTank(tank, picked, eventBus);
      } else {
        // 僅對玩家發布轉職卡牌彈出事件
        eventBus?.emitEvolutionAvailable(tank.id, tank.definition.evolutions);
      }
    }
  }

  /**
   * 將坦克轉職為目標職業
   */
  public evolveTank(
    tank: Tank,
    targetClassId: TankClassId,
    eventBus?: EventBus,
  ): boolean {
    const targetDef = TANKS_CONFIG[targetClassId];
    if (!targetDef) return false;
    if (tank.level < targetDef.requiredLevel) return false;

    tank.setClass(targetDef);
    recomputeDerivedStats(tank);
    eventBus?.emitClassChanged(tank.id, targetClassId);
    this.checkEvolution(tank, eventBus);
    return true;
  }

  /**
   * 擊殺坦克獲得獎勵分數 (原版依受害者分數給予，MVP 乘上 KILL_REWARD_RATIO)
   */
  public awardKill(
    killer: Tank,
    victimScore: number,
    eventBus?: EventBus,
  ): void {
    const reward = Math.round(victimScore * KILL_REWARD_RATIO);
    if (reward > 0) {
      this.addScore(killer, reward, eventBus);
    }
  }

  /**
   * 消耗 1 點技能點投資指定屬性
   * @param tank 目標坦克
   * @param statIndex 屬性索引 (0 ~ 7)
   * @param eventBus 可選事件匯流排
   * @returns 是否成功投資加點
   */
  public spendStatPoint(
    tank: Tank,
    statIndex: number,
    eventBus?: EventBus,
  ): boolean {
    if (!tank.active) return false;
    if (tank.statPoints <= 0) return false;
    if (statIndex < 0 || statIndex >= TOTAL_STATS) return false;
    if (tank.statLevels[statIndex] >= MAX_STAT_POINTS) return false;

    tank.statLevels[statIndex]++;
    tank.statPoints--;

    recomputeDerivedStats(tank);
    eventBus?.emitStatPointsChanged(tank.id, tank.statPoints);
    return true;
  }

  /**
   * 坦克死亡重置為初始 Lv 1 Basic Tank 狀態
   */
  public resetTank(tank: Tank, eventBus?: EventBus): void {
    tank.setClass(BASIC_TANK_DEFINITION);
    tank.resetStats();
    recomputeDerivedStats(tank);
    eventBus?.emitScoreChanged(tank.id, tank.score);
    eventBus?.emitStatPointsChanged(tank.id, tank.statPoints);
    eventBus?.emitClassChanged(tank.id, 'basic');
  }
}
