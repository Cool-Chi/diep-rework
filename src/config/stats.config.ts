import {
  BASE_BULLET_SPEED,
  BULLET_SPEED_PER_POINT,
  HYPER_REGEN_PERCENT_PER_SEC,
  MOVE_SPEED_LEVEL_PENALTY,
  MOVE_SPEED_PER_POINT,
  SIM_TICK_RATE,
} from './constants';

/**
 * 原版 diep.io 屬性純函式計算公式
 * 來源：https://diepio.fandom.com/wiki/Stats
 */

// ==========================================
// 8 項屬性固定索引 (對應 Digit1 ~ Digit8 鍵)
// ==========================================
export const STAT_HEALTH_REGEN = 0; // 1. 生命恢復
export const STAT_MAX_HEALTH = 1; // 2. 最大生命
export const STAT_BODY_DAMAGE = 2; // 3. 撞擊傷害
export const STAT_BULLET_SPEED = 3; // 4. 子彈速度
export const STAT_BULLET_PENETRATION = 4; // 5. 子彈穿透 (子彈生命)
export const STAT_BULLET_DAMAGE = 5; // 6. 子彈傷害
export const STAT_RELOAD = 6; // 7. 裝填速度
export const STAT_MOVEMENT_SPEED = 7; // 8. 移動速度

export const TOTAL_STATS = 8;
export const MAX_STAT_POINTS = 7; // 單項屬性加點上限

/**
 * 計算等級對坦克尺寸及子彈尺寸的放大倍率
 * 來源：https://diepio.fandom.com/wiki/Levels
 * 原文："The size of the player's tank and its ammunition size will increase by 1% per level above Level 1."
 * 公式：1.01^(level - 1)
 * @param level 當前等級 (1 ~ 30)
 */
export function sizeFactor(level: number): number {
  if (level <= 1) return 1.0;
  return 1.01 ** (level - 1);
}

/**
 * 計算每 tick 生命恢復量
 * 來源：https://diepio.fandom.com/wiki/Stats 與 https://diepio.fandom.com/wiki/Health_Regen
 * 原文公式：每秒基礎回復量 = MaxHealth * (0.03 + 0.12 * p) / 30
 * 加速回復 (Hyper Regen)：持續 30 秒未受傷後觸發，每秒額外回復 HYPER_REGEN_PERCENT_PER_SEC
 * @param maxHp 最大生命值
 * @param p 生命恢復加點 (0 ~ 7)
 * @param isHyper 是否處於加速回復狀態
 */
export function getHealthRegenPerTick(
  maxHp: number,
  p: number,
  isHyper = false,
): number {
  const baseRegenPerSec = (maxHp * (0.03 + 0.12 * p)) / 30;
  const hyperRegenPerSec = isHyper ? maxHp * HYPER_REGEN_PERCENT_PER_SEC : 0;
  return (baseRegenPerSec + hyperRegenPerSec) / SIM_TICK_RATE;
}

/**
 * 計算坦克最大生命值
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 公式：50 + 2 * (level - 1) + 20 * p
 * @param level 當前坦克等級 (1 ~ 45)
 * @param p 最大生命加點數 (0 ~ 7)
 */
export function getMaxHealth(level: number, p: number): number {
  return 50 + 2 * (level - 1) + 20 * p;
}

/**
 * 計算撞擊傷害（每 tick 接觸一次）
 * 來源：https://diepio.fandom.com/wiki/Stats
 * - 對形狀：(p + 5) * 4
 * - 對坦克：(p + 5) * 6
 * - 對子彈/投射物：p + 5
 * @param p 撞擊傷害加點數 (0 ~ 7)
 * @param targetType 目標類型
 */
export function getBodyDamage(
  p: number,
  targetType: 'shape' | 'tank' | 'bullet',
): number {
  const base = p + 5;
  switch (targetType) {
    case 'shape':
      return base * 4;
    case 'tank':
      return base * 6;
    case 'bullet':
      return base;
  }
}

/**
 * 計算子彈穿透力（即子彈生命值）
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 公式：2 + 1.5 * p
 * @param p 子彈穿透加點數 (0 ~ 7)
 */
export function getBulletPenetration(p: number): number {
  return 2 + 1.5 * p;
}

/**
 * 計算子彈命中殺傷力（每次命中單發扣血）
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 公式：7 + 3 * p（對子彈/陷阱目標時傷害 x 0.25）
 * @param p 子彈傷害加點數 (0 ~ 7)
 * @param isSubTarget 是否為子彈/陷阱等次級目標
 */
export function getBulletDamage(p: number, isSubTarget = false): number {
  const base = 7 + 3 * p;
  return isSubTarget ? base * 0.25 : base;
}

/**
 * 計算發射裝填冷卻（模擬 tick 數）
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 公式：15 - p ticks/發（SIM_TICK_RATE = 25 下，p=0 為 0.6 秒，p=7 為 0.32 秒）
 * @param p 裝填速度加點數 (0 ~ 7)
 */
export function getReloadTicks(p: number): number {
  return Math.max(1, 15 - p);
}

/**
 * 計算子彈速度（世界單位 / tick）
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 公式：BASE_BULLET_SPEED + p * BULLET_SPEED_PER_POINT
 * @param p 子彈速度加點數 (0 ~ 7)
 */
export function getBulletSpeed(p: number): number {
  return BASE_BULLET_SPEED + p * BULLET_SPEED_PER_POINT;
}

/**
 * 計算移動加速度縮放倍率
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 原文："Movement speed is passively lowered as your tank levels up. A Level 1 tank is significantly faster than a Level 45 tank."
 * 公式：(1 + p * MOVE_SPEED_PER_POINT) / (sizeFactor(level) ^ MOVE_SPEED_LEVEL_PENALTY)
 * @param level 當前等級 (1 ~ 30)
 * @param p 移動速度加點數 (0 ~ 7)
 */
export function getMovementSpeedMultiplier(level: number, p: number): number {
  const penalty = sizeFactor(level) ** MOVE_SPEED_LEVEL_PENALTY;
  return (1 + p * MOVE_SPEED_PER_POINT) / penalty;
}
