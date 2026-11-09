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

/** 基本坦克砲管長度與寬度（世界單位） */
export const BASE_BARREL_LENGTH = 35;
export const BASE_BARREL_WIDTH = 18;

// ==========================================
// 3. 視圖與相機
// ==========================================

export const CAMERA_BASE_SCALE = 1.0;

/**
 * 相機平滑插值係數 k (用於 1 - exp(-k * dt) 與幀率無關的平滑跟隨)
 * TODO(tune): 未查證，依跟隨手感調整
 */
export const CAMERA_SMOOTH_K = 12.0;

// ==========================================
// 4. 運動物理與阻尼（含極速推導）
// ==========================================

/**
 * 每 tick 坦克移動加速度（世界單位 / tick^2）
 * TODO(tune): 未查證（原版未公開底層加速度）
 */
export const TANK_MOVE_ACCEL = 0.95;

/**
 * 每 tick 速度阻尼乘數 (0 < DAMPING < 1)
 * TODO(tune): 未查證，每 tick 更新公式：v_{t+1} = (v_t + a) * DAMPING
 */
export const TANK_DAMPING = 0.85;

/**
 * 撞牆反彈係數 (0 ~ 1)
 * TODO(tune): 未查證，撞擊邊界時反轉並衰減的速度比例
 */
export const WALL_BOUNCE_FACTOR = 0.2;

/**
 * 【Lv 1 基礎坦克極速推導】：
 * 每 tick 運動方程：v_{t+1} = (v_t + a) * d
 * 穩態極速：v_max = (a * d) / (1 - d) = (0.95 * 0.85) / 0.15 = 5.3833 世界單位 / tick
 * 換算世界速度：5.3833 * 25 = 134.58 單位/秒（約 5.38 格/秒）
 */
export const LV1_TERMINAL_SPEED =
  (TANK_MOVE_ACCEL * TANK_DAMPING) / (1 - TANK_DAMPING);

// ==========================================
// 5. 戰鬥與子彈規格
// ==========================================

/**
 * 子彈存活時間（tick 數）
 * 查證來源：https://diepio.fandom.com/wiki/Gameplay_Strategies
 * 原文："Bullets despawn after traveling for 3 seconds."
 * 換算：3 秒 * SIM_TICK_RATE = 75 ticks
 */
export const BULLET_LIFESPAN_TICKS = 75;

/**
 * 子彈預設基礎半徑（世界單位）
 * TODO(tune): 未查證（約為砲管寬度的一半至略大，配合砲口直徑 18 單位設半徑 8 單位）
 */
export const BASE_BULLET_RADIUS = 8;

/**
 * 子彈基礎速度（世界單位 / tick）
 * TODO(tune): 未查證（fandom.com Stats 頁無公式，原版 Reddit 逆向推導值為 184/15 ≈ 12.27 格/秒 = 12.27 單位/tick）
 */
export const BASE_BULLET_SPEED = 184 / 15;

/**
 * 子彈速度每點加成（世界單位 / tick / point）
 * TODO(tune): 未查證（Reddit 推導 0 點至 7 點速度差 (328 - 184) / (15 * 7) ≈ 1.3714 單位/tick/點）
 */
export const BULLET_SPEED_PER_POINT = (328 - 184) / (15 * 7);

/**
 * 子彈是否繼承發射坦克的移動速度比例 (0 = 不繼承)
 * TODO(tune): 未查證，原版為 0 或極小數值，先設為 0
 */
export const BULLET_INHERIT_TANK_VELOCITY = 0;

/**
 * 基礎開火後座力衝量（世界單位 / tick）
 * TODO(tune): 未查證（diepio.fandom.com/wiki/Recoil 僅定性描述無數值）
 */
export const BASE_RECOIL_IMPULSE = 0.55;

/** 子彈物件池預先配置容量 */
export const BULLET_POOL_CAPACITY = 1024;

// ==========================================
// 6. 形狀生態與規格
// ==========================================

/** 場上目標形狀總數 */
export const SHAPE_TARGET_COUNT = 500;

/** 形狀預先配置最大容量 */
export const SHAPE_CAPACITY = 600;

/**
 * 形狀尺寸半徑（世界單位）
 * TODO(tune): 未查證（fandom.com/wiki/Polygons 僅說明尺寸隨邊數遞增，無確切像素半徑）
 * 基準：Lv1 坦克半徑 25。方塊設 13 (直徑 26 單位 ≈ 1 格)，三角 16，五邊形 25
 */
export const SHAPE_SQUARE_RADIUS = 13;
export const SHAPE_TRIANGLE_RADIUS = 16;
export const SHAPE_PENTAGON_RADIUS = 25;

/**
 * 形狀隨機漂移最大速度（世界單位 / tick）
 * TODO(tune): 未查證（原版緩慢漫遊）
 */
export const SHAPE_DRIFT_SPEED = 0.35;

/**
 * 形狀每 tick 速度阻尼
 * TODO(tune): 未查證
 */
export const SHAPE_DAMPING = 0.96;

/**
 * 碰撞推開與衝量係數
 * TODO(tune): 未查證
 */
export const COLLISION_PUSH_FACTOR = 0.6;
export const BULLET_KNOCKBACK_FACTOR = 0.4;

// ==========================================
// 7. 空間雜湊網格 (SpatialHash)
// ==========================================

/** 空間雜湊格子大小（世界單位，必須大於最大實體直徑 50 單位） */
export const SPATIAL_HASH_CELL_SIZE = 128;

// ==========================================
// 8. 視覺色彩常數（diep.io 經典風格）
// ==========================================

export const COLOR_GRID_BACKGROUND = 0xcdcdcd; // 網格底色（淡灰）
export const COLOR_GRID_LINES = 0xc4c4c4; // 網格線條色
export const COLOR_OUT_OF_BOUNDS = 0xb5b5b5; // 邊界外底色（深灰）
export const COLOR_BORDER_LINE = 0x222222; // 邊界線條色
export const COLOR_TANK_BLUE = 0x00b2e1; // 玩家藍色本體
export const COLOR_BARREL_GRAY = 0x999999; // 砲管灰色
export const COLOR_STROKE = 0x555555; // 黑色/深灰輪廓線
export const STROKE_WIDTH = 3.5; // 輪廓線寬度

// 形狀色彩
export const COLOR_SQUARE = 0xffe869; // 黃色方塊
export const COLOR_TRIANGLE = 0xfc7677; // 紅色三角
export const COLOR_PENTAGON = 0x768dfc; // 藍色五邊形
