/**
 * 原版 diep.io 屬性純函式計算公式
 * 來源：https://diepio.fandom.com/wiki/Stats
 */

/**
 * 計算坦克最大生命值
 * 公式：50 + 2 * (level - 1) + 20 * p
 * @param level 當前坦克等級 (1 ~ 45)
 * @param p 最大生命加點數 (0 ~ 7)
 */
export function getMaxHealth(level: number, p: number): number {
  return 50 + 2 * (level - 1) + 20 * p;
}

/**
 * 計算撞擊傷害（每 tick 接觸一次）
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
 * 公式：2 + 1.5 * p
 * @param p 子彈穿透加點數 (0 ~ 7)
 */
export function getBulletPenetration(p: number): number {
  return 2 + 1.5 * p;
}

/**
 * 計算子彈命中殺傷力（每次命中單發扣血）
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
 * 公式：15 - p ticks/發（SIM_TICK_RATE = 25 下，p=0 為 0.6 秒，p=7 為 0.32 秒）
 * @param p 裝填速度加點數 (0 ~ 7)
 */
export function getReloadTicks(p: number): number {
  return Math.max(1, 15 - p);
}
