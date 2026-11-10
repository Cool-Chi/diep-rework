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

/** 地圖正方形尺寸（4000 世界單位） */
export const MAP_SIZE = WORLD_WIDTH;

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
 * 等級對相機視野 FOV 的放大縮放係數
 * 查證來源：https://diepio.fandom.com/wiki/Levels
 * 原文："The Field of View increases as you level up, allowing you to see more of the map"
 * TODO(tune): 未查證具體係數，設為每級 +0.005 (Lv 30 增加約 14.5% FOV)
 */
export const FOV_LEVEL_SCALING = 0.005;

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
 * 移動速度屬性每點加成倍率
 * TODO(tune): 未查證（原版 Wiki: Movement speed is passively lowered as your tank levels up）
 */
export const MOVE_SPEED_PER_POINT = 0.075;

/**
 * 等級對移動速度的懲罰指數係數
 * TODO(tune): 未查證
 */
export const MOVE_SPEED_LEVEL_PENALTY = 0.5;

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
 * 觸發加速生命回復 (Hyper Regen) 所需未受傷之模擬 tick 數
 * 查證來源：https://diepio.fandom.com/wiki/Health_Regen
 * 原文："With 0 points invested into Health Regen, a tank will not naturally regenerate any health until it has gone 30 seconds without taking damage."
 * 換算：30 秒 * SIM_TICK_RATE = 750 ticks
 */
export const HYPER_REGEN_TICKS = 30 * SIM_TICK_RATE;

/**
 * 加速生命回復 (Hyper Regen) 每秒回復生命百分比
 * TODO(tune): 未查證，原版迅速回滿生命（設 0.15 即每秒回復 15% 最大生命，約 6.7 秒回滿）
 */
export const HYPER_REGEN_PERCENT_PER_SEC = 0.15;

/**
 * 擊殺坦克獲得其分數之獎勵比例
 * 查證來源：https://diepio.fandom.com/wiki/Score
 * TODO(tune): 未查證，MVP 設為 1.0 (受害者累積分數的 100%)
 */
export const KILL_REWARD_RATIO = 1.0;

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

/**
 * 血條在 Y 軸相對於實體中心的偏移係數 (offsetY = radius * HEALTHBAR_OFFSET_FACTOR)
 * TODO(tune): 未查證，依視覺手感調整（置於實體圓形底緣下方）
 */
export const HEALTHBAR_OFFSET_FACTOR = 1.35;

/**
 * 血條寬度相對於實體半徑的倍率 (width = radius * HEALTHBAR_WIDTH_FACTOR)
 * TODO(tune): 未查證，依視覺手感調整
 */
export const HEALTHBAR_WIDTH_FACTOR = 1.6;

/**
 * 血條世界高度（世界單位常數）
 */
export const HEALTHBAR_HEIGHT = 4.0;

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

// ==========================================
// 9. M5 體驗與 AI 調優常數
// ==========================================

/** 坦克重生無敵保護時間（秒與 ticks） */
export const SPAWN_INVULNERABLE_SECONDS = 3;
export const SPAWN_INVULNERABLE_TICKS =
  SPAWN_INVULNERABLE_SECONDS * SIM_TICK_RATE; // 75 ticks

/** 坦克肉搏碰撞接觸傷害冷卻（ticks）與法向彈射衝量 */
export const TANK_BODY_CONTACT_COOLDOWN_TICKS = 8; // 0.32 秒接觸傷害間隔
export const TANK_COLLISION_SEPARATION_IMPULSE = 3.5; // 相撞法向彈開衝量 (世界單位/tick)

/** AI 擬人化砲管旋轉每 tick 最大角速度（弧度/tick） */
export const AI_MAX_TURN_RATE_PER_TICK = 0.2; // 約 11.5 度/tick = 286 度/秒
