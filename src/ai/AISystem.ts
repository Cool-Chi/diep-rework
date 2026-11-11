import {
  AI_BORDER_BUFFER,
  AI_BULLET_SCAN_RADIUS,
  AI_INTERCEPT_LOCK_TICKS,
  AI_INTERCEPT_MAX_ANGLE,
  AI_MAX_CPA_TICKS,
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

      // 3. 【Phase 3: CPA 來襲威脅預判與高威脅子彈鎖定 (M8 凍結紅線保留)】
      let evadeX = 0;
      let evadeY = 0;
      const bestThreatBulletIdx = this.scanBulletThreats(
        bot,
        bulletPool,
        (ex, ey) => {
          evadeX += ex;
          evadeY += ey;
        },
      );

      // 若未處於鎖定中且偵測到高威脅子彈，觸發 4 ticks (AI_INTERCEPT_LOCK_TICKS) 防抖鎖定
      if (bestThreatBulletIdx !== -1 && bot.aiInterceptTimer <= 0) {
        bot.aiInterceptBulletIdx = bestThreatBulletIdx;
        bot.aiInterceptTimer = AI_INTERCEPT_LOCK_TICKS;
      }

      // 4. 【Phase 4 & M9: 效用慣性目標選取、殘血勸架權重與多敵包夾統計】
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

      // 5. 狀態標記推進（支援多敵包夾提前後撤意識）
      const hpRatio = bot.hp / bot.maxHp;
      const isCornered =
        bot.aiNearEnemyCount >= 2 && persona.multiEnemyAwareness >= 0.5;

      if ((hpRatio < 0.35 || isCornered) && enemyTarget) {
        bot.aiState = 'retreating';
      } else if (enemyTarget) {
        bot.aiState = 'engaging';
      } else {
        bot.aiState = 'farming';
      }

      // 6. 【Phase 4 & M9: 5 股力場向量混合、基因組權重與牆角防死鎖滑動】
      this.blendSteeringVectors(
        bot,
        enemyTarget,
        shapeTarget,
        evadeX,
        evadeY,
        hpRatio,
        persona,
      );

      // 7. 【Phase 3 & M9: 瞄準與射擊決策（攔截提前量 + 提前量預判 + 後座力趕路）】
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
   * @returns 最高威脅子彈索引（若無高威脅則回傳 -1）
   */
  private scanBulletThreats(
    bot: Tank,
    bulletPool: ObjectPool<Bullet>,
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
        // 進入預測碰撞走廊！計算垂直側移避難向量
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
        // 側向/身後流彈一律純靠身法 (onEvadeForce) 走位閃避，堅決不轉動砲管去搶瞄！
        const aimAngleToBullet = Math.atan2(ry, rx);
        let angleDiff = aimAngleToBullet - bot.rotation;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

        if (Math.abs(angleDiff) <= AI_INTERCEPT_MAX_ANGLE && tCpa <= 20) {
          // 【Phase 3 防呆 2: 威脅門檻評估】
          const isHeavy = bullet.radius >= 14 || bullet.hp >= 8;
          const isLethal =
            bullet.damage >= bot.hp * 0.35 || bot.hp / bot.maxHp < 0.4;
          const isSniper =
            bullet.damage >= 10 &&
            bullet.vx * bullet.vx + bullet.vy * bullet.vy >= 14 * 14;

          if (isHeavy || isLethal || isSniper) {
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
      retreatX = -((enemyTarget.x - bot.x) / enemyDist) * 1.3;
      retreatY = -((enemyTarget.y - bot.y) / enemyDist) * 1.3;
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

    if (enemyTarget) {
      const classFov = bot.definition?.fovMultiplier ?? 1.0;
      const threatRadius = this.arenaBounds
        ? 1500
        : (bot.aiState === 'retreating'
            ? THREAT_ESCAPE_RADIUS
            : PERCEPTION_RADIUS) * classFov;
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

    // 7. 合成力場並套用可訓練基因組權重與正規化
    let mx =
      combatX * wCombat * genome.vectorWeights.combat +
      retreatX * wRetreat * genome.vectorWeights.retreat +
      farmX * wFarm * genome.vectorWeights.farm +
      evadeX * genome.vectorWeights.evade +
      borderX * genome.vectorWeights.border;
    let my =
      combatY * wCombat * genome.vectorWeights.combat +
      retreatY * wRetreat * genome.vectorWeights.retreat +
      farmY * wFarm * genome.vectorWeights.farm +
      evadeY * genome.vectorWeights.evade +
      borderY * genome.vectorWeights.border;

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
    // 優先權 A: 【Phase 3 攔截提前量】高威脅子彈攔截鎖定（關鍵抵消射擊不套用隨機誤差）
    if (
      bot.aiInterceptTimer > 0 &&
      bot.aiInterceptBulletIdx >= 0 &&
      bot.aiInterceptBulletIdx < bulletPool.capacity &&
      bulletPool.isActive(bot.aiInterceptBulletIdx)
    ) {
      const b = bulletPool.items[bot.aiInterceptBulletIdx];
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

    // 優先權 B: 殘血撤退時的後座力火箭反衝加速
    if (bot.aiState === 'retreating' && enemyTarget) {
      bot.input.aimX = enemyTarget.x;
      bot.input.aimY = enemyTarget.y;
      bot.input.shooting = true;
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

    for (let i = 0; i < len; i++) {
      const shape = shapes[i];
      if (!shape.active) continue;

      const dx = shape.x - self.x;
      const dy = shape.y - self.y;
      const rawDistSq = dx * dx + dy * dy;
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

    return bestShape;
  }
}
