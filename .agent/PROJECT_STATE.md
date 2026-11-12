# PROJECT_STATE.md - 專案狀態快照與交接備忘 (M1 ~ M9 完工 & 正式玩家版交付)

> **更新時間**：2026-11-12  
> **當前狀態**：**M1 至 M9 核心里程碑已全數通過實機自主驗收**，並已建立純淨無外掛正式玩家版分支（`release/player-edition`）。全遊戲 21 款坦克（Tier 1~4）全數實裝、拓撲樹完整、等級系統解鎖至 Lv 45（33 技能點）、M8 子彈相消物理、M9 4 大 AI 人設（Newbie/Aggressor/Tactician/Apex）、動態速度前瞻側向切線避障、弱肉強食實力差距威懾主動避退。36 個測試檔案、202 個單元測試 100% 通過。  
> **適用對象**：接續開發新對話視窗的 AI Agent 或工程師，可直接基於本文件銜接後續擴充工作。

---

## 1. 專案核心架構總覽 (Architecture Overview)

- **執行環境**：純前端、All-in-Canvas、無伺服器架構（Vite + TypeScript Strict + Pixi.js v8）。
- **時鐘單一真值**：固定模擬步長 `SIM_TICK_RATE = 25` TPS（每 tick 40ms，`FixedStepper` 累加時間並計算每幀平滑渲染插值 `alpha`）。
- **世界尺度基準**：1 網格 = 25 單位，Lv 1 坦克半徑 = 25 單位（直徑 50 單位 = 2 格寬），地圖範圍 4000×4000。
- **等級與技能系統 (M7 解鎖)**：
  - `MAX_LEVEL = 45`，滿級累積分數查表至原版真值 23,536 分。
  - 總技能點數 33 點（Lv 2~28 每級 +1 點共 27 點；Lv 30, 33, 36, 39, 42, 45 各 +1 點）。
- **子彈四階超取樣貼圖 (M7 升級)**：
  - `smallTexture` ($r=18$)：對應 Gunner、小號獵人彈 ($r < 7.0$)。
  - `normalTexture` ($r=36$)：對應常規坦克彈 ($7.0 \le r < 14.0$)。
  - `largeTexture` ($r=72$)：對應 Destroyer ($14.0 \le r < 21.0$)。
  - `hugeTexture` ($r=96$)：對應 Annihilator ($r \ge 21.0$)。
  - 配合動態 `baseScale` 恆定繪製為 3.0px 邊框，嚴格遵守【紅線 2】。
- **M8 子彈相消與 5 向量混合架構**：
  - 自研子彈對撞動量守恆扣血與碰撞折射，並噴濺粒子火花（零 GC 池化）。
  - CPA 最短交會時間預判（`AI_MAX_CPA_TICKS = 28`），正向夾角 $\pm 0.62\text{ rad}$ 巨彈主動攔截鎖定（`AI_INTERCEPT_LOCK_TICKS = 4`）。
  - 5 股力場連續合成（戰鬥、撤退、農怪、避彈、邊界），逃跑遇邊界時轉化為沿切線方向滑動（`Wall-Corner Tangent Sliding`），杜絕死角定格。
- **M9 擬人化 AI 人設與生態系深化**：
  - 4 大 AI 人設（Newbie 薄荷綠、Aggressor 珊瑚紅、Tactician 薰衣草紫、Apex 金橙色），支援種子 PRNG（Mulberry32）確定性復現。
  - 速度前瞻動態避障（`AI_SHAPE_LOOKAHEAD_TICKS = 10`）與側向切線繞行偏轉力（`AI_SHAPE_TANGENT_FORCE = 3.6`），逃跑正對形狀時將後撤力偏轉為切線繞行，徹底杜絕自撞扣血。
  - 實時綜合戰鬥力指標與弱肉強食實力差距威懾主動避退（`AI_INTIMIDATION_POWER_DIFF_THRESHOLD = 15.0`），弱小 AI 即使 100% 滿血亦會及時逃離強大掠食者。
  - 脫離視野後強制維持 75 ticks（3.0 秒）定向逃逸，安靜趕路加速回血，消除邊緣回頭送死的抽搐問題。
  - 無頭自對弈演化訓練器（Stage A 微觀決鬥 + Stage B 宏觀混戰 2,000 ticks），適應度匯出至 `reports/m9-epoch-summary.json`。
- **正式玩家發布版 (`release/player-edition`)**：
  - 徹底卸載 `DebugOverlay` 與按鍵監聽。
  - 視角 100% 平滑鎖定玩家本體，禁用自由相機與小地圖跳轉。
  - 玩家關閉開局無敵（`isGodMode = false`），真實承受傷害，正常死亡結算並以 3 秒護盾重生。
  - AI 預設對玩家開啟敵意（`ignorePlayer = false`），提供完整 PvP/PvE 遊戲體驗。
- **熱路徑零垃圾收集 (Zero-GC)**：
  - 模擬與渲染迴圈嚴禁 `new` 物件、閉包與陣列解構。
  - 500+ 形狀、600+ 子彈與 1024 粒子全面池化（`ObjectPool`）。
  - 碰撞粗篩採用基於 `Int32Array` 的空間雜湊（`SpatialHash`）。
- **品質防線**：36 個測試檔案、202 個 Vitest 單元測試 100% 通過，Biome Linter 0 錯誤。

---

## 2. 全遊戲 21 款坦克職業清單與拓撲矩陣 (Tank Classes Matrix)

所有職業定義於 [`src/config/tanks.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/tanks.config.ts)：

```
Tier 1 (Lv 1)    Tier 2 (Lv 15)       Tier 3 (Lv 30)       Tier 4 (Lv 45)
─────────────    ──────────────       ──────────────       ──────────────
                                      ┌─ Triple Shot ─────┬─ Triplet
                                      │                   └─ Penta Shot
                 ┌─ Twin ─────────────┼─ Quad Tank ───────── Octo Tank
                 │                    └─ Twin Flank (封頂)
                 ├─ Sniper ───────────┬─ Assassin ────────── Ranger
Basic Tank ──────┤                    └─ Hunter ──────────── Predator
                 ├─ Machine Gun ──────┬─ Destroyer ───────── Annihilator
                 │                    └─ Gunner (封頂)
                 │                    ┌─ Tri-Angle ───────┬─ Booster
                 └─ Flank Guard ──────┤                   └─ Fighter
                                      ├─ Quad Tank ───────── Octo Tank
                                      └─ Twin Flank (封頂)
```

### 職業詳細參數矩陣 (共 21 款)：

| 職業 ID | 階層 | 名稱 | 解鎖等級 | 砲管配置與特殊幾何 | 裝填乘數 | 傷害乘數 | 貫穿乘數 | 速度乘數 | 子彈半徑 | 壽命 (ticks) | FOV 倍率 | 轉職後繼清單 |
| :--- | :---: | :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `basic` | 1 | Basic Tank | 1 | 單管 (18×38) | 1.0x | 1.0x | 1.0x | 1.0x | 9.0 | 75 | 1.000 | `twin`, `sniper`, `machine_gun`, `flank_guard` |
| `twin` | 2 | Twin | 15 | 雙管平行 ($\pm 12\text{px}$) | 1.0x | 0.65x | 0.9x | 1.0x | 8.1 | 75 | 1.000 | `triple_shot`, `quad_tank`, `twin_flank` |
| `sniper` | 2 | Sniper | 15 | 長管 (18×50) | 1.5x | 1.20x | 1.1x | 1.50x | 9.0 | 105 | 1.111 | `assassin`, `hunter` |
| `machine_gun` | 2 | Machine Gun | 15 | 喇叭口 (18~27×42) | 0.67x | 0.70x | 0.8x | 0.90x | 9.0 | 65 | 1.000 | `destroyer`, `gunner` |
| `flank_guard` | 2 | Flank Guard | 15 | 前後雙向 ($0, \pi$) | 前後 1.0x | 1.0x / 0.8x | 1.0x | 1.0x | 9.0 | 75 | 1.000 | `tri_angle`, `quad_tank`, `twin_flank` |
| `triple_shot` | 3 | Triple Shot | 30 | 三向扇形 ($0, \pm 45^\circ$) | 1.0x | 0.70x | 1.0x | 1.0x | 8.1 | 75 | 1.000 | `triplet`, `penta_shot` |
| `assassin` | 3 | Assassin | 30 | 超長管 (18×60) | 1.67x | 1.25x | 1.15x | 1.60x | 9.0 | 125 | 1.250 | `ranger` |
| `destroyer` | 3 | Destroyer | 30 | 巨口徑 (36×42, 後座 3.5x) | 3.0x | 3.50x | 2.0x | 0.75x | 18.0 | 70 | 1.000 | `annihilator` |
| `twin_flank` | 3 | Twin Flank | 30 | 前後各雙管 (共 4 管) | 1.0x | 0.60x | 0.8x | 1.0x | 8.1 | 75 | 1.000 | 無 (暫封頂) |
| `quad_tank` | 3 | Quad Tank | 30 | 四向十字 ($0, 90, 180, 270^\circ$) | 1.0x | 0.75x | 0.8x | 1.0x | 8.1 | 75 | 1.000 | `octo_tank` |
| `hunter` | 3 | Hunter | 30 | 同軸疊管 (底24/42, 頂18/50) | 1.5x | 0.95x / 0.75x | 0.9x / 0.8x | 1.25x / 1.35x | 9.0 / 6.75 | 95 | 1.150 | `predator` |
| `gunner` | 3 | Gunner | 30 | 四根平行微小管 (寬 10) | 0.67x | 0.45x | 0.55x | 1.25x | 4.5 (小彈) | 70 | 1.000 | 無 (暫封頂) |
| `tri_angle` | 3 | Tri-Angle | 30 | 主砲 + 雙後置推進管 (150度) | 1.0x | 1.0x / 0.4x | 1.0x / 0.4x | 1.0x | 9.0 / 7.2 | 75 / 60 | 1.000 | `booster`, `fighter` |
| `triplet` | 4 | Triplet | 45 | 前三管平行 (中42, 側36) | 1.0x | 0.60x | 0.85x | 1.0x | 8.1 | 75 | 1.000 | 無 (終極) |
| `penta_shot` | 4 | Penta Shot | 45 | 前五管扇形 ($0, \pm 22.5, \pm 45^\circ$) | 1.0x | 0.60x | 0.80x | 1.0x | 8.1 | 75 | 1.000 | 無 (終極) |
| `octo_tank` | 4 | Octo Tank | 45 | 八方全向 ($45^\circ$ 交替開火) | 1.0x | 0.65x | 0.75x | 1.0x | 8.1 | 75 | 1.000 | 無 (終極) |
| `ranger` | 4 | Ranger | 45 | 極限長管 (18×70, 彈速 1.8x) | 1.8x | 1.40x | 1.25x | 1.80x | 9.0 | 140 | 1.428 | 無 (終極) |
| `predator` | 4 | Predator | 45 | 三重疊管 (底26, 中20, 頂15) | 1.75x | 0.95/0.8/0.7x | 0.9/0.85/0.8x | 1.3/1.45/1.6x | 9.0/7.6/6.3 | 110 | 1.350 | 無 (終極) |
| `annihilator` | 4 | Annihilator | 45 | 寬 48 巨砲口 (後座力 4.5x) | 3.25x | 3.80x | 2.20x | 0.75x | 24.0 (巨彈) | 70 | 1.000 | 無 (終極) |
| `booster` | 4 | Booster | 45 | 主砲 + 雙排 4 根後置噴射管 | 1.0x | 1.0x / 0.35x | 1.0x / 0.35x | 1.0x | 9.0 / 7.2 | 75 / 55 | 1.000 | 無 (終極) |
| `fighter` | 4 | Fighter | 45 | 主砲 + 雙側翼管($\pm 90^\circ$) + 雙推進 | 1.0x | 1.0x / 0.7x / 0.35x | 1.0x / 0.8x / 0.35x | 1.0x | 9.0 / 8.1 / 7.2 | 75 / 70 / 60 | 1.000 | 無 (終極) |

---

## 3. AI 決策系統與戰術行為參數 (AI Behavior System Specs)

實作檔案：[`src/ai/AISystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/AISystem.ts) 與 [`src/ai/aiTactics.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiTactics.ts)

- **共用驅動介面**：AI 與玩家 100% 透過 `tank.input: InputCommand` 驅動，共用物理與移動/射擊系統。
- **四大行為狀態 (FSM)**：
  - `farming`：尋找視野內最近且高價值的多邊形，逼近至最佳射程射擊。
  - `combat`：瞄準視野內敵方坦克，根據職業戰術調整交戰距離（風箏/逼近）並啟動前置量預判射擊。
  - `retreating`：血量過低時遠離威脅點，**邊退邊打（維持開火自衛並利用後座力加速逃逸）**。
  - `wandering`：視野無目標時朝地圖內部隨機巡邏。
- **雙門檻遲滯（Hysteresis 防抽搐）**：
  - 進入撤退門檻：生命值 $< 35\%$ 或被強敵近身。
  - 脫離撤退門檻：生命值恢復至 $\ge 65\%$ 且脫離威脅半徑（維持至少 30 ticks）。
- **轉向平滑與角速度限制**：
  - 最大角速度限制：每 tick 不超過 `MAX_TURN_RATE_PER_TICK = 0.12 rad/tick`。
  - 渲染層雙緩衝插值：維護 `prevAngle`，透過 `lerpAngle` 正規化最短弧度差平滑插值。
- **重生保護與選點**：
  - 出生位置採**最大最小距離採樣（Maximin Distance Sampling）**，遠離所有現存坦克與危險角落。
  - 重生後享有 75 ticks（3 秒）無敵護盾 `SPAWN_INVULNERABILITY_TICKS`，主動開火則立即破盾。
- **Tier 4 智慧生成與配點 (M7)**：
  - 玩家達 Lv 45 時，場上 AI 依 30% Tier 3 與 70% Tier 4 菁英生成，並配置 33 點技能點。

---

## 4. 留存的 `TODO(tune)` 數值調校常數索引表

以下常數因原版 Wiki 未公開公式或屬於操作手感參數，已在 [`src/config/constants.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/constants.ts) 中標準化為具名常數並註明 `TODO(tune)`，均可透過 `DebugOverlay` 的即時滑桿直接調整：

| 檔案位置 | 常數名稱 | 當前數值 | 物理 / 遊戲性含義 | 調校建議與影響 |
| :--- | :--- | :--- | :--- | :--- |
| `src/config/constants.ts:65` | `CAMERA_FOV_PER_LEVEL` | `0.005` | 每升 1 級相機額外擴大之視野比例 | 影響高階坦克的視野開闊度 (Lv 45 約 +22%) |
| `src/config/constants.ts:71` | `CAMERA_SMOOTH_FACTOR` | `0.10` | 相機平滑跟隨權重 ($0 \sim 1$) | 數值越大鏡頭越黏，越小則鏡頭越延遲平滑 |
| `src/config/constants.ts:81` | `MOVEMENT_BASE_ACCEL` | `2.6` | 坦克每 tick 加速度 (世界單位/tick²) | 決定起步推力手感 |
| `src/config/constants.ts:87` | `LEVEL_SPEED_PENALTY` | `0.002` | 每升 1 級基礎速度被動衰減率 | 原版高等級坦克較沉重之手感 |
| `src/config/constants.ts:99` | `DAMPING` | `0.85` | 坦克每 tick 固定阻尼摩擦力 | 數值越高滑行越長，越低停煞越乾脆 |
| `src/config/constants.ts:105` | `WALL_BOUNCE_FACTOR` | `0.3` | 撞擊世界邊界時的反彈係數 | 影響撞牆回彈力量 |
| `src/config/constants.ts:140` | `HYPER_REGEN_PERCENT` | `0.15` | 30 秒無傷急速回復每秒比例 (15%) | 約 6.7 秒完全回滿 |
| `src/config/constants.ts:147` | `KILL_REWARD_RATIO` | `1.0` | 擊殺坦克獲得受害者積分之比例 | 影響擊殺滾雪球效應 |
| `src/config/constants.ts:159` | `BULLET_FADEOUT_TICKS` | `8` | 子彈壽命耗盡前平滑淡出 ticks (0.32s) | 透明度降至 0、尺寸縮小至 60% |
| `src/config/constants.ts:165` | `BASE_BULLET_SPEED` | `12.27` | 子彈 0 點屬性出膛速度 (單位/tick) | 決定狙擊與常規交火節奏 |
| `src/config/constants.ts:171` | `BULLET_SPEED_PER_POINT`| `1.37` | 子彈速度屬性每加 1 點之初速增幅 | 滿點 (7 點) 子彈極速可達 ~21.8 單位/tick |
| `src/config/constants.ts:183` | `BASE_RECOIL_FORCE` | `0.5` | 基準砲管開火施加於坦克之反推力衝量 | Annihilator 會乘以 4.5 倍產生強烈推進後座力 |
| `src/config/constants.ts:202` | `SHAPE_RADII` | `[14, 16, 26]` | 方塊 / 三角 / 五邊形碰撞半徑 | 影響與形狀貼身肉搏撞擊體積 |
| `src/config/constants.ts:211` | `SHAPE_BASE_DRIFT` | `0.25` | 幾何形狀漫遊速度上限 | 決定野外刷怪場的動態漂移活躍度 |
| `src/config/constants.ts:230` | `HEALTHBAR_OFFSET_FACTOR`| `1.6` | 動態血條相對於實體底緣的垂直偏移倍率 | 確保血條不與坦克底座或多邊形重疊 |
| `src/config/constants.ts:236` | `HEALTHBAR_WIDTH_FACTOR` | `1.4` | 動態血條寬度相對於半徑的縮放比例 | 隨實體大小等比例寬縮 |
| `src/config/constants.ts:322` | `AI_BULLET_SCAN_RADIUS` | `550` | AI 子彈威脅偵測感知半徑 (世界單位) | 隨相機視野擴大同步提升，避免被螢幕外冷槍擊中 |
| `src/config/constants.ts:325` | `AI_MAX_CPA_TICKS` | `28` | AI CPA 最接近時間上限 (ticks) | 超過此時間之子彈視為遠程無威脅，消除無效躲避 |
| `src/config/constants.ts:328` | `AI_INTERCEPT_LOCK_TICKS`| `4` | AI 巨彈主動攔截鎖定維持時間 (ticks) | 快速點射抵消後立即回歸瞄準敵方坦克 |
| `src/config/constants.ts:331` | `AI_INTERCEPT_MAX_ANGLE` | `0.62` | 觸發攔截的正前方最大夾角 (rad，約 35.5 度) | 側翼流彈禁止轉動砲管，僅靠身法閃避 |
| `src/config/constants.ts:339` | `AI_INTERCEPT_MIN_BULLET_RADIUS` | `18` | 允許 AI 轉動砲管攔截之最低子彈半徑 (單位) | 僅限 Destroyer / Annihilator 等致命巨砲彈 |
| `src/config/constants.ts:345` | `AI_RETREAT_HP_ENTER` | `0.45` | 進入殘血逃跑 (Retreat) 狀態之生命比例門檻 | 低於 45% 觸發逃跑 |
| `src/config/constants.ts:351` | `AI_RETREAT_HP_EXIT` | `0.70` | 脫離殘血逃跑之生命比例門檻 | 雙門檻遲滯防抽搐，需回血至 70% 才重返交火 |
| `src/config/constants.ts:357` | `AI_RETREAT_FORCE_MULTIPLIER` | `2.2` | 殘血逃跑後撤力場強度倍率 | 壓倒性遠離威脅點 |
| `src/config/constants.ts:363` | `AI_SHAPE_AVOID_DISTANCE`| `55` | 幾何形狀主動避障警戒邊界淨距 (世界單位) | 進入此淨距時觸發避障排斥力 |
| `src/config/constants.ts:369` | `AI_SHAPE_AVOID_FORCE` | `2.4` | 幾何形狀避障排斥力場強度倍率 | 防止交火走位撞怪自殘 |
| `src/config/constants.ts:375` | `AI_SHAPE_LOOKAHEAD_TICKS` | `10` | 高速避障速度動態前瞻 ticks (約 0.4 秒) | 提前偵測前進路徑上的幾何形狀，預留減速與轉彎距離 |
| `src/config/constants.ts:381` | `AI_SHAPE_TANGENT_FORCE` | `3.6` | 正前方幾何形狀側向切線繞行偏轉力倍率 | 將直衝障礙的撞擊力轉化為弧形滑動繞行動能 |
| `src/config/constants.ts:388` | `AI_ESCAPE_MAINTAIN_TICKS`| `75` | 脫離敵人視野後強制維持定向逃逸時間 (3 秒) | 建立安全逃逸緩衝區，杜絕在視野邊緣掉頭回跑送死 |
| `src/config/constants.ts:395` | `AI_INTIMIDATION_POWER_DIFF_THRESHOLD` | `15.0` | 弱肉強食實力差距威懾主動逃逸門檻 | (敵戰力 - 己戰力) * 人設敏感度 >= 15 時滿血亦避退 |

---

## 5. 後續擴充開發標準切入點指南 (Extension Playbook)

### 模式 A：新增特殊幾何形狀（如 Alpha Pentagon 或 Crasher）
1. **實體型別**：在 [`src/entities/Shape.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Shape.ts) 的 `ShapeType` 加入 `alpha_pentagon` 或 `crasher`。
2. **數值與生成**：在 [`src/config/constants.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/constants.ts) 加入其專屬半徑、HP、經驗值，並在 [`src/systems/ShapeSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/ShapeSystem.ts) 加入地圖中央「五邊形巢穴（Nest）」的聚集生成規則。
3. **貼圖渲染**：在 [`src/rendering/ShapeRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/ShapeRenderer.ts) 預先烘培高解析度貼圖並註冊入 Sprite 池。

### 模式 B：新增陣營與隊伍模式（Teams / 2-Teams / 4-Teams）
1. **實體欄位**：在 `Tank` 與 `Bullet` 增加 `teamId: number`（0 為中立/個人，1~4 為藍紅綠紫隊伍）。
2. **同隊碰撞過濾**：在 [`src/systems/CollisionSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/CollisionSystem.ts) 加上 `if (a.teamId === b.teamId) return;`（子彈不傷隊友、同隊坦克僅推開不扣血）。
3. **基地保護區**：在 [`src/systems/SpawnSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/SpawnSystem.ts) 劃分角落基地座標，並在基地內部署基地無敵防禦三角箭頭。
