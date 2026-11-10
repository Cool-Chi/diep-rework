import { applyAiBuild, getRandomBotColor } from '../ai/aiTactics';
import { getRandomBotName } from '../ai/botNames.config';
import { MAP_SIZE } from '../config/constants';
import { pointsForLevel, SCORE_FOR_LEVEL } from '../config/levels.config';
import {
  TANKS_CONFIG,
  type TankClassId,
  type TankDefinition,
} from '../config/tanks.config';
import { recomputeDerivedStats } from '../core/deriveStats';
import { Tank } from '../entities/Tank';

export const TARGET_AI_COUNT = 20;
const RESPAWN_DELAY_TICKS = 75; // 死亡後 3 秒 (75 ticks) 重生
const AI_STARTING_ID = 1000;

const TIER1_CLASSES: readonly TankClassId[] = ['basic'];
const TIER2_CLASSES: readonly TankClassId[] = [
  'twin',
  'sniper',
  'machine_gun',
  'flank_guard',
];
const TIER3_CLASSES: readonly TankClassId[] = [
  'triple_shot',
  'assassin',
  'destroyer',
  'twin_flank',
];

interface DeadAiRecord {
  bot: Tank;
  respawnTick: number;
}

/**
 * AI 生成與生態管理系統 (SpawnSystem)
 * 動態維持場上 20 隻 AI 坦克，依玩家等級進行梯隊生成與合理配點。
 */
export class SpawnSystem {
  public readonly aiTanks: Tank[] = [];
  private readonly deadAiQueue: DeadAiRecord[] = [];

  constructor() {
    // 預先建立 20 隻 AI 坦克實體 (零 GC)
    for (let i = 0; i < TARGET_AI_COUNT; i++) {
      const id = AI_STARTING_ID + i + 1;
      const bot = new Tank(id, 2000, 2000);
      bot.isAi = true;
      bot.active = false;
      this.aiTanks.push(bot);
    }
  }

  /**
   * 初始化場上全數 20 隻 AI
   */
  public init(playerTank: Tank): void {
    const len = this.aiTanks.length;
    for (let i = 0; i < len; i++) {
      this.spawnAiTank(
        this.aiTanks[i],
        playerTank.level,
        playerTank.x,
        playerTank.y,
      );
    }
  }

  /**
   * 每個模擬 tick (25 TPS) 更新 AI 重生佇列與維持場上數量
   */
  public update(currentTick: number, playerTank: Tank): void {
    // 1. 處理死亡 AI 重生
    const qLen = this.deadAiQueue.length;
    for (let i = qLen - 1; i >= 0; i--) {
      const record = this.deadAiQueue[i];
      if (currentTick >= record.respawnTick) {
        this.spawnAiTank(
          record.bot,
          playerTank.level,
          playerTank.x,
          playerTank.y,
        );
        this.deadAiQueue.splice(i, 1);
      }
    }

    // 2. 補足未滿額且未在佇列中的 AI (排入重生佇列而非同 tick 突兀原地出現)
    for (let i = 0; i < this.aiTanks.length; i++) {
      const bot = this.aiTanks[i];
      if (!bot.active && !this.isQueued(bot)) {
        this.deadAiQueue.push({
          bot,
          respawnTick: currentTick + RESPAWN_DELAY_TICKS,
        });
      }
    }
  }

  /**
   * 當 AI 坦克死亡時觸發排程重生
   */
  public handleTankDeath(victimId: number, currentTick: number): void {
    const bot = this.findAiById(victimId);
    if (bot) {
      bot.active = false;
      if (!this.isQueued(bot)) {
        this.deadAiQueue.push({
          bot,
          respawnTick: currentTick + RESPAWN_DELAY_TICKS,
        });
      }
    }
  }

  /**
   * 依據玩家等級梯度生成/重生一隻 AI 坦克
   */
  public spawnAiTank(
    bot: Tank,
    playerLevel: number,
    avoidX: number,
    avoidY: number,
    forcedClass?: TankClassId,
  ): void {
    // 1. 隨機生成遠離避免點 (如玩家) 的座標
    const spawnPos = this.getRandomSpawnPosition(avoidX, avoidY, bot.id);
    bot.respawn(spawnPos.x, spawnPos.y);

    // 2. 決定 AI 等級與職業梯隊
    const targetClassId =
      forcedClass ?? this.pickClassByPlayerLevel(playerLevel);
    const def: TankDefinition =
      TANKS_CONFIG[targetClassId] ?? TANKS_CONFIG.basic;
    bot.setClass(def);

    // 決定等級：若為強制或指定階級，等級需至少達該階門檻
    const targetLevel = this.pickLevelForClass(def, playerLevel);
    bot.level = targetLevel;
    bot.score = SCORE_FOR_LEVEL[targetLevel - 1] ?? 0;

    // 3. 賦予擬真暱稱與柔和配色
    bot.name = getRandomBotName();
    bot.color = getRandomBotColor();
    bot.isAi = true;

    // 4. 重置並分配流派技能點數
    bot.statLevels.fill(0);
    bot.statPoints = pointsForLevel(targetLevel);
    applyAiBuild(bot);
    recomputeDerivedStats(bot);
    bot.hp = bot.maxHp;

    // 5. 初始化 AI 戰術狀態
    bot.aiState = 'farming';
    bot.aiStateTimer = 0;
    bot.aiTargetId = -1;
    bot.active = true;
  }

  /**
   * 清除場上所有活動 AI
   */
  public clearAllAi(): void {
    this.deadAiQueue.length = 0;
    for (let i = 0; i < this.aiTanks.length; i++) {
      this.aiTanks[i].active = false;
    }
  }

  /**
   * 取得當前場上活動 AI 數量
   */
  public getActiveAiCount(): number {
    let count = 0;
    for (let i = 0; i < this.aiTanks.length; i++) {
      if (this.aiTanks[i].active) count++;
    }
    return count;
  }

  // --- 私有演算法與梯隊分布規則 ---

  private pickClassByPlayerLevel(playerLevel: number): TankClassId {
    const r = Math.random();

    if (playerLevel < 15) {
      // 玩家 Lv 1~14: 70% Tier 1, 30% Tier 2
      if (r < 0.7) {
        return TIER1_CLASSES[Math.floor(Math.random() * TIER1_CLASSES.length)];
      }
      return TIER2_CLASSES[Math.floor(Math.random() * TIER2_CLASSES.length)];
    }

    if (playerLevel < 30) {
      // 玩家 Lv 15~29: 30% Tier 1, 50% Tier 2, 20% Tier 3
      if (r < 0.3) {
        return TIER1_CLASSES[Math.floor(Math.random() * TIER1_CLASSES.length)];
      }
      if (r < 0.8) {
        return TIER2_CLASSES[Math.floor(Math.random() * TIER2_CLASSES.length)];
      }
      return TIER3_CLASSES[Math.floor(Math.random() * TIER3_CLASSES.length)];
    }

    // 玩家 Lv 30 滿級: 40% Tier 2, 60% Tier 3 菁英
    if (r < 0.4) {
      return TIER2_CLASSES[Math.floor(Math.random() * TIER2_CLASSES.length)];
    }
    return TIER3_CLASSES[Math.floor(Math.random() * TIER3_CLASSES.length)];
  }

  private pickLevelForClass(def: TankDefinition, playerLevel: number): number {
    if (def.tier === 1) {
      const maxL = Math.min(14, Math.max(1, playerLevel));
      return Math.floor(Math.random() * maxL) + 1;
    }
    if (def.tier === 2) {
      const maxL = Math.min(29, Math.max(15, playerLevel));
      return Math.floor(Math.random() * (maxL - 15 + 1)) + 15;
    }
    return 30; // Tier 3 固定為 Lv 30
  }

  public getRandomSpawnPosition(
    avoidX: number,
    avoidY: number,
    selfBotId?: number,
  ): { x: number; y: number } {
    const margin = 250;
    const centerAvoidSq = 600 * 600; // 避免中央五邊形巢穴
    const playerAvoidSq = 550 * 550; // 避免與玩家過近
    const botAvoidSq = 450 * 450; // 避免與既有活動 AI 扎堆重生 (防止同區域群聚)

    let bestX = margin + Math.random() * (MAP_SIZE - margin * 2);
    let bestY = margin + Math.random() * (MAP_SIZE - margin * 2);
    let bestMinDistSq = -1;

    // 全圖均勻泊松盤取樣（最多嘗試 30 次篩選安全點）
    for (let attempts = 0; attempts < 30; attempts++) {
      const rx = margin + Math.random() * (MAP_SIZE - margin * 2);
      const ry = margin + Math.random() * (MAP_SIZE - margin * 2);

      // 1. 檢查是否遠離地圖正中央五邊形巢穴
      const cdx = rx - MAP_SIZE * 0.5;
      const cdy = ry - MAP_SIZE * 0.5;
      if (cdx * cdx + cdy * cdy < centerAvoidSq) continue;

      // 2. 檢查是否遠離避開點（玩家）
      const pdx = rx - avoidX;
      const pdy = ry - avoidY;
      const pDistSq = pdx * pdx + pdy * pdy;
      if (pDistSq < playerAvoidSq) continue;

      // 3. 檢查是否遠離其他活動 AI（防扎堆堆疊）
      let closestDistSq = pDistSq;
      let tooCloseToBot = false;

      for (let i = 0; i < this.aiTanks.length; i++) {
        const other = this.aiTanks[i];
        if (!other.active || other.id === selfBotId) continue;

        const bdx = rx - other.x;
        const bdy = ry - other.y;
        const bDistSq = bdx * bdx + bdy * bdy;
        if (bDistSq < closestDistSq) {
          closestDistSq = bDistSq;
        }
        if (bDistSq < botAvoidSq) {
          tooCloseToBot = true;
          break;
        }
      }

      if (closestDistSq > bestMinDistSq) {
        bestMinDistSq = closestDistSq;
        bestX = rx;
        bestY = ry;
      }

      if (!tooCloseToBot) {
        return { x: rx, y: ry };
      }
    }

    // 若多次取樣未能滿足嚴格互斥條件，選取與最近實體距離最大之候選點
    return { x: bestX, y: bestY };
  }

  private isQueued(bot: Tank): boolean {
    for (let i = 0; i < this.deadAiQueue.length; i++) {
      if (this.deadAiQueue[i].bot === bot) return true;
    }
    return false;
  }

  public findAiById(id: number): Tank | undefined {
    for (let i = 0; i < this.aiTanks.length; i++) {
      if (this.aiTanks[i].id === id) return this.aiTanks[i];
    }
    return undefined;
  }
}
