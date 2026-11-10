/**
 * HUD 介面所有文字字串與色彩集中常數
 * 遵循 All-in-Canvas UI 規範，統一在此定義
 */

export const STAT_NAMES: readonly string[] = [
  'Health Regen',
  'Max Health',
  'Body Damage',
  'Bullet Speed',
  'Bullet Penetration',
  'Bullet Damage',
  'Reload',
  'Movement Speed',
] as const;

export const STAT_SHORTCUTS: readonly string[] = [
  '[1]',
  '[2]',
  '[3]',
  '[4]',
  '[5]',
  '[6]',
  '[7]',
  '[8]',
] as const;

/**
 * 原版 diep.io 8 項屬性對應色彩
 */
export const STAT_COLORS: readonly number[] = [
  0xeaa97a, // 1. Health Regen (桃橘色)
  0xea66db, // 2. Max Health (粉紫色)
  0x9366ea, // 3. Body Damage (紫色)
  0x6685ea, // 4. Bullet Speed (藍色)
  0xead466, // 5. Bullet Penetration (黃色)
  0xea6666, // 6. Bullet Damage (紅色)
  0x89ea66, // 7. Reload (萊姆綠)
  0x66eae7, // 8. Movement Speed (青藍色)
] as const;

// 常用 UI 配色
export const UI_COLOR_PANEL_BG = 0x000000;
export const UI_PANEL_ALPHA = 0.35;
export const UI_COLOR_SEGMENT_EMPTY = 0x444444;
export const UI_COLOR_SEGMENT_BORDER = 0x111111;
export const UI_COLOR_PLUS_BTN = 0x228833;
export const UI_COLOR_PLUS_BTN_HOVER = 0x2ec249;
export const UI_COLOR_TEXT_WHITE = 0xffffff;
export const UI_COLOR_TEXT_YELLOW = 0xffe869;

// 血條色彩
export const HEALTH_BAR_BG_COLOR = 0x333333;
export const HEALTH_BAR_FG_COLOR = 0x85e37d;
export const HEALTH_BAR_BORDER_COLOR = 0x1a1a1a;

// 小地圖色彩
export const MINIMAP_BG_COLOR = 0x000000;
export const MINIMAP_BG_ALPHA = 0.25;
export const MINIMAP_BORDER_COLOR = 0x555555;
export const MINIMAP_VIEWPORT_COLOR = 0xffffff;
export const MINIMAP_PLAYER_COLOR = 0x00b2e1;
