/**
 * 原版 diep.io 等級分數查表與技能點規則
 * 來源：https://diepio.fandom.com/wiki/Levels 與 https://diepio.fandom.com/wiki/Score
 */

export const MAX_LEVEL = 45;

/**
 * 達到各等級（Lv 1 ~ Lv 45）所需之累積分數查表
 * 索引 0 為 Lv 1 (0 分)，索引 44 為 Lv 45 (23536 分)
 * 來源：https://diepio.fandom.com/wiki/Score
 */
export const SCORE_FOR_LEVEL: readonly number[] = [
  0, // Lv 1
  4, // Lv 2
  13, // Lv 3
  28, // Lv 4
  50, // Lv 5
  78, // Lv 6
  113, // Lv 7
  157, // Lv 8
  211, // Lv 9
  275, // Lv 10
  350, // Lv 11
  437, // Lv 12
  538, // Lv 13
  655, // Lv 14
  787, // Lv 15 (Tier 2 轉職門檻)
  948, // Lv 16
  1109, // Lv 17
  1301, // Lv 18
  1516, // Lv 19
  1767, // Lv 20
  2026, // Lv 21
  2325, // Lv 22
  2647, // Lv 23
  3035, // Lv 24
  3433, // Lv 25
  3883, // Lv 26
  4379, // Lv 27
  4925, // Lv 28
  5525, // Lv 29
  6184, // Lv 30 (Tier 3 轉職門檻)
  6907, // Lv 31
  7698, // Lv 32
  8537, // Lv 33
  9426, // Lv 34
  10368, // Lv 35
  11367, // Lv 36
  12426, // Lv 37
  13549, // Lv 38
  14739, // Lv 39
  16000, // Lv 40
  17337, // Lv 41
  18754, // Lv 42
  20256, // Lv 43
  21849, // Lv 44
  23536, // Lv 45 (Tier 4 終極轉職/滿級門檻)
];

/**
 * 依據當前累積分數計算對應等級（二分搜尋，零配置）
 * @param score 當前累積分數
 * @returns 1 ~ 45 等級（超過 23536 分仍封頂於 Lv 45）
 */
export function levelForScore(score: number): number {
  if (score <= 0) return 1;
  if (score >= SCORE_FOR_LEVEL[MAX_LEVEL - 1]) return MAX_LEVEL;

  let low = 0;
  let high = MAX_LEVEL - 1;
  let ans = 0;

  while (low <= high) {
    const mid = (low + high) >> 1;
    if (SCORE_FOR_LEVEL[mid] <= score) {
      ans = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return ans + 1;
}

/**
 * 依據等級計算累計應獲得之技能點數
 * 規則：Lv 2 ~ Lv 28 每級 +1 點（累計 27 點）；之後每 3 級 (Lv 30, 33, 36, 39, 42, 45) 各 +1 點（Lv 45 共 33 點）
 * @param level 當前等級 (1 ~ 45)
 */
export function pointsForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level <= 28) return level - 1;
  let pts = 27;
  if (level >= 30) pts++;
  if (level >= 33) pts++;
  if (level >= 36) pts++;
  if (level >= 39) pts++;
  if (level >= 42) pts++;
  if (level >= 45) pts++;
  return pts;
}
