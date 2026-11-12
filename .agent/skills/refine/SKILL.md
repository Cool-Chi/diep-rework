---
name: refine
description: 將使用者的白話文需求或模糊想法，結合專案現有 TypeScript 架構與 M1~M9 既有底座規範，自動擴寫並完善為精確的四段式工程技術規格書。當使用者輸入 /refine 或要求完善提示詞時觸發。
---

# 需求工程與技術規格完善規範 (Refine Skill)

用法：在聊天輸入 `/refine <需求想法>` 或要求將模糊概念整理為技術規格時觸發。  
本 Skill 定義了將使用者提出的白話文需求或模糊想法，結合專案現有 All-in-Canvas、ECS-lite 架構與 M1~M9 既有核心規範，自動擴寫為嚴密、可直接落地執行的四段式工程技術規格書。

---

## 執行流程

### 1. 靜默檢索代碼庫 (Silent Codebase Survey)
根據使用者描述的白話需求，先主動掃描相關模組與設定，**嚴禁向使用者詢問可直接從代碼查知的既定事實**：
- **數值與設定**：`src/config/constants.ts`、`src/config/tanks.config.ts`、`src/config/stats.config.ts`、`src/config/levels.config.ts`、`src/ai/aiPersonas.config.ts`、`src/ai/aiGenome.ts`、`src/ai/aiTactics.ts`。
- **實體與物理**：`src/entities/`（Tank, Bullet, Shape, Particle）、`src/physics/`（PhysicsWorld, SpatialHash）、`src/core/rng.ts`。
- **系統處理器**：`src/systems/`（CollisionSystem, FireSystem, LevelingSystem, RegenSystem, ShapeSystem, SpawnSystem）、`src/ai/AISystem.ts`。
- **渲染與 UI**：`src/rendering/`（Renderer, TankRenderer, MultiTankRenderer, BulletRenderer, ShapeRenderer, HealthBarRenderer, AiGizmoRenderer, culling.ts）、`src/ui/`（HUD, FreeCamBanner, GameOverModal, EvolutionPanel）。
- **現有測試與無頭基準**：`tests/`（確認現有單元測試、`tests/m8-arena.test.ts` 與 `tests/m9-evolution-trainer.test.ts` 覆蓋範圍）。

---

### 2. 產出四段式工程技術規格書 (4-Part Technical Specification)
在對話欄輸出標準四段式結構供使用者確認：

#### (1) 目標新增/修改檔案 (Target Files)
- 明確列出預計新增或修改的實體、系統、渲染、設定或測試檔案完整相對路徑（`.ts` 與 `.test.ts`）。
- 嚴格遵守模組職責單一原則（數值狀態在 `entities/`、純邏輯推進在 `systems/`、表現層在 `rendering/`、All-in-Canvas UI 在 `ui/`）。

#### (2) 核心實作與數值規格 (Implementation & Numerical Specs)
- **數值單一真值**：已查證數值附上原版 Wiki URL 與原文；查無原版數值設為具名常數並標註 `TODO(tune)`，嚴禁硬編碼無標記的魔術數字。
- **幾何與輸入規格**：補齊具體常數、砲管幾何參數（`tipWidth`, `spread`, 相位差 `fireDelayRatio`）、相機動態 FOV 倍率、世界尺度（1 背景格 = 25 世界單位、Lv 1 坦克直徑 50 單位）、描邊寬度（恆定 ~2.8-3.0px 且高解析超取樣）、或標準 `InputCommand` 映射邏輯。
- **決策/物理公式**：若涉及 AI 決策、向量混合、CPA 預判、切線避障、戰力指數或碰撞物理，給出精確的數學公式與門檻區間。

#### (3) M1~M9 底座架構與防呆檢查 (M1~M9 Architectural Guardrails)
逐項對照專案既有底座規範，確認完全不發生架構退化：
- **M1 時鐘與空間分割**：固定步長模擬時鐘單一真值（`SIM_TICK_RATE = 25` TPS，禁止硬編碼 `0.04`）；`SpatialHash` 零配置查詢與 `Camera` 插值解耦。
- **M2 熱路徑零配置 (Zero-Allocation / Zero-GC)**：在 `update` 迴圈、碰撞檢測與每幀繪製中，嚴禁 `new` 物件/陣列、禁閉包與禁陣列高階方法；子彈與粒子必須池化（`ObjectPool`）；**全面禁用 Pixi 內建 Culler**，強制使用手動邊界剔除 `isInBounds`。
- **M3 扁平數值與回血機制**：實體 `id` 恆為數字，戰鬥數值由 `deriveStats` 統一重算；血條必須掛載於 `WorldContainer` 的 `HealthBarLayer` 並與本體共用插值座標，杜絕抖動；支援自然回血與 30 秒無傷急速回血 (Hyper-Regen)。
- **M4 職業幾何與轉職拓撲**：21 款坦克職業定義、梯形砲管喇叭口朝向統一、動態 FOV 縮放、同口徑子彈半徑統一、轉職卡牌連升支援。
- **M5 擬人 AI 與手感防抖**：AI 決策有限狀態機、雙門檻遲滯防抖緩衝、角速度平滑限制（`AI_MAX_TURN_RATE_PER_TICK = 0.2 rad/tick`）、角度插值最短弧度差 `lerpAngle`。
- **M6 表現層與結算彈窗**：死亡結算彈窗 (`GameOverModal`) 與擊殺 Toast、爆炸粒子池回收、Enter 鍵綁定與重生防卡鍵。
- **M7 終局平衡與自適應 HUD**：數值成長係數平衡（Lv 45 封頂 33 技能點）、Canvas HUD 響應式佈局、四規格超取樣子彈貼圖保證恆定 3.0px 邊框。
- **M8 子彈相消與 5 向量混合**：子彈對撞動量守恆扣血與折射、CPA 最短交會時間預判 (< 28 ticks)、正向夾角 $\pm 0.62\text{ rad}$ 巨彈主動攔截鎖定 (4 ticks 防抖)、5 股連續力場混合與邊界防死鎖切線滑動 (Wall-Corner Tangent Sliding)。
- **M9 擬人人設與切線避障逃逸**：4 大強弱 AI 人設（Newbie、Aggressor、Tactician、Apex）專屬底色與性格、種子注入 PRNG、瞄準雜訊週期抽樣維持（防砲管高頻微顫）、速度動態前瞻避障（10 ticks）、側向切線繞行偏轉（`AI_SHAPE_TANGENT_FORCE = 3.6`）、逃跑路線阻礙切線偏轉、弱肉強食實力差距威懾主動避退（戰力差 $\times$ 敏感度 $\ge 15.0$ 即使滿血亦避退）、75 ticks 定向逃逸時間維持緩衝。
- **正式玩家版隔離規範 (Release Guardrail)**：正式發布版本（`release/player-edition`）永久隔離 `DebugOverlay`、自由相機按鍵、預設無敵與 ignorePlayer，確保純淨遊戲體驗。

#### (4) 自動化與實機驗收步驟 (Verification Steps)
- **單元測試與無頭 Arena 基準**：列出需新增/更新的 Vitest 測試案例，若涉及物理或 AI 調優，規劃無頭模擬壓測指標（`/auto-tune` 與 `tests/m8-arena.test.ts`、`tests/m9-evolution-trainer.test.ts`）。
- **靜態代碼防護**：`npm run typecheck`（`tsc --noEmit`）嚴格型別檢查通過、`npm run lint`（Biome check）零錯誤。
- **瀏覽器六步全流程實機驗收 (`browsermcp`)**：
  1. 前景分頁激活 (`tab select <id>`) 與 Console 零錯誤確認。
  2. 確保玩家存活、開啟無敵模式並呼叫 `hud.gameOverModal.triggerRespawn()` 清除遮罩。
  3. 模擬操作注入（加點、切換職業、開火、快捷鍵）。
  4. 連續 30 ticks 動態取樣監控實體屬性序列，杜絕乒乓抽搐。
  5. 效能實測（FPS 120+、TPS 25、Tick 耗時預算內 < 40ms，平均 < 1ms）。
  6. 截圖後強制呼叫 `read_file` 進行肉眼視覺自檢，確認描邊精緻無遮擋後呈現報告。

---

### 3. 等待確認或執行 (Confirmation Protocol)
輸出四段式技術規格書後，於末尾提示使用者確認：  
「**以上為自動完善的技術規格，回覆『好』或『執行』即刻動工，或告訴我哪裡要微調。**」
