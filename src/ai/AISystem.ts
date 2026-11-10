import { MAP_SIZE } from '../config/constants';
import type { ObjectPool } from '../core/ObjectPool';
import type { Bullet } from '../entities/Bullet';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import { getOptimalCombatDistance } from './aiTactics';

const PERCEPTION_RADIUS = 550; // 索敵警戒半徑
const THREAT_ESCAPE_RADIUS = 700; // 脫離威脅安全半徑
const MIN_RETREAT_TICKS = 45; // 殘血逃逸至少保持 45 ticks (1.8秒) 防抖
const SHAPE_SAFE_DISTANCE = 140; // 避免與形狀肉搏碰撞之安全緩衝
const BULLET_EVASION_RADIUS = 180; // 子彈近迫警戒半徑
const BORDER_BUFFER = 250; // 邊界推回力場緩衝

/**
 * AI 決策系統 (AISystem)
 * 100% 透過寫入實體的 InputCommand (moveX, moveY, aimX, aimY, shooting) 驅動，
 * 嚴格遵循熱路徑零配置 (Zero-Allocation)，不 new 任何臨時物件與閉包。
 */
export class AISystem {
  public passiveMode = false; // 是否進入測試靜止/不開火模式

  /**
   * 每個模擬 tick (25 TPS) 更新所有活動 AI 坦克的輸入指令
   */
  public update(
    aiTanks: Tank[],
    shapes: Shape[],
    allTanks: Tank[],
    bulletPool: ObjectPool<Bullet>,
    currentTick: number,
  ): void {
    const aiCount = aiTanks.length;

    for (let i = 0; i < aiCount; i++) {
      const bot = aiTanks[i];
      if (!bot.active) continue;

      if (this.passiveMode) {
        bot.input.moveX = 0;
        bot.input.moveY = 0;
        bot.input.shooting = false;
        continue;
      }

      bot.aiStateTimer++;

      // 1. 每隔約 75 ticks (3秒) 隨機反轉走位橫移方向
      if ((currentTick + bot.id * 17) % 75 === 0) {
        bot.aiStrafeDirection = bot.aiStrafeDirection === 1 ? -1 : 1;
      }

      // 2. 戰術狀態機推進 (含滯後緩衝防抖)
      this.evaluateState(bot, allTanks);

      // 3. 依狀態計算移動方向與瞄準座標
      switch (bot.aiState) {
        case 'retreating':
          this.executeRetreat(bot, allTanks);
          break;
        case 'engaging':
          this.executeCombat(bot, allTanks, bulletPool);
          break;
        default:
          this.executeFarming(bot, shapes);
          break;
      }

      // 4. 世界地圖邊界排斥力場（防止 AI 卡在 4000x4000 邊緣）
      this.applyBoundaryAvoidance(bot);

      // 5. 正規化移動速度向量，長度不超過 1.0
      this.normalizeMovement(bot);
    }
  }

  /**
   * 評估與切換 AI 戰術狀態（帶有滯後區間與冷卻，避免決策抽搐）
   */
  private evaluateState(bot: Tank, allTanks: Tank[]): void {
    const hpRatio = bot.hp / bot.maxHp;

    // A. 殘血危機判斷 (HP < 35%) -> 進入 RETREATING
    if (hpRatio < 0.35 && bot.aiState !== 'retreating') {
      bot.aiState = 'retreating';
      bot.aiStateTimer = 0;
      return;
    }

    // B. 逃逸復原判斷 (至少維持 MIN_RETREAT_TICKS 且 HP > 60% 或威脅已遠離)
    if (bot.aiState === 'retreating') {
      if (bot.aiStateTimer >= MIN_RETREAT_TICKS) {
        const nearestEnemy = this.findNearestEnemyTank(
          bot,
          allTanks,
          THREAT_ESCAPE_RADIUS,
        );
        if (hpRatio >= 0.6 || !nearestEnemy) {
          bot.aiState = nearestEnemy ? 'engaging' : 'farming';
          bot.aiStateTimer = 0;
        }
      }
      return;
    }

    // C. 索敵對決判斷：感知半徑內是否有敵對目標
    const threat = this.findNearestEnemyTank(bot, allTanks, PERCEPTION_RADIUS);
    if (threat) {
      if (bot.aiState !== 'engaging') {
        bot.aiState = 'engaging';
        bot.aiStateTimer = 0;
        bot.aiTargetId = threat.id;
      }
    } else {
      // 若原先交火中但失去目標（超出警戒區），切回 FARMING
      if (bot.aiState === 'engaging') {
        const currentTarget = this.findTankById(bot.aiTargetId, allTanks);
        if (!currentTarget?.active || this.dist(bot, currentTarget) > 650) {
          bot.aiState = 'farming';
          bot.aiStateTimer = 0;
          bot.aiTargetId = -1;
        }
      }
    }
  }

  /**
   * 執行 FARMING 狀態（打怪發育與遊蕩）
   */
  private executeFarming(bot: Tank, shapes: Shape[]): void {
    // 優先查詢 600 距離內最近且活動的幾何形狀
    const shape = this.findNearestShape(bot, shapes, 600);

    if (shape) {
      const dx = shape.x - bot.x;
      const dy = shape.y - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      // 瞄準形狀並射擊
      bot.input.aimX = shape.x;
      bot.input.aimY = shape.y;
      bot.input.shooting = true;

      // 移動：若距離大於安全距離則靠近，過近則保持安全距離防止碰撞受傷
      if (d > SHAPE_SAFE_DISTANCE) {
        bot.input.moveX = dx / d;
        bot.input.moveY = dy / d;
      } else {
        bot.input.moveX = -dx / d;
        bot.input.moveY = -dy / d;
      }
    } else {
      // 無形狀時平滑巡邏漫遊 (每 100 ticks 緩慢微調航向，巡邏地圖廣大區域)
      bot.input.shooting = false;
      const angle =
        (bot.id * 1.7 + Math.floor(bot.aiStateTimer / 100) * 0.8) %
        (Math.PI * 2);
      bot.input.moveX = Math.cos(angle) * 0.65;
      bot.input.moveY = Math.sin(angle) * 0.65;
      bot.input.aimX = bot.x + Math.cos(angle) * 100;
      bot.input.aimY = bot.y + Math.sin(angle) * 100;
    }
  }

  /**
   * 執行 ENGAGING 狀態（風箏拉打、提前量瞄準與彈道閃避）
   */
  private executeCombat(
    bot: Tank,
    allTanks: Tank[],
    bulletPool: ObjectPool<Bullet>,
  ): void {
    let target = this.findTankById(bot.aiTargetId, allTanks);
    if (!target?.active) {
      target = this.findNearestEnemyTank(bot, allTanks, PERCEPTION_RADIUS);
      if (!target) {
        bot.aiState = 'farming';
        return;
      }
      bot.aiTargetId = target.id;
    }

    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distToTarget = Math.sqrt(dx * dx + dy * dy);
    if (distToTarget <= 0.0001) return;

    const nx = dx / distToTarget;
    const ny = dy / distToTarget;

    // 1. 提前量預測瞄準 (Lead Aiming)
    // t_hit = dist / bulletSpeed
    const bSpeed = Math.max(bot.bulletSpeed, 10);
    const tHit = distToTarget / bSpeed;
    bot.input.aimX = target.x + target.vx * tHit;
    bot.input.aimY = target.y + target.vy * tHit;
    bot.input.shooting = true;

    // 2. 戰術拉打走位 (基於職業最佳距離的推進/後退 + 側向環繞 Strafe)
    const optimalDist = getOptimalCombatDistance(bot.definition.id);
    const strafeDir = bot.aiStrafeDirection;
    // 側向垂直向量：(-ny * strafeDir, nx * strafeDir)
    const perpX = -ny * strafeDir;
    const perpY = nx * strafeDir;

    let forwardWeight = 0;
    if (distToTarget > optimalDist + 40) {
      forwardWeight = 0.75; // 太遠，向前推進
    } else if (distToTarget < optimalDist - 40) {
      forwardWeight = -0.75; // 太近，後退拉開射程
    }

    bot.input.moveX = nx * forwardWeight + perpX * 0.85;
    bot.input.moveY = ny * forwardWeight + perpY * 0.85;

    // 3. 子彈彈道近迫閃避 (Bullet Strafing Dodge)
    this.applyBulletEvasion(bot, bulletPool);
  }

  /**
   * 執行 RETREATING 狀態（背向狂奔 + 砲管後座力火箭反衝推進）
   */
  private executeRetreat(bot: Tank, allTanks: Tank[]): void {
    const threat = this.findNearestEnemyTank(
      bot,
      allTanks,
      THREAT_ESCAPE_RADIUS,
    );

    if (threat) {
      const dx = threat.x - bot.x;
      const dy = threat.y - bot.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d > 0.001) {
        // 向威脅來源的相反方向全速衝刺
        bot.input.moveX = -dx / d;
        bot.input.moveY = -dy / d;

        // 【後座力火箭反衝技術】：砲管轉向身後追擊者全力開火，利用後座力為自己提供逃逸推力！
        bot.input.aimX = threat.x;
        bot.input.aimY = threat.y;
        bot.input.shooting = true;
        return;
      }
    }

    // 無特定威脅時沿巡邏方向脫離危險區，停火並自然回血
    const angle =
      (bot.id * 2.3 + Math.floor(bot.aiStateTimer / 120)) % (Math.PI * 2);
    bot.input.moveX = Math.cos(angle) * 0.7;
    bot.input.moveY = Math.sin(angle) * 0.7;
    bot.input.aimX = bot.x + Math.cos(angle) * 100;
    bot.input.aimY = bot.y + Math.sin(angle) * 100;
    bot.input.shooting = false;
  }

  /**
   * 即時偵測朝向自身逼近之敵方子彈，疊加垂直側移閃躲力道
   */
  private applyBulletEvasion(bot: Tank, bulletPool: ObjectPool<Bullet>): void {
    const items = bulletPool.items;
    const len = items.length;

    for (let i = 0; i < len; i++) {
      const bullet = items[i];
      if (!bullet.active || bullet.ownerId === bot.id) continue;

      const bdx = bullet.x - bot.x;
      const bdy = bullet.y - bot.y;
      const bDistSq = bdx * bdx + bdy * bdy;

      // 進入警戒範圍 (180 單位以內)
      if (bDistSq < BULLET_EVASION_RADIUS * BULLET_EVASION_RADIUS) {
        // 檢查子彈是否正朝自身逼近 (相對速度與相對向量內積 < 0)
        const dot = bdx * bullet.vx + bdy * bullet.vy;
        if (dot < 0) {
          const bSpeed = Math.sqrt(
            bullet.vx * bullet.vx + bullet.vy * bullet.vy,
          );
          if (bSpeed > 0.01) {
            // 子彈行進方向之垂直向量
            const evadeX = -bullet.vy / bSpeed;
            const evadeY = bullet.vx / bSpeed;

            // 疊加側移閃避力道
            bot.input.moveX += evadeX * 1.2;
            bot.input.moveY += evadeY * 1.2;
            break; // 每次優先規避最近的一顆危險子彈
          }
        }
      }
    }
  }

  /**
   * 邊界防撞力場：距離邊緣小於 BORDER_BUFFER 時向內推回
   */
  private applyBoundaryAvoidance(bot: Tank): void {
    const buf = BORDER_BUFFER;
    if (bot.x < buf) {
      bot.input.moveX += (buf - bot.x) / buf;
    } else if (bot.x > MAP_SIZE - buf) {
      bot.input.moveX -= (bot.x - (MAP_SIZE - buf)) / buf;
    }

    if (bot.y < buf) {
      bot.input.moveY += (buf - bot.y) / buf;
    } else if (bot.y > MAP_SIZE - buf) {
      bot.input.moveY -= (bot.y - (MAP_SIZE - buf)) / buf;
    }
  }

  /**
   * 正規化移動指令大小至 1.0 上限
   */
  private normalizeMovement(bot: Tank): void {
    const mx = bot.input.moveX;
    const my = bot.input.moveY;
    const magSq = mx * mx + my * my;
    if (magSq > 1.0) {
      const invMag = 1.0 / Math.sqrt(magSq);
      bot.input.moveX = mx * invMag;
      bot.input.moveY = my * invMag;
    }
  }

  // --- 輔助查詢純函式 (熱路徑零配置，無閉包無配置) ---

  private findNearestEnemyTank(
    self: Tank,
    allTanks: Tank[],
    maxRadius: number,
  ): Tank | null {
    let bestTank: Tank | null = null;
    let minDistSq = maxRadius * maxRadius;
    const len = allTanks.length;

    for (let i = 0; i < len; i++) {
      const other = allTanks[i];
      if (!other.active || other.id === self.id) continue;

      const dx = other.x - self.x;
      const dy = other.y - self.y;
      const d2 = dx * dx + dy * dy;

      if (d2 < minDistSq) {
        minDistSq = d2;
        bestTank = other;
      }
    }

    return bestTank;
  }

  private findNearestShape(
    self: Tank,
    shapes: Shape[],
    maxRadius: number,
  ): Shape | null {
    let bestShape: Shape | null = null;
    let minDistSq = maxRadius * maxRadius;
    const len = shapes.length;

    for (let i = 0; i < len; i++) {
      const shape = shapes[i];
      if (!shape.active) continue;

      const dx = shape.x - self.x;
      const dy = shape.y - self.y;
      const d2 = dx * dx + dy * dy;

      if (d2 < minDistSq) {
        minDistSq = d2;
        bestShape = shape;
      }
    }

    return bestShape;
  }

  private findTankById(id: number, allTanks: Tank[]): Tank | null {
    if (id < 0) return null;
    const len = allTanks.length;
    for (let i = 0; i < len; i++) {
      if (allTanks[i].id === id && allTanks[i].active) {
        return allTanks[i];
      }
    }
    return null;
  }

  private dist(t1: Tank, t2: Tank): number {
    const dx = t1.x - t2.x;
    const dy = t1.y - t2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }
}
