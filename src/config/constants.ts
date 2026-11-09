/**
 * diep-rework 全域常數設定
 * 所有數值以原版 diep.io 為準；查無原版公開公式之手感參數均標註 TODO(tune)。
 */

// ==========================================
// 1. 模擬時鐘單一真值
// ==========================================

/**
 * 固定步長模擬頻率（TPS，每秒 tick 數）
 * 原版 diep.io 單一標準時鐘：25 ticks/秒 (1 tick = 0.04 秒)
 * 來源：https://diepio.fandom.com/wiki/Stats
 * 禁止在程式碼中硬編碼 0.04，所有 tick 換算皆由此常數推導。
 */
export const SIM_TICK_RATE = 25;

/** 每個模擬 tick 的物理時間步長（秒） */
export const SIM_TICK_TIME = 1 / SIM_TICK_RATE;

/** 每幀最多追趕 tick 數，超過即丟棄時間，避免切換分頁後螺旋式追趕 */
export const MAX_CATCHUP_TICKS = 5;

// ==========================================
// 2. 世界尺度與邊界基準
// ==========================================

/**
 * 1 背景網格寬度（世界單位）
 * 原版標準：1 Grid Square = 25 單位
 * 來源：https://diepio.fandom.com/wiki/Levels
 */
export const GRID_SIZE = 25;

/** 世界地圖寬度（世界單位，4000x4000 封閉地圖） */
export const WORLD_WIDTH = 4000;

/** 世界地圖高度（世界單位，4000x4000 封閉地圖） */
export const WORLD_HEIGHT = 4000;

/**
 * Lv 1 基礎坦克半徑（世界單位）
 * 原版標準：Lv 1 坦克直徑 50 單位（半徑 25 單位 = 1 個網格寬）
 * 來源：https://diepio.fandom.com/wiki/Levels
 */
export const BASE_TANK_RADIUS = 25;

/**
 * 基本坦克砲管長度與寬度（世界單位）
 */
export const BASE_BARREL_LENGTH = 35;
export const BASE_BARREL_WIDTH = 18;

// ==========================================
// 3. 視圖與相機
// ==========================================

/**
 * 相機基礎像素縮放基準（不放大世界座標，由相機統一縮放畫面）
 * 1.0 表示 1 世界單位 = 1 螢幕像素（在 devicePixelRatio 經 autoDensity 處理後）
 */
export const CAMERA_BASE_SCALE = 1.0;

/**
 * 相機平滑插值係數 k (用於 1 - exp(-k * dt) 與幀率無關的平滑跟隨)
 * TODO(tune): 依跟隨手感調整，值越大相機越貼身，值越小越有遲滯飄浮感
 */
export const CAMERA_SMOOTH_K = 12.0;

// ==========================================
// 4. 運動物理與阻尼（含極速推導）
// ==========================================

/**
 * 每 tick 坦克移動加速度（世界單位 / tick^2）
 * TODO(tune): 原版未公開底層加速度，依手感調校
 */
export const TANK_MOVE_ACCEL = 0.95;

/**
 * 每 tick 速度阻尼乘數 (0 < DAMPING < 1)
 * TODO(tune): 每 tick 更新公式：v_{t+1} = (v_t + a) * DAMPING
 */
export const TANK_DAMPING = 0.85;

/**
 * 撞牆反彈係數 (0 ~ 1)
 * TODO(tune): 撞擊邊界時反轉並衰減的速度比例
 */
export const WALL_BOUNCE_FACTOR = 0.2;

/**
 * 【Lv 1 基礎坦克極速推導】：
 * 每 tick 運動方程：v_{t+1} = (v_t + a) * d
 * 在終端極速（穩態 v_{t+1} = v_t = v_max）下：
 *   v_max = (v_max + a) * d
 *   v_max * (1 - d) = a * d
 *   v_max = (a * d) / (1 - d)
 * 代入 TANK_MOVE_ACCEL (0.95) 與 TANK_DAMPING (0.85)：
 *   v_max = (0.95 * 0.85) / (1 - 0.85) = 0.8075 / 0.15 = 5.3833 世界單位 / tick
 * 換算為真實世界速度：
 *   5.3833 單位/tick * 25 tick/秒 = 134.58 單位/秒（約 5.38 格/秒）
 */
export const LV1_TERMINAL_SPEED =
  (TANK_MOVE_ACCEL * TANK_DAMPING) / (1 - TANK_DAMPING);

// ==========================================
// 5. 視覺色彩常數（diep.io 經典風格）
// ==========================================

export const COLOR_GRID_BACKGROUND = 0xcdcdcd; // 網格底色（淡灰）
export const COLOR_GRID_LINES = 0xc4c4c4; // 網格線條色
export const COLOR_OUT_OF_BOUNDS = 0xb5b5b5; // 邊界外底色（深灰）
export const COLOR_BORDER_LINE = 0x222222; // 邊界線條色
export const COLOR_TANK_BLUE = 0x00b2e1; // 玩家藍色本體
export const COLOR_BARREL_GRAY = 0x999999; // 砲管灰色
export const COLOR_STROKE = 0x555555; // 黑色/深灰輪廓線
export const STROKE_WIDTH = 3.5; // 輪廓線寬度
