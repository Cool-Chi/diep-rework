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

/** 世界地圖寬度（世界單位，8000x8000 封閉地圖） */
export const WORLD_WIDTH = 8000;

/** 世界地圖高度（世界單位，8000x8000 封閉地圖） */
export const WORLD_HEIGHT = 8000;

/** 地圖正方形尺寸（8000 世界單位） */
export const MAP_SIZE = WORLD_WIDTH;

/**
 * Lv 1 基礎坦克半徑（世界單位）
 * 原版標準：Lv 1 坦克直徑 50 單位（半徑 25 單位 = 1 個網格寬）
 * 來源：https://diepio.fandom.com/wiki/Levels
 */
export const BASE_TANK_RADIUS = 25;

/** 單輛坦克支援之最大砲管上限（預先配置 Float32Array 零 GC 槽位） */
export const MAX_TANK_BARRELS = 8;

/**
 * 基本坦克砲管長度與寬度（世界單位）
 * 原版標準：直徑 50 坦克之基準砲管長度為 50（底盤圓心起算，外露 25 單位 = 1 個半徑長，長度:半徑比 L:R ≈ 2.0:1）
 * 來源：https://diepio.fandom.com/wiki/Tanks
 */
export const BASE_BARREL_LENGTH = 50;
export const BASE_BARREL_WIDTH = 18;

// ==========================================
// 3. 視圖與相機
// ==========================================

export const CAMERA_BASE_SCALE = 0.75; // 原版 diep.io 視角標準，相較 1.0 視野面積擴展約 33.3%

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
 * 對齊 BASE_BARREL_WIDTH = 18 砲口寬度（直徑 18 單位 = 半徑 9 單位）
 */
export const BASE_BULLET_RADIUS = 9;

/**
 * 子彈壽命末段平滑漸逝時間（ticks）
 * TODO(tune): 末段 8 ticks（約 0.32 秒）內透明度由 1.0 降至 0，尺寸微縮至 60%
 */
export const BULLET_FADEOUT_TICKS = 8;

/**
 * 子彈基礎速度（世界單位 / tick）
 * 原版 diep.io 基準約 9.2 格/秒 (世界單位/tick)，降低彈速以強化彈幕可讀性與走位穿梭空間
 */
export const BASE_BULLET_SPEED = 9.2;

/**
 * 子彈速度每點加成（世界單位 / tick / point）
 * 滿點 7 點加成後達 16.2 單位/tick (約 16.2 格/秒)
 */
export const BULLET_SPEED_PER_POINT = 1.0;

/**
 * 子彈是否繼承發射坦克的移動速度比例 (0 = 不繼承)
 * TODO(tune): 未查證，原版為 0 或極小數值，先設為 0
 */
export const BULLET_INHERIT_TANK_VELOCITY = 0;

/**
 * 基礎開火後座力衝量（世界單位 / tick，作用於坦克本體位移）
 * TODO(tune): 未查證（diepio.fandom.com/wiki/Recoil 僅定性描述無數值）
 */
export const BASE_RECOIL_IMPULSE = 0.55;

/**
 * 基礎砲管開火收縮後座力位移距離（世界單位，作用於砲管局部縱向退縮動畫）
 * TODO(tune): 原版開火瞬間砲管向底盤縮回約 6~10 單位後平滑回彈
 */
export const BASE_BARREL_RECOIL_OFFSET = 8.0;

/**
 * 砲管開火後座力每 tick 回彈衰減係數 (25 TPS 下約 3~4 ticks 彈回原位)
 * TODO(tune): 未查證
 */
export const BARREL_RECOIL_DECAY_PER_TICK = 0.65;

/** 子彈物件池預先配置容量 (M8 擴展至 3072) */
export const BULLET_POOL_CAPACITY = 3072;

// ==========================================
// 6. 形狀生態與規格
// ==========================================

/** 場上目標形狀總數 (M8 8000x8000 擴展至 1400) */
export const SHAPE_TARGET_COUNT = 1400;

/** 形狀預先配置最大容量 (M8 擴展至 1600) */
export const SHAPE_CAPACITY = 1600;

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

/** 子彈相消物理重疊分離推開係數 */
export const BULLET_COLLISION_PUSH_FACTOR = 0.85;

/** 子彈互撞衝擊速度阻尼 (0.90 代表撞擊後保有 90% 原向速度) */
export const BULLET_COLLISION_DAMPING = 0.9;

/** 子彈相消法向彈性衝量恢復係數 (0.45 產生清脆的彈性偏轉反饋) */
export const BULLET_COLLISION_RESTITUTION = 0.45;

/** 子彈相消法向偏轉衝量增益倍率 (強化掠射斜撞時的軌道折射與偏轉) */
export const BULLET_COLLISION_DEFLECTION_FACTOR = 0.85;

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
export const STROKE_WIDTH = 2.8; // 輪廓線寬度（微調至 2.8px，對齊原版最新精緻向量邊框）

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

// ==========================================
// 10. M8 AI 彈幕預判與連續力場調優常數
// ==========================================

/** AI 子彈威脅偵測感知半徑（世界單位，隨視野擴大同步提升至 550） */
export const AI_BULLET_SCAN_RADIUS = 550;

/** AI CPA 最接近時間上限（ticks，超過此時間之子彈視為遠程無威脅）TODO(tune) */
export const AI_MAX_CPA_TICKS = 28;

/** AI 彈幕主動攔截鎖定維持時間（ticks，調縮為 4 ticks = 0.16 秒，快速點射後回歸對人）TODO(tune) */
export const AI_INTERCEPT_LOCK_TICKS = 4;

/** AI 砲管主動攔截之正前方最大夾角視錐（弧度，約 35.5 度；側翼流彈禁止轉動砲管）TODO(tune) */
export const AI_INTERCEPT_MAX_ANGLE = 0.62;

/**
 * 敵方存在時，觸發 AI 主動轉動砲管攔截之最低子彈半徑（世界單位）
 * 預設 18 單位（僅 Destroyer / Annihilator 等極度致命巨砲彈才允許攔截）
 * 普通子彈（Twin/Basic/MG 等）一律靠身法側閃，砲管 100% 保持鎖定敵方坦克
 * TODO(tune)
 */
export const AI_INTERCEPT_MIN_BULLET_RADIUS = 18;

/**
 * AI 進入殘血逃跑 (Retreat) 狀態之生命比例門檻 (< 45%)
 * TODO(tune)
 */
export const AI_RETREAT_HP_ENTER = 0.45;

/**
 * AI 脫離殘血逃跑狀態之生命比例門檻 (>= 70%，雙門檻滯後 Hysteresis 杜絕進退抽搐)
 * TODO(tune)
 */
export const AI_RETREAT_HP_EXIT = 0.7;

/**
 * AI 殘血逃跑後撤力場強度倍率 (2.2x 壓倒性遠離威脅)
 * TODO(tune)
 */
export const AI_RETREAT_FORCE_MULTIPLIER = 2.2;

/**
 * AI 幾何形狀主動避障警戒邊界淨距（世界單位，小於此距離時觸發排斥避障）
 * TODO(tune)
 */
export const AI_SHAPE_AVOID_DISTANCE = 55;

/**
 * AI 幾何形狀避障排斥力場強度倍率 (2.4x 防止交火走位時撞怪自殘)
 * TODO(tune)
 */
export const AI_SHAPE_AVOID_FORCE = 2.4;

/**
 * AI 高速移動避障之速度前瞻預測 tick 數（約 0.4 秒前瞻，提前偵測前進路徑上的幾何形狀）
 * TODO(tune)
 */
export const AI_SHAPE_LOOKAHEAD_TICKS = 10;

/**
 * AI 正前方幾何形狀側向切線繞行偏轉力倍率 (3.6x 將衝撞力轉化為弧形滑動繞行)
 * TODO(tune)
 */
export const AI_SHAPE_TANGENT_FORCE = 3.6;

/**
 * AI 脫離敵人視野後強制維持定向逃逸時間（ticks，75 ticks = 3.0 秒）
 * 建立安全逃逸緩衝區，杜絕在視野邊緣掉頭回跑
 * TODO(tune)
 */
export const AI_ESCAPE_MAINTAIN_TICKS = 75;

/**
 * AI 評估弱肉強食實力差距之威懾逃逸門檻（綜合等級、階級與血量之戰力差）
 * 當 (敵方戰力 - 自身戰力) * 人設威懾敏感度 >= 15 時觸發主動避退，杜絕弱小者迎面送頭
 * TODO(tune)
 */
export const AI_INTIMIDATION_POWER_DIFF_THRESHOLD = 15.0;

/** AI 目標慣性效用加成比率（1.25x 消除多目標切換抽搐）TODO(tune) */
export const AI_TARGET_STICKINESS_RATIO = 1.25;

/** AI 地圖邊界排斥力場緩衝區（世界單位）TODO(tune) */
export const AI_BORDER_BUFFER = 350;

/** 小型 AI 對戰沙盒競技場尺寸與中心座標（世界單位）TODO(tune) */
export const AI_ARENA_SIZE = 1200;
export const AI_ARENA_CENTER_X = WORLD_WIDTH * 0.5;
export const AI_ARENA_CENTER_Y = WORLD_HEIGHT * 0.5;
