import {
  AI_BORDER_BUFFER,
  AI_BULLET_SCAN_RADIUS,
  AI_ESCAPE_MAINTAIN_TICKS,
  AI_INTERCEPT_LOCK_TICKS,
  AI_INTERCEPT_MAX_ANGLE,
  AI_INTERCEPT_MIN_BULLET_RADIUS,
  AI_INTIMIDATION_POWER_DIFF_THRESHOLD,
  AI_MAX_CPA_TICKS,
  AI_RETREAT_FORCE_MULTIPLIER,
  AI_RETREAT_HP_ENTER,
  AI_RETREAT_HP_EXIT,
  AI_SHAPE_AVOID_DISTANCE,
  AI_SHAPE_AVOID_FORCE,
  AI_SHAPE_LOOKAHEAD_TICKS,
  AI_SHAPE_TANGENT_FORCE,
  MAP_SIZE,
} from '../config/constants';
import type { ObjectPool } from '../core/ObjectPool';
import { createRandomSeed, Mulberry32, type Rng } from '../core/rng';
import type { Bullet } from '../entities/Bullet';
import type { Shape } from '../entities/Shape';
import type { Tank } from '../entities/Tank';
import { type AiGenome, DEFAULT_GENOME, getGenomeBranch } from './aiGenome';
import {
  AI_PERSONAS,
  type AiPersona,
  getRecoilBoostMode,
  LEGACY_PERSONA,
} from './aiPersonas.config';
import { getOptimalCombatDistance } from './aiTactics';

const PERCEPTION_RADIUS = 750; // 索敵警戒半徑（隨相機視野擴大同步提升）
const THREAT_ESCAPE_RADIUS = 950; // 脫離威脅安全半徑
const SHAPE_SAFE_DISTANCE = 140; // 避免與形狀肉搏碰撞之安全緩衝
const BORDER_BUFFER = AI_BORDER_BUFFER; // 邊界推回力場緩衝 (350)

/**
 * 計算坦克實時綜合戰鬥力 (Combat Power Index)
 * 公式：等級 * 1.0 + (階級 - 1) * 8.0 + 生命比例 * 6.0
 */
export function computeCombatPower(tank: Tank): number {
  const tier = tank.definition?.tier ?? 1;
  const hpRatio = tank.maxHp > 0 ? tank.hp / tank.maxHp : 1;
  return tank.level * 1.0 + (tier - 1) * 8.0 + hpRatio * 6.0;
}

/**
 * AI 決策系統 (AISystem)
 * 整合 M8 (CPA 預判、前向視錐攔截、5 股連續向量混合、防牆角死鎖切線滑動)
 * 與 M9 (4 種強弱人設、可注入種子 PRNG、可訓練戰術基因組、防抖 Aim Noise、合理後座力趕路)。
 * 100% 透過寫入實體的 InputCommand (moveX, moveY, aimX, aimY, shooting) 驅動，
 * 嚴格遵循熱路徑零配置 (Zero-Allocation)，不 new 任何臨時物件與閉包。
 */
export class AISystem {
  public passiveMode = false; // 是否進入測試靜止/不開火模式
  public ignorePlayer = true; // 是否無視玩家 (調試用，預設開啟)

  /** 小型競技場邊界約束（當沙盒啟用時限定 AI 活動範圍，否則為全圖） */
  public arenaBounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null = null;

  /** 可訓練戰術基因組（預設 100% 還原 M8 行為） */
  public genome: AiGenome = DEFAULT_GENOME;

  /** 確定性隨機數產生器（注入用，訓練 100% 可重現） */
  public rng: Rng;

  // 暫存零 GC 幾何形狀主動避障排斥力場
  private _shapeAvoidX = 0;
  private _shapeAvoidY = 0;

  constructor(rng?: Rng, genome?: AiGenome) {
    this.rng = rng ?? new Mulberry32(createRandomSeed());
    if (genome) {
      this.genome = genome;
    }
  }

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

      if (bot.name === 'Target Dummy') {
        // 沙盒測試靶機：定點錨定於玩家前方 360 單位，持續朝向玩家射擊供測試子彈相消與偏折
        const player = allTanks[0];
        bot.vx = 0;
        bot.vy = 0;
        bot.x = player.x + 360;
        bot.y = player.y;
        bot.prevX = bot.x;
        bot.prevY = bot.y;
        bot.input.moveX = 0;
        bot.input.moveY = 0;
        bot.input.aimX = player.x;
        bot.input.aimY = player.y;
        bot.input.shooting = true;
        bot.rotation = Math.atan2(player.y - bot.y, player.x - bot.x);
        bot.prevRotation = bot.rotation;
        continue;
      }

      if (this.passiveMode) {
        bot.input.moveX = 0;
        bot.input.moveY = 0;
        bot.input.shooting = false;
        continue;
      }

      bot.aiStateTimer++;

      // 取得坦克對應人設配置 (若未設置 persona 則沿用 M8 基準)
      const persona: AiPersona = bot.persona
        ? AI_PERSONAS[bot.persona]
        : LEGACY_PERSONA;

      // --- M9 決策間隔節流與防抖 Aim Noise 取樣 ---
      // 重要防抖但書：Aim Noise 嚴禁每 tick 重抽！僅在 reactionIntervalTicks 週期到期時抽樣一次並保持穩定
      const isDecisionTick = bot.aiDecisionTimer <= 0;
      if (isDecisionTick) {
        bot.aiDecisionTimer = Math.max(1, persona.reactionIntervalTicks);
        if (persona.aimNoiseRad > 0) {
          bot.aiNoiseOffset =
            this.rng.gaussian() * persona.aimNoiseRad * bot.aiSkillJitter;
        } else {
          bot.aiNoiseOffset = 0;
        }

        // 刷新非戰鬥時後座力趕路意圖
        if (persona.recoilBoostChance > 0) {
          bot.aiRecoilBoost = this.rng.chance(persona.recoilBoostChance);
        } else {
          bot.aiRecoilBoost = false;
        }
      } else {
        bot.aiDecisionTimer--;
      }

      // 1. 每隔約 75 ticks (3秒) 隨機反轉走位橫移方向
      if ((currentTick + bot.id * 17) % 75 === 0) {
        bot.aiStrafeDirection = bot.aiStrafeDirection === 1 ? -1 : 1;
      }

      // 2. 【Phase 3 防呆 1: 防幽靈鎖定 (Stale Pool Index)】
      this.validateInterceptLock(bot, bulletPool);

      // 3. 【Phase 4 & M9: 效用慣性目標選取、殘血勸架權重與多敵包夾統計】
      const classFov = bot.definition?.fovMultiplier ?? 1.0;
      const perceptionLimit = this.arenaBounds
        ? 1500
        : (bot.aiState === 'retreating'
            ? THREAT_ESCAPE_RADIUS
            : PERCEPTION_RADIUS) * classFov;
      const enemyTarget = this.findNearestEnemyTank(
        bot,
        allTanks,
        perceptionLimit,
        persona,
      );
      if (enemyTarget) {
        bot.aiTargetId = enemyTarget.id;
      } else {
        bot.aiTargetId = -1;
      }

      const shapeTarget = this.findNearestShape(bot, shapes, 1200);
      if (shapeTarget) {
        bot.aiTargetShapeId = shapeTarget.id;
      } else {
        bot.aiTargetShapeId = -1;
      }

      // 4. 【殘血逃跑 (Retreat) 滯後狀態機 (Hysteresis)、強弱威懾避退與定向逃逸維持】
      const hpRatio = bot.hp / bot.maxHp;
      const isCornered =
        bot.aiNearEnemyCount >= 2 && persona.multiEnemyAwareness >= 0.5;

      let isOutmatched = false;
      if (enemyTarget) {
        const selfPower = computeCombatPower(bot);
        const enemyPower = computeCombatPower(enemyTarget);
        const powerDiff = enemyPower - selfPower;
        if (powerDiff > 0 && persona.intimidationSensitivity > 0) {
          isOutmatched =
            powerDiff * persona.intimidationSensitivity >=
            AI_INTIMIDATION_POWER_DIFF_THRESHOLD;
        }
      }

      if (enemyTarget) {
        // 更新逃跑方向向量（遠離可視敵人）
        const edx = enemyTarget.x - bot.x;
        const edy = enemyTarget.y - bot.y;
        const ed = Math.sqrt(edx * edx + edy * edy);
        if (ed > 0.001) {
          bot.aiEscapeVx = -edx / ed;
          bot.aiEscapeVy = -edy / ed;
        }

        if (bot.aiState === 'retreating') {
          // 雙門檻滯後：只要威脅仍在，持續逃跑直到生命恢復至 >= 70% 且未被多人包夾且未實力懸殊
          bot.aiEscapeMaintainTicks = AI_ESCAPE_MAINTAIN_TICKS;
          if (hpRatio >= AI_RETREAT_HP_EXIT && !isCornered && !isOutmatched) {
            bot.aiState = 'engaging';
            bot.aiEscapeMaintainTicks = 0;
          }
        } else {
          // 進入逃跑條件：生命值 < 45% 或被多人包夾，或面對強大敵人實力懸殊觸發主動避退
          if (hpRatio < AI_RETREAT_HP_ENTER || isCornered || isOutmatched) {
            bot.aiState = 'retreating';
            bot.aiEscapeMaintainTicks = AI_ESCAPE_MAINTAIN_TICKS;
          } else {
            bot.aiState = 'engaging';
          }
        }
      } else {
        // 敵人離開可視視野：若逃跑維持計時器尚未歸零，持續定向逃跑建立安全緩衝區！
        if (bot.aiState === 'retreating' && bot.aiEscapeMaintainTicks > 0) {
          bot.aiEscapeMaintainTicks--;
          // 若無有效逃逸向量，則朝地圖中央逃逸
          if (
            bot.aiEscapeVx * bot.aiEscapeVx + bot.aiEscapeVy * bot.aiEscapeVy <
            0.001
          ) {
            const cdx = MAP_SIZE * 0.5 - bot.x;
            const cdy = MAP_SIZE * 0.5 - bot.y;
            const cd = Math.sqrt(cdx * cdx + cdy * cdy);
            if (cd > 0.001) {
              bot.aiEscapeVx = cdx / cd;
              bot.aiEscapeVy = cdy / cd;
            }
          }
        } else {
          // 周遭無敵方坦克威脅且脫離危險期，安全回歸農怪發育
          bot.aiState = 'farming';
          bot.aiEscapeMaintainTicks = 0;
        }
      }

      // 5. 【Phase 3: CPA 來襲威脅預判與高威脅子彈鎖定】
      // 關鍵優化：有敵方坦克時，普通子彈 (radius < 18) 100% 透過身法側閃 (evadeX/evadeY) 避彈，絕不轉動砲口分心搶瞄！
      let evadeX = 0;
      let evadeY = 0;
      const bestThreatBulletIdx = this.scanBulletThreats(
        bot,
        bulletPool,
        enemyTarget !== null,
        (ex, ey) => {
          evadeX += ex;
          evadeY += ey;
        },
      );

      // 若未處於鎖定中且偵測到巨型重砲彈 (Destroyer/Annihilator)，觸發 4 ticks 防抖鎖定
      if (bestThreatBulletIdx !== -1 && bot.aiInterceptTimer <= 0) {
        bot.aiInterceptBulletIdx = bestThreatBulletIdx;
        bot.aiInterceptTimer = AI_INTERCEPT_LOCK_TICKS;
      }

      // 6. 【Phase 4 & M9: 5 股力場向量混合、殘血逃逸加乘、幾何形狀避障與牆角防死鎖滑動】
      this.blendSteeringVectors(
        bot,
        enemyTarget,
        shapeTarget,
        evadeX,
        evadeY,
        this._shapeAvoidX,
        this._shapeAvoidY,
        hpRatio,
        persona,
      );

      // 7. 【Phase 3 & M9: 瞄準與射擊決策（真身對位 + 殘血邊退邊打/後座力推進）】
      this.decideAimAndShoot(
        bot,
        enemyTarget,
        shapeTarget,
        bulletPool,
        persona,
      );
    }
  }

  /**
   * 【Phase 3 防呆 1】防幽靈鎖定 (Stale Pool Index)：
   * 每 tick 驗證鎖定子彈是否仍處於活躍中、非自身發射且正朝向自身逼近。一旦無效立即重置。
   */
  private validateInterceptLock(
    bot: Tank,
    bulletPool: ObjectPool<Bullet>,
  ): void {
    if (bot.aiInterceptTimer <= 0 || bot.aiInterceptBulletIdx < 0) {
      bot.aiInterceptBulletIdx = -1;
      bot.aiInterceptTimer = 0;
      return;
    }

    const idx = bot.aiInterceptBulletIdx;
    if (idx >= bulletPool.capacity || !bulletPool.isActive(idx)) {
      bot.aiInterceptBulletIdx = -1;
      bot.aiInterceptTimer = 0;
      return;
    }

    const bullet = bulletPool.items[idx];
    if (
      !bullet.active ||
      bullet.ownerId === bot.id ||
      (this.ignorePlayer && bullet.ownerId === 1)
    ) {
      bot.aiInterceptBulletIdx = -1;
      bot.aiInterceptTimer = 0;
      return;
    }

    const rx = bullet.x - bot.x;
    const ry = bullet.y - bot.y;
    const d2 = rx * rx + ry * ry;
    if (d2 > 450 * 450) {
      bot.aiInterceptBulletIdx = -1;
      bot.aiInterceptTimer = 0;
      return;
    }

    const rvx = bullet.vx - bot.vx;
    const rvy = bullet.vy - bot.vy;
    const dot = rx * rvx + ry * rvy;
    if (dot >= 0) {
      // 子彈已飛越自身或正在遠離
      bot.aiInterceptBulletIdx = -1;
      bot.aiInterceptTimer = 0;
      return;
    }

    // 【擬人化視錐驗證】：若鎖定之子彈已大幅偏離砲管正前視錐（> 45°），立即解除瞄準鎖定，回歸敵方本體
    const bulletAngle = Math.atan2(ry, rx);
    let angleDiff = bulletAngle - bot.rotation;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    if (Math.abs(angleDiff) > AI_INTERCEPT_MAX_ANGLE * 1.25) {
      bot.aiInterceptBulletIdx = -1;
      bot.aiInterceptTimer = 0;
      return;
    }

    // 通過檢查，扣減鎖定維持計時
    bot.aiInterceptTimer--;
  }

  /**
   * 【Phase 3: CPA (Closest Point of Approach) 來襲威脅預判】
   * 掃描周圍 550 範圍內敵方子彈，計算相對速度、最接近時間 t_cpa 與碰撞半徑。
   * @param hasEnemyTarget 是否當前已鎖定敵方坦克。若有敵方坦克，普通子彈 (radius < 18) 100% 靠走位閃避，不搶奪準星。
   * @returns 最高威脅子彈索引（若無高威脅則回傳 -1）
   */
  private scanBulletThreats(
    bot: Tank,
    bulletPool: ObjectPool<Bullet>,
    hasEnemyTarget: boolean,
    onEvadeForce: (ex: number, ey: number) => void,
  ): number {
    const items = bulletPool.items;
    const len = items.length;
    let highestThreatIdx = -1;
    let maxThreatScore = 0;

    const scanRadiusSq = AI_BULLET_SCAN_RADIUS * AI_BULLET_SCAN_RADIUS;

    for (let i = 0; i < len; i++) {
      const bullet = items[i];
      if (
        !bullet.active ||
        bullet.ownerId === bot.id ||
        (this.ignorePlayer && bullet.ownerId === 1)
      ) {
        continue;
      }

      const rx = bullet.x - bot.x;
      const ry = bullet.y - bot.y;
      const d2 = rx * rx + ry * ry;
      if (d2 > scanRadiusSq) continue;

      const rvx = bullet.vx - bot.vx;
      const rvy = bullet.vy - bot.vy;
      const vSq = rvx * rvx + rvy * rvy;
      if (vSq < 0.01) continue;

      const dot = rx * rvx + ry * rvy;
      if (dot >= 0) continue; // 子彈正在遠離

      const tCpa = -dot / vSq;
      if (tCpa <= 0 || tCpa > AI_MAX_CPA_TICKS) continue;

      const cx = rx + rvx * tCpa;
      const cy = ry + rvy * tCpa;
      const dCpaSq = cx * cx + cy * cy;

      const corridorRadius = bot.radius + bullet.radius + 18;
      if (dCpaSq <= corridorRadius * corridorRadius) {
        // 進入預測碰撞走廊！計算垂直側移避難向量 (所有子彈皆靠身法側閃)
        const bSpeed = Math.sqrt(bullet.vx * bullet.vx + bullet.vy * bullet.vy);
        if (bSpeed > 0.01) {
          let perpX = -bullet.vy / bSpeed;
          let perpY = bullet.vx / bSpeed;

          // 選擇避難方向：向遠離碰撞中心點 (cx, cy) 之方向側閃
          if (cx * perpX + cy * perpY > 0) {
            perpX = -perpX;
            perpY = -perpY;
          }

          const urgency = (AI_MAX_CPA_TICKS - tCpa) / AI_MAX_CPA_TICKS;
          onEvadeForce(perpX * urgency * 1.5, perpY * urgency * 1.5);
        }

        // 【Phase 3 擬人前向視錐過濾】：檢查子彈是否位於目前砲管前向約 ±35.5 度 (0.62 rad) 內
        // 關鍵改善：有敵方坦克時，嚴格僅允許攔截極度致命的巨型重砲彈 (Destroyer/Annihilator, 半徑 >= 18)
        // 普通子彈 (Twin/Basic/MG/Flank 等) 一律純靠身法側閃，砲管 100% 保持鎖定敵方坦克身位！
        const aimAngleToBullet = Math.atan2(ry, rx);
        let angleDiff = aimAngleToBullet - bot.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) <= AI_INTERCEPT_MAX_ANGLE && tCpa <= 20) {
          let isInterceptable = false;
          if (hasEnemyTarget) {
            isInterceptable = bullet.radius >= AI_INTERCEPT_MIN_BULLET_RADIUS;
          } else {
            // 無敵方坦克（例如農怪巡邏中），允許防衛性攔截狙擊冷槍或重型子彈
            const isHeavy = bullet.radius >= 14 || bullet.hp >= 12;
            const isSniper =
              bullet.damage >= 10 &&
              bullet.vx * bullet.vx + bullet.vy * bullet.vy >= 14 * 14;
            isInterceptable = isHeavy || isSniper;
          }

          if (isInterceptable) {
            const threatScore =
              (bullet.damage * (1 + bullet.hp / Math.max(bot.hp, 1))) /
              (1 + tCpa * 0.1);
            if (threatScore > maxThreatScore) {
              maxThreatScore = threatScore;
              highestThreatIdx = i;
            }
          }
        }
      }
    }

    return highestThreatIdx;
  }

  /**
   * 【Phase 4 & M9: 5 股連續力場向量加權混合與防死鎖滑動】
   */
  private blendSteeringVectors(
    bot: Tank,
    enemyTarget: Tank | null,
    shapeTarget: Shape | null,
    evadeX: number,
    evadeY: number,
    shapeAvoidX: number,
    shapeAvoidY: number,
    hpRatio: number,
    persona: AiPersona,
  ): void {
    const genome = this.genome;

    // 1. 戰鬥交火向量 (Combat)，支援各分支理想距離比
    let combatX = 0;
    let combatY = 0;
    let enemyDist = 9999;
    if (enemyTarget) {
      const edx = enemyTarget.x - bot.x;
      const edy = enemyTarget.y - bot.y;
      enemyDist = Math.sqrt(edx * edx + edy * edy);
      if (enemyDist > 0.001) {
        const enx = edx / enemyDist;
        const eny = edy / enemyDist;
        const branch = getGenomeBranch(bot.definition.id);
        const distRatio = branch
          ? (genome.engageDistanceRatio[branch] ?? 1.0)
          : 1.0;
        const optDist = getOptimalCombatDistance(bot.definition.id) * distRatio;
        const perpX = -eny * bot.aiStrafeDirection;
        const perpY = enx * bot.aiStrafeDirection;

        let fwd = (enemyDist - optDist) / 100;
        if (fwd > 1) fwd = 1;
        if (fwd < -1) fwd = -1;

        combatX = enx * fwd * 0.75 + perpX * 0.85;
        combatY = eny * fwd * 0.75 + perpY * 0.85;
      }
    }

    // 2. 逃逸後撤向量 (Retreat)
    let retreatX = 0;
    let retreatY = 0;
    if (enemyTarget && enemyDist > 0.001) {
      retreatX = -((enemyTarget.x - bot.x) / enemyDist) * 1.5;
      retreatY = -((enemyTarget.y - bot.y) / enemyDist) * 1.5;
    } else if (
      bot.aiEscapeVx * bot.aiEscapeVx + bot.aiEscapeVy * bot.aiEscapeVy >
      0.001
    ) {
      // 脫離敵人視野後：持續朝向已鎖定的定向逃逸方向奔馳，建立安全緩衝區！
      retreatX = bot.aiEscapeVx * 1.5;
      retreatY = bot.aiEscapeVy * 1.5;
    } else {
      // 無明確逃跑方向時向地圖中心方向撤退尋求開闊地帶庇護
      const cdx = MAP_SIZE * 0.5 - bot.x;
      const cdy = MAP_SIZE * 0.5 - bot.y;
      const cd = Math.sqrt(cdx * cdx + cdy * cdy);
      if (cd > 0.001) {
        retreatX = (cdx / cd) * 1.5;
        retreatY = (cdy / cd) * 1.5;
      }
    }

    // 3. 打怪靠攏向量 (Farm)
    let farmX = 0;
    let farmY = 0;
    if (shapeTarget) {
      const sdx = shapeTarget.x - bot.x;
      const sdy = shapeTarget.y - bot.y;
      const sd = Math.sqrt(sdx * sdx + sdy * sdy);
      if (sd > 0.001) {
        if (sd > SHAPE_SAFE_DISTANCE) {
          farmX = sdx / sd;
          farmY = sdy / sd;
        } else {
          farmX = -(sdx / sd);
          farmY = -(sdy / sd);
        }
      }
    } else {
      const angle =
        (bot.id * 1.7 + Math.floor(bot.aiStateTimer / 100) * 0.8) %
        (Math.PI * 2);
      farmX = Math.cos(angle) * 0.65;
      farmY = Math.sin(angle) * 0.65;
    }

    // 4. 世界地圖邊界排斥向量 (Border，支援小型決鬥沙盒邊界)
    let borderX = 0;
    let borderY = 0;
    const buf = this.arenaBounds ? 150 : BORDER_BUFFER;
    const minX = this.arenaBounds ? this.arenaBounds.minX : 0;
    const maxX = this.arenaBounds ? this.arenaBounds.maxX : MAP_SIZE;
    const minY = this.arenaBounds ? this.arenaBounds.minY : 0;
    const maxY = this.arenaBounds ? this.arenaBounds.maxY : MAP_SIZE;
    if (bot.x < minX + buf) {
      borderX += (minX + buf - bot.x) / buf;
    } else if (bot.x > maxX - buf) {
      borderX -= (bot.x - (maxX - buf)) / buf;
    }
    if (bot.y < minY + buf) {
      borderY += (minY + buf - bot.y) / buf;
    } else if (bot.y > maxY - buf) {
      borderY -= (bot.y - (maxY - buf)) / buf;
    }
    borderX *= 1.6;
    borderY *= 1.6;

    // 5. 計算連續過渡權重 (Continuous Crisis Weight，依基因組曲線與多敵意識)
    const hpStart = genome.retreatCurve.hpStart;
    const slope = genome.retreatCurve.slope;
    let wCrisis = (hpStart - hpRatio) * (slope * 0.35);
    if (wCrisis < 0) wCrisis = 0;
    if (wCrisis > 1) wCrisis = 1;

    // 多敵包夾規避意識加乘
    if (bot.aiNearEnemyCount >= 2 && persona.multiEnemyAwareness > 0) {
      wCrisis = Math.min(1.0, wCrisis + persona.multiEnemyAwareness * 0.35);
    }

    let wCombat = 0;
    let wRetreat = 0;
    let wFarm = 1.0;

    if (bot.aiState === 'retreating') {
      // 殘血逃跑狀態：後撤向量壓倒性主導 (2.2x)，徹底壓制戰鬥逼近與農怪力場！
      wRetreat = AI_RETREAT_FORCE_MULTIPLIER;
      wCombat = 0.0;
      wFarm = 0.0;
    } else if (enemyTarget) {
      const classFov = bot.definition?.fovMultiplier ?? 1.0;
      const threatRadius = this.arenaBounds
        ? 1500
        : PERCEPTION_RADIUS * classFov;
      let dRatio = (threatRadius - enemyDist) / 250;
      if (dRatio < 0) dRatio = 0;
      if (dRatio > 1) dRatio = 1;

      wRetreat = dRatio > 0 ? wCrisis * 1.25 : 0;
      wCombat = dRatio * (1.0 - wCrisis);
      wFarm = (1.0 - wCombat) * (1.0 - wRetreat);
    }

    // 6. 【Phase 4 防呆 3: 防牆角力場抵消死鎖 (Wall-Corner Tangent Sliding - M8 凍結紅線)】
    const bSq = borderX * borderX + borderY * borderY;
    if (bSq > 0.0025 && wRetreat > 0.01) {
      const bLen = Math.sqrt(bSq);
      const bnx = borderX / bLen;
      const bny = borderY / bLen;

      const rSq = retreatX * retreatX + retreatY * retreatY;
      if (rSq > 0.001) {
        const rLen = Math.sqrt(rSq);
        const rnx = retreatX / rLen;
        const rny = retreatY / rLen;

        const dot = rnx * bnx + rny * bny;
        if (dot < -0.5) {
          // 後撤力與邊界排斥力劇烈對立！轉化為沿邊界切線方向滑動
          let tx = -bny;
          let ty = bnx;
          // 依據 AI 當前環繞走位方向決定滑動切線，維持時間連續性杜絕幀間抽搐
          if (bot.aiStrafeDirection < 0) {
            tx = -tx;
            ty = -ty;
          }
          retreatX = tx * rLen;
          retreatY = ty * rLen;
        }
      }
    }

    // 6.5. 【M9: 形狀阻礙逃跑路徑之切線偏轉 (Shape-Obstacle Tangent Escape Deflection)】
    // 當 AI 逃跑 (wRetreat > 0) 且後撤向量正朝向幾何形狀（與避障力場對立 dot < -0.2）時，
    // 將後撤力轉化為沿障礙物切線繞行，杜絕大馬力逃跑迎頭自撞扣血！
    const saSq = shapeAvoidX * shapeAvoidX + shapeAvoidY * shapeAvoidY;
    if (saSq > 0.25 && wRetreat > 0.01) {
      const saLen = Math.sqrt(saSq);
      const sanx = shapeAvoidX / saLen;
      const sany = shapeAvoidY / saLen;

      const rSq = retreatX * retreatX + retreatY * retreatY;
      if (rSq > 0.001) {
        const rLen = Math.sqrt(rSq);
        const rnx = retreatX / rLen;
        const rny = retreatY / rLen;

        const dot = rnx * sanx + rny * sany;
        if (dot < -0.2) {
          let tx = -sany;
          let ty = sanx;
          if (bot.aiStrafeDirection < 0) {
            tx = -tx;
            ty = -ty;
          }
          retreatX = tx * rLen;
          retreatY = ty * rLen;
        }
      }
    }

    // 7. 合成力場並套用可訓練基因組權重與正規化（融入幾何形狀避障排斥力場）
    let mx =
      combatX * wCombat * genome.vectorWeights.combat +
      retreatX * wRetreat * genome.vectorWeights.retreat +
      farmX * wFarm * genome.vectorWeights.farm +
      evadeX * genome.vectorWeights.evade +
      borderX * genome.vectorWeights.border +
      shapeAvoidX * 1.5;
    let my =
      combatY * wCombat * genome.vectorWeights.combat +
      retreatY * wRetreat * genome.vectorWeights.retreat +
      farmY * wFarm * genome.vectorWeights.farm +
      evadeY * genome.vectorWeights.evade +
      borderY * genome.vectorWeights.border +
      shapeAvoidY * 1.5;

    const magSq = mx * mx + my * my;
    if (magSq > 1.0) {
      const invMag = 1.0 / Math.sqrt(magSq);
      mx *= invMag;
      my *= invMag;
    }

    // 8. 向量力場平滑漸變 (EMA Smoothing, 零 GC)，消除單幀 180 度階躍反轉抖動 (Jitter)
    const prevMx = bot.input.moveX;
    const prevMy = bot.input.moveY;
    if (prevMx * prevMx + prevMy * prevMy > 0.001) {
      const blend = 0.65; // 65% 目標力場 + 35% 慣性力場平滑過渡
      bot.input.moveX = prevMx * (1.0 - blend) + mx * blend;
      bot.input.moveY = prevMy * (1.0 - blend) + my * blend;
    } else {
      bot.input.moveX = mx;
      bot.input.moveY = my;
    }
  }

  /**
   * 【Phase 3 & M9: 瞄準與射擊決策】
   */
  private decideAimAndShoot(
    bot: Tank,
    enemyTarget: Tank | null,
    shapeTarget: Shape | null,
    bulletPool: ObjectPool<Bullet>,
    persona: AiPersona,
  ): void {
    // 優先權 A: 【Phase 3 攔截提前量】高威脅巨型重砲彈攔截鎖定（關鍵抵消射擊不套用隨機誤差）
    if (
      bot.aiInterceptTimer > 0 &&
      bot.aiInterceptBulletIdx >= 0 &&
      bot.aiInterceptBulletIdx < bulletPool.capacity &&
      bulletPool.isActive(bot.aiInterceptBulletIdx)
    ) {
      const b = bulletPool.items[bot.aiInterceptBulletIdx];
      // 雙重安全閥：若有敵方坦克目標在場，嚴格僅允許攔截 Destroyer/Annihilator 等巨型重砲彈 (radius >= 18)
      if (!enemyTarget || b.radius >= AI_INTERCEPT_MIN_BULLET_RADIUS) {
        const rx = b.x - bot.x;
        const ry = b.y - bot.y;
        const dist = Math.sqrt(rx * rx + ry * ry);
        const vOwn = Math.max(bot.bulletSpeed, 12.27);
        const vBullet = Math.sqrt(b.vx * b.vx + b.vy * b.vy);
        const tClash = dist / (vOwn + vBullet + 0.001);

        bot.input.aimX = b.x + b.vx * tClash;
        bot.input.aimY = b.y + b.vy * tClash;
        bot.input.shooting = true;
        return;
      }
    }

    // 優先權 B: 殘血撤退時的推進與壓制射擊
    if (bot.aiState === 'retreating') {
      const recoilMode = getRecoilBoostMode(bot.definition.id);
      if (recoilMode === 'rear') {
        // 自帶後向推進砲管職業 (Tri-Angle / Booster / Fighter)：朝逃跑方向瞄準開火，尾部推進砲全速噴射推離戰場
        bot.input.aimX = bot.x + bot.input.moveX * 500;
        bot.input.aimY = bot.y + bot.input.moveY * 500;
        bot.input.shooting = true;
        return;
      }
      if (enemyTarget) {
        // 前向常規職業：朝敵人身位開火，利用主砲後座力額外反衝逃跑，同時壓制追兵
        bot.input.aimX = enemyTarget.x;
        bot.input.aimY = enemyTarget.y;
        bot.input.shooting = true;
        return;
      }
      // 敵人已脫離視野：面向逃跑方向安靜撤退，停止開火（防止前方後座力阻礙逃跑，加速自然回血）
      bot.input.aimX = bot.x + bot.input.moveX * 100;
      bot.input.aimY = bot.y + bot.input.moveY * 100;
      bot.input.shooting = false;
      return;
    }

    // 優先權 C: 戰鬥提前量預測瞄準 (Lead Aiming + 人設提前量折扣 + 穩定 Aim Noise)
    if (enemyTarget) {
      const edx = enemyTarget.x - bot.x;
      const edy = enemyTarget.y - bot.y;
      const dist = Math.sqrt(edx * edx + edy * edy);
      const bSpeed = Math.max(bot.bulletSpeed, 10);
      const tHit = (dist / bSpeed) * persona.leadFactor;

      const predX = enemyTarget.x + enemyTarget.vx * tHit;
      const predY = enemyTarget.y + enemyTarget.vy * tHit;

      if (Math.abs(bot.aiNoiseOffset) > 0.0001) {
        // 加上已穩定抽樣的瞄準偏移（維持幀間角速度平滑限制，杜絕高頻微顫）
        const baseAngle = Math.atan2(predY - bot.y, predX - bot.x);
        const noisyAngle = baseAngle + bot.aiNoiseOffset;
        bot.input.aimX = bot.x + Math.cos(noisyAngle) * dist;
        bot.input.aimY = bot.y + Math.sin(noisyAngle) * dist;
      } else {
        bot.input.aimX = predX;
        bot.input.aimY = predY;
      }
      bot.input.shooting = true;
      return;
    }

    // 優先權 D: 農怪瞄準
    if (shapeTarget) {
      bot.input.aimX = shapeTarget.x;
      bot.input.aimY = shapeTarget.y;
      bot.input.shooting = true;
      return;
    }

    // 優先權 E: 平時巡航或非戰鬥後座力趕路 (Recoil Boosting)
    const isMoving =
      bot.input.moveX * bot.input.moveX + bot.input.moveY * bot.input.moveY >
      0.01;
    if (isMoving && bot.aiRecoilBoost) {
      const mode = getRecoilBoostMode(bot.definition.id);
      if (mode === 'rear') {
        // 自帶背向砲管 (Tri-Angle / Booster / Fighter)，朝前進方向瞄準射擊，後砲直接推進
        bot.input.aimX = bot.x + bot.input.moveX * 100;
        bot.input.aimY = bot.y + bot.input.moveY * 100;
        bot.input.shooting = true;
        return;
      }
      if (mode === 'backfire' && bot.aiNearEnemyCount === 0) {
        // 高後座力職業且確認近身無敵方威脅時，轉向背後推進（狙擊系嚴禁）
        bot.input.aimX = bot.x - bot.input.moveX * 100;
        bot.input.aimY = bot.y - bot.input.moveY * 100;
        bot.input.shooting = true;
        return;
      }
    }

    bot.input.aimX = bot.x + bot.input.moveX * 100;
    bot.input.aimY = bot.y + bot.input.moveY * 100;
    bot.input.shooting = false;
  }

  // --- 輔助查詢純函式 (熱路徑零配置，含目標慣性效用加成與殘血勸架權重) ---

  private findNearestEnemyTank(
    self: Tank,
    allTanks: Tank[],
    maxRadius: number,
    persona: AiPersona,
  ): Tank | null {
    let bestTank: Tank | null = null;
    let minDistSq = maxRadius * maxRadius;
    const len = allTanks.length;
    const stickiness = this.genome.targetSwitch.stickiness;
    const stickinessSq = stickiness * stickiness;
    let nearCount = 0;
    const nearDistSq = 450 * 450;

    for (let i = 0; i < len; i++) {
      const other = allTanks[i];
      if (
        !other.active ||
        other.id === self.id ||
        (this.ignorePlayer && !other.isAi)
      ) {
        continue;
      }

      const dx = other.x - self.x;
      const dy = other.y - self.y;
      const rawDistSq = dx * dx + dy * dy;
      if (rawDistSq < nearDistSq) {
        nearCount++;
      }
      if (rawDistSq > maxRadius * maxRadius) {
        continue;
      }

      let d2 = rawDistSq;

      // 殘血勸架 (Third-partying) 傾向：偏好鎖定生命比例低的目標
      if (persona.thirdPartyBias > 0) {
        const hpRatio = other.hp / other.maxHp;
        // hp越低，有效評估距離平方越短（最高折減 50% * thirdPartyBias）
        d2 *= 1.0 - (1.0 - hpRatio) * 0.5 * persona.thirdPartyBias;
      }

      // 【Phase 4: 效用慣性】：若為當前已鎖定目標，享有距離平方折扣，消除乒乓換鎖
      if (other.id === self.aiTargetId) {
        d2 /= stickinessSq;
      }

      if (d2 < minDistSq) {
        minDistSq = d2;
        bestTank = other;
      }
    }

    self.aiNearEnemyCount = nearCount;
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
    const stickiness = this.genome.targetSwitch.stickiness;
    const stickinessSq = stickiness * stickiness;

    this._shapeAvoidX = 0;
    this._shapeAvoidY = 0;

    // 計算坦克當前速度與前進單位向量，供速度前瞻與切線繞行計算
    const speed = Math.sqrt(self.vx * self.vx + self.vy * self.vy);
    const hasSpeed = speed > 0.05;
    const fvx = hasSpeed ? self.vx / speed : 0;
    const fvy = hasSpeed ? self.vy / speed : 0;

    for (let i = 0; i < len; i++) {
      const shape = shapes[i];
      if (!shape.active) continue;

      const dx = shape.x - self.x;
      const dy = shape.y - self.y;
      const rawDistSq = dx * dx + dy * dy;

      // --- 幾何形狀主動避障排斥力場計算 ---
      // 依據坦克速度進行動態前瞻 (Lookahead)，並在朝向障礙衝刺時注入側向切線繞行力 (Tangent Steering)
      let lookahead = 0;
      let dotForward = 0;
      if (hasSpeed) {
        const rawDist = Math.sqrt(rawDistSq);
        if (rawDist > 0.001) {
          dotForward = (self.vx * dx + self.vy * dy) / (speed * rawDist);
          if (dotForward > 0.1) {
            lookahead = dotForward * speed * AI_SHAPE_LOOKAHEAD_TICKS;
          }
        }
      }

      const totalAvoidDist = AI_SHAPE_AVOID_DISTANCE + lookahead;
      const avoidDist = self.radius + shape.radius + totalAvoidDist;
      if (rawDistSq < avoidDist * avoidDist) {
        const dist = Math.sqrt(rawDistSq);
        if (dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          const clearance = dist - (self.radius + shape.radius);
          const ratio = Math.max(
            0,
            (totalAvoidDist - clearance) / totalAvoidDist,
          );

          // 1. 放射狀反向排斥力 (Radial Repulsion)
          const radialForce = ratio * ratio * AI_SHAPE_AVOID_FORCE;
          this._shapeAvoidX -= nx * radialForce;
          this._shapeAvoidY -= ny * radialForce;

          // 2. 側向切線繞行偏轉力 (Lateral Tangent Steering)
          // 當坦克正朝障礙物快速靠近 (dotForward > 0.1) 時，計算切線向量繞開，杜絕迎頭相撞
          if (hasSpeed && dotForward > 0.1) {
            const cross = fvx * -ny + fvy * nx;
            const sign =
              cross !== 0 ? (cross > 0 ? 1 : -1) : self.aiStrafeDirection;
            const tx = -ny * sign;
            const ty = nx * sign;
            const tangentForce = ratio * dotForward * AI_SHAPE_TANGENT_FORCE;
            this._shapeAvoidX += tx * tangentForce;
            this._shapeAvoidY += ty * tangentForce;
          }
        }
      }

      if (rawDistSq > maxRadius * maxRadius) {
        continue;
      }

      let d2 = rawDistSq;
      // 【Phase 4: 效用慣性】：當前鎖定之形狀享有慣性折扣
      if (shape.id === self.aiTargetShapeId) {
        d2 /= stickinessSq;
      }

      if (d2 < minDistSq) {
        minDistSq = d2;
        bestShape = shape;
      }
    }

    // 避障力場幅度上限保護 (最大 4.0)，杜絕密集形狀堆疊導致數值爆表
    const avoidMagSq =
      this._shapeAvoidX * this._shapeAvoidX +
      this._shapeAvoidY * this._shapeAvoidY;
    if (avoidMagSq > 16.0) {
      const inv = 4.0 / Math.sqrt(avoidMagSq);
      this._shapeAvoidX *= inv;
      this._shapeAvoidY *= inv;
    }

    return bestShape;
  }
}
