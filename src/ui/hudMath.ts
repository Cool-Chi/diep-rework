import { WORLD_HEIGHT, WORLD_WIDTH } from '../config/constants';
import { MAX_LEVEL, SCORE_FOR_LEVEL } from '../config/levels.config';

/**
 * 計算當前等級到下一等級的分數進度百分比 (0.0 ~ 1.0)
 * 規則：
 * - Lv 30 (滿級) 固定回傳 1.0 (滿格)
 * - 當 score 剛好等於本級門檻時為 0.0
 * - 當 score 接近下一級門檻時逼近 1.0
 * @param level 當前等級 (1 ~ 30)
 * @param score 當前累積分數
 */
export function scoreProgress(level: number, score: number): number {
  if (level >= MAX_LEVEL) {
    return 1.0;
  }

  const currentLevelThreshold = SCORE_FOR_LEVEL[level - 1] ?? 0;
  const nextLevelThreshold =
    SCORE_FOR_LEVEL[level] ?? currentLevelThreshold + 1;
  const span = nextLevelThreshold - currentLevelThreshold;

  if (span <= 0) {
    return 1.0;
  }

  const progress = (score - currentLevelThreshold) / span;
  return Math.max(0, Math.min(1, progress));
}

/**
 * 將世界座標轉換為小地圖局部座標 (0 ~ mapSize)
 * @param worldX 世界 X 座標
 * @param worldY 世界 Y 座標
 * @param mapSize 小地圖尺寸 (像素)
 * @param worldWidth 世界總寬度 (預設 WORLD_WIDTH)
 * @param worldHeight 世界總高度 (預設 WORLD_HEIGHT)
 */
export function worldToMinimap(
  worldX: number,
  worldY: number,
  mapSize: number,
  worldWidth = WORLD_WIDTH,
  worldHeight = WORLD_HEIGHT,
): { x: number; y: number } {
  const normX = Math.max(0, Math.min(1, worldX / worldWidth));
  const normY = Math.max(0, Math.min(1, worldY / worldHeight));
  return {
    x: normX * mapSize,
    y: normY * mapSize,
  };
}

/**
 * 將小地圖局部座標 (0 ~ mapSize) 轉換為世界座標
 * @param localX 小地圖內部 X 座標 (0 ~ mapSize)
 * @param localY 小地圖內部 Y 座標 (0 ~ mapSize)
 * @param mapSize 小地圖尺寸 (像素)
 * @param worldWidth 世界總寬度 (預設 WORLD_WIDTH)
 * @param worldHeight 世界總高度 (預設 WORLD_HEIGHT)
 */
export function minimapToWorld(
  localX: number,
  localY: number,
  mapSize: number,
  worldWidth = WORLD_WIDTH,
  worldHeight = WORLD_HEIGHT,
): { x: number; y: number } {
  const normX = Math.max(0, Math.min(1, localX / mapSize));
  const normY = Math.max(0, Math.min(1, localY / mapSize));
  return {
    x: normX * worldWidth,
    y: normY * worldHeight,
  };
}

/**
 * 判斷實體是否滿足血條顯示條件
 * 規則：僅在生命受到傷害後 (hp < maxHp) 且生命值大於 0 時顯示
 * @param hp 當前生命
 * @param maxHp 最大生命
 */
export function shouldShowHealthBar(hp: number, maxHp: number): boolean {
  return hp > 0 && hp < maxHp;
}

/**
 * 依據螢幕尺寸計算 UI 縮放係數
 * 基準高度 1080p，係數限制在 [0.75, 1.5] 範圍內
 * @param width 螢幕寬度
 * @param height 螢幕高度
 * @param baselineHeight 基準設計高度 (預設 1080)
 */
export function uiScale(
  _width: number,
  height: number,
  baselineHeight = 1080,
): number {
  const raw = height / baselineHeight;
  return Math.max(0.75, Math.min(1.5, raw));
}
