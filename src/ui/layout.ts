import { uiScale } from './hudMath';

export interface PanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface HudLayout {
  scale: number;
  statPanel: PanelBounds & { visible: boolean };
  scoreBar: PanelBounds;
  miniMap: PanelBounds;
}

// 基準設計尺寸 (在 1080p 且 scale = 1.0 下的邏輯像素)
export const BASE_STAT_PANEL_WIDTH = 210;
export const BASE_STAT_PANEL_HEIGHT = 224;
export const BASE_SCORE_BAR_WIDTH = 360;
export const BASE_SCORE_BAR_HEIGHT = 22;
export const BASE_MINIMAP_SIZE = 140;
export const BASE_MARGIN = 16;

/**
 * 依據視窗螢幕尺寸與點數狀態計算所有 HUD 元件的排版位置
 * 純函式，可供測試與每幀/Resize 複用
 * @param screenWidth 螢幕總寬度 (像素)
 * @param screenHeight 螢幕總高度 (像素)
 * @param hasStatPoints 當前是否有未花費點數
 */
export function computeHudLayout(
  screenWidth: number,
  screenHeight: number,
  hasStatPoints: boolean,
): HudLayout {
  const scale = uiScale(screenWidth, screenHeight);
  const margin = BASE_MARGIN * scale;

  // 1. 屬性面板 (左下角)
  const statW = BASE_STAT_PANEL_WIDTH * scale;
  const statH = BASE_STAT_PANEL_HEIGHT * scale;
  const statX = margin;
  const statY = screenHeight - statH - margin;

  // 2. 分數列 (底部置中)
  const scoreW = BASE_SCORE_BAR_WIDTH * scale;
  const scoreH = BASE_SCORE_BAR_HEIGHT * scale;
  const scoreX = (screenWidth - scoreW) * 0.5;
  const scoreY = screenHeight - scoreH - margin;

  // 3. 小地圖 (右下角)
  const mapSize = BASE_MINIMAP_SIZE * scale;
  const mapX = screenWidth - mapSize - margin;
  const mapY = screenHeight - mapSize - margin;

  return {
    scale,
    statPanel: {
      x: statX,
      y: statY,
      width: statW,
      height: statH,
      visible: hasStatPoints,
    },
    scoreBar: {
      x: scoreX,
      y: scoreY,
      width: scoreW,
      height: scoreH,
    },
    miniMap: {
      x: mapX,
      y: mapY,
      width: mapSize,
      height: mapSize,
    },
  };
}
