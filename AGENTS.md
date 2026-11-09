# AGENTS.md - 開發智能體與工程協作規範 (diep-rework)

> 本文件是所有參與 `diep-rework` 開發的 AI 智能體（Agent）與開發者必須嚴格遵守的架構規範、程式碼標準與執行紀律。

---

## 1. 核心原則 (Golden Rules)

1. **里程碑紀律 (Milestone Discipline)**：
   - 嚴格按照 [PLAN.md](./PLAN.md) 定義的里程碑順序（**M1 → M2 → M3a → M3b → M4a → M4b → M5 → M6**）逐步推進。
   - **禁止提前跳步**實作後續階段功能（例如在 M1 物理底座尚未驗收前就開始寫轉職或 AI）。
   - 每個里程碑完成後必須依序執行以下 4 個步驟：
     - **(a)** 執行並通過 `npm run typecheck`、`npm test`、`npm run lint`（全數零錯誤）。
     - **(b)** 對照 [PLAN.md](./PLAN.md) 中該里程碑的「驗收標準」逐條自我檢查並向使用者回報結果。
     - **(c)** 執行 `git commit` 保存該里程碑的乾淨進度。
     - **(d)** **立即停下來等待使用者確認**，未獲指示前不得自行進入下一個里程碑。
2. **零程式碼確認期 (Plan-First Rule)**：
   - 未獲使用者明確「確認開始實作」指令前，不得生成或修改任何專案程式碼檔案。
3. **無伺服器與純前端 (Pure Client-Side)**：
   - 本專案為單一專案、純前端瀏覽器應用。禁止引進需要後端 Node.js 常駐服務運行的架構；所有遊戲迴圈、自研物理、AI 與 UI 均在瀏覽器前端執行。
4. **原版數值與時鐘單一真值 (Authentic Stats & Single Clock Source)**：
   - 所有遊戲數值與公式以原版 diep.io（`diepio.fandom.com/wiki/Stats` 等）為準。已查證數值寫入 `src/config/` 並**在註解中註明來源 URL**；查不到的數值必須在 `src/config/constants.ts` 設為具名常數並標註 `TODO(tune)`，透過 `DebugOverlay` 提供即時調整，**嚴禁無標記地自行編造數值**。
   - 固定步長模擬頻率（25 ticks/秒）只定義在 `src/config/constants.ts` 的單一常數 `SIM_TICK_RATE = 25`，所有以 tick 為單位的數值皆由它換算，**禁止硬編碼 `0.04`**。
   - 職業階層命名統一採用原版：**Tier 1 (Lv 1)**、**Tier 2 (Lv 15)**、**Tier 3 (Lv 30)**，型別固定為 `tier: 1 | 2 | 3`，禁止出現「一階／二階／三階」混用。
5. **世界尺度基準 (World Coordinate Scale)**：
   - 嚴格對齊原版尺度：**1 背景格 = 25 世界單位**、**Lv 1 坦克半徑 = 25 世界單位**（直徑 50 單位 = 2 格寬）。
   - 畫面顯示縮放全由 `Camera` 的 `CAMERA_BASE_SCALE * fovMultiplier` 控制，世界座標不放大，所有速度與物理運算一律以「**世界單位 / tick**」進行。

---

## 2. 程式碼規範與型別標準 (Coding & TypeScript Standards)

1. **嚴格型別與 Linter (Strict TypeScript & Biome)**：
   - `tsconfig.json` 必須開啟 `strict: true`。
   - 採用 **`@biomejs/biome`** 進行程式碼風格檢查與格式化，強制啟用 `noExplicitAny: error`。執行 `npm run lint` 必須對應 `biome check`。
   - **嚴禁使用 `any`**；若有不確定型別，使用 `unknown` 並進行型別收窄（Type Narrowing），或定義明確的 `interface` / `type`。
2. **模組化分層架構 (Modular Systems / ECS-lite)**：
   - **`src/entities/`**：僅存放實體純扁平數值狀態（`id`, `x`, `y`, `vx`, `vy`, `prevX`, `prevY`, `radius`, `health`, `stats` 等）。**實體 `id` 一律為數字（`number`）**；熱路徑欄位禁止使用巢狀 `Vector2D` 物件。
   - **`src/physics/`**：自研圓形碰撞（位置積分、速度、每 tick 固定乘數阻尼、圓形推開與衝量、高速子彈掃掠防穿透）與基於 `TypedArray` 的零配置空間雜湊網格（`SpatialHash`）。不依賴任何外部物理引擎。
   - **`src/systems/`**：純邏輯處理器（`MovementSystem`, `CombatSystem`, `LevelingSystem`, `SpawnSystem`, `AISystem`）。System 在固定模擬步長（25 TPS）中推進狀態，**只消費 `InputCommand`**（玩家與 AI 共用同一指令介面），不直接耦合鍵盤事件或渲染物件。
   - **`src/rendering/`**：純視圖表現層。利用實體的 `prevX`/`prevY` 與 `x`/`y` 搭配渲染插值係數 `alpha` 計算畫面顯示座標，**絕不回寫或修改任何戰鬥與物理數值**。
   - **`src/ui/`**：All-in-Canvas UI。掛載於獨立的 `HUDContainer`，透過 `EventBus` 監聽數值變更，向外發送使用者操作事件（加點、點擊轉職）。Lv 30 (Tier 3) 選擇由 `ENABLE_TIER3_CHOICE = false` 關閉，僅當候選職業 `> 1` 時才顯示 `EvolutionPanel`。
3. **輸入處理規範 (Input Rules)**：
   - 鍵盤輸入**一律使用 `KeyboardEvent.code`**（如 `KeyW`, `KeyA`, `KeyS`, `KeyD`, `KeyE`, `Backquote`, `Digit1` ~ `Digit8`），避免使用者開啟中文輸入法時 `event.key` 變成 `'Process'` 造成操控失效。
   - `InputManager`（玩家）與 `AISystem`（AI）均輸出標準化的 `InputCommand`，交由 System 統一處理。
4. **事件驅動解耦 (Event-Driven Decoupling)**：
   - 系統與 UI 間的跨模組通訊必須透過 `EventBus` 發布與訂閱，禁止跨層循環引用（如禁止在 `Bullet` 或 `CollisionResolver` 內部直接操作 `HUD`）。

---

## 3. 效能與記憶體管理鐵律 (Performance & Zero-GC Rules)

遊戲目標支援 **120+ FPS** 高刷顯示器（25 TPS 模擬 + 插值）與 **500+ 形狀 / 600+ 子彈高密度交火**，所有 Agent 必須遵守以下效能規範：

1. **熱路徑零配置與禁用語法清單 (Zero-Allocation in Hot Path)**：
   - 在 `GameLoop`、`FixedStepper`、所有 `System.update()`、物理碰撞檢測與每幀繪製中，**絕對禁止**：
     - `new Object()`、物件實字 `{}`、陣列實字 `[]` 或臨時閉包函式。
     - 帶閉包的陣列方法：`Array.prototype.map`、`filter`、`forEach`、`reduce`、`some`、`every`、`find`。
     - 展開運算子（`...`）、`Array.from()`、`Object.keys()`、`Object.values()`、`Object.entries()`。
     - 熱路徑內的字串拼接（`+`）與樣板字串（`` `${...}` ``）。
   - **一律改用標準 `for (let i = 0; i < len; i++)` 迴圈**，並複用預先配置的陣列或 `TypedArray`（如 `Int32Array`、`Float64Array`）。
2. **嚴格實施物件池 (Object Pooling)**：
   - 子彈（`Bullet`）與爆炸粒子（`Particle`）**必須**透過 `ObjectPool` 進行獲取（`acquire()`）與釋放回收（`release()`）。
   - 實體離開邊界、生命歸零或壽命 ticks 耗盡時，重置屬性並歸還池中。
3. **Pixi.js v8 渲染最佳化**：
   - 子彈、三種幾何形狀與粒子**必須使用共用貼圖（Shared Texture）的 `Sprite` 或 v8 `ParticleContainer`**，最大化 GPU 批次繪製（Batch Rendering）。
   - 頻繁變動的數字（分數、等級、FPS、彈藥計數）**一律使用 `BitmapText`**，避免每幀重繪 Canvas Text 紋理。
   - **視錐剔除（Frustum Culling）**：統一使用 `Camera.getVisibleBounds()` 取得當前世界可視範圍，並搭配 **Pixi v8 內建 `Culler`** 剔除畫面外物件。
4. **遠端實體 LOD 降頻原則 (Conditional LOD)**：
   - 遠距實體降頻模擬**僅在 M2 / M6 壓力測試（600 子彈 + 500 形狀）未達幀率目標時才實作**，在未證明為效能瓶頸前不提前引入。

---

## 4. Pixi.js v8 繪製與自研物理協同規則

1. **畫布層次結構 (Canvas Hierarchy)**：
   ```
   Pixi.Application.stage
   ├── WorldContainer (隨 Camera 縮放與插值平移)
   │   ├── GridBackground (1 格 = 25 單位)
   │   ├── ShapeContainer
   │   ├── BulletContainer
   │   ├── TankContainer
   │   └── ParticleContainer (Pixi v8 ParticleContainer)
   └── HUDContainer (固定螢幕像素座標，不受相機縮放影響)
       ├── HealthBars
       ├── StatUpgradePanel
       ├── ScoreBar (含 BitmapText)
       ├── MiniMap
       ├── Leaderboard
       ├── EvolutionPanel
       └── GameOverModal
   ```
2. **Pixi v8 API 強制規範**：
   - 初始化畫布必須使用 `await app.init({ ... })`。
   - `Graphics` 繪圖必須先呼叫幾何方法（如 `.circle(x, y, r)`、`.rect(...)`、`.poly(...)`），再呼叫 `.fill(...)` 與 `.stroke(...)`。
   - **嚴禁使用 Pixi v7 已廢棄的 `beginFill()` / `endFill()` / `lineStyle()` 等舊語法**。
3. **座標真值與渲染插值原則**：
   - 實體自身的扁平數值欄位（`entity.x`, `entity.y`）為遊戲世界的唯一真值（Single Source of Truth）。
   - 每個模擬 tick 開始前先將當前座標存入 `prevX = x; prevY = y;`。
   - 渲染幀根據 `FixedStepper` 計算出的插值係數 `alpha`（$0 \le \alpha < 1$），設定顯示物件位置：
     `displayObj.x = entity.prevX + (entity.x - entity.prevX) * alpha`。
4. **碰撞過濾與每 Tick 結算規則**：
   - **同源不互撞**：同一發射者（`ownerId` 相同）的子彈彼此不碰撞、與發射者本人亦不碰撞；MVP 無隊伍系統，其餘單位互為敵人。
   - **每 Tick 結算（不乘 $\Delta t$）**：每個模擬 tick（25 TPS）兩圓重疊時各結算一次傷害：
     - 子彈對目標造成傷害：$\text{Bullet.Damage} \times \min(1, \text{Bullet.Health} / D_{\text{target}\to\text{bullet}}) \times \text{Target.DamageTakenMultiplier}$。
     - 子彈自身扣除生命：$D_{\text{target}\to\text{bullet}}$（目標撞擊傷害或子彈傷害 $\times 0.25$）；生命 $\le 0$ 即回收。
   - **防穿透**：高速子彈每 tick 位移可能大於半徑，必須採用掃掠檢測或分段步進避免漏判。

---

## 5. 測試、除錯與驗收要求

1. **測試先行與原版數值 Golden Values (Unit Tests)**：
   - 測試先行：實作或修改系統邏輯前，先撰寫或更新 `tests/` 下的 Vitest 單元測試（`leveling.test.ts`、`stats.test.ts`、`combat.test.ts`、`spatialHash.test.ts`、`objectPool.test.ts`、`tanks.config.test.ts`）。
   - 數值測試必須以 [PLAN.md](./PLAN.md) 第 6 節的原版數值作為 **Golden Values**（例如：`Lv 15 = 787` 分、`Lv 30 = 6184` 分共 28 點；Lv 1 最大生命 `50`、Lv 45 為 `138`；基礎撞擊傷害 `20 / 30 / 5`；子彈生命 `2 → 12.5`；子彈傷害 `7 → 28`；裝填 `15 → 8 ticks`）。
2. **In-Game Debug 沙盒維護（僅 `DEV` 載入）**：
   - `DebugOverlay.ts`（按 `Backquote` `` ` `` 鍵開啟）**只能在 `if (import.meta.env.DEV)` 條件下動態載入**，確保正式生產打包不含任何除錯面板程式碼。
   - 每個里程碑新增功能時，必須同步擴充 `DebugOverlay` 對應的測試與調參功能（如：無敵、一鍵升級、強制切換職業、生成 600 子彈 + 500 形狀壓力測試、調整 `TODO(tune)` 常數）。

---

## 6. 套件管理與終端操作命令

- **本機環境**：Windows 11, PowerShell。
- **核准套件清單（Strict Dependency Allowlist）**：
  - **主要依賴**：`pixi.js@^8`。
  - **開發與測試依賴**：`vite`, `typescript`, `vitest`, `@biomejs/biome`。
  - **嚴格限制**：**上述清單以外的任何第三方套件，未經詢問並獲得使用者明確同意前，禁止自行安裝**。
- **API 文件查閱**：
  - 查閱第三方函式庫（特別是 **Pixi.js v8**）API 時，若環境提供 Context7 工具則優先使用，確保所有語法符合 v8 最新規範。
- **常用標準命令**：
  - 開發伺服器：`npm run dev`
  - 生產建置：`npm run build`
  - 型別檢查：`npm run typecheck`（`tsc --noEmit`）
  - 程式碼檢查：`npm run lint`（`biome check`）
  - 單元測試：`npm test`

---

## 7. Git 提交規範 (Git Commit Standards)

所有提交必須嚴格遵守 **Conventional Commits 1.0** 格式：`<type>(<scope>): <description>`。

1. **Commit 格式結構**：
   - 格式：`<type>(<scope>): <description>`
   - 可選的 body：每行不超過 72 字元，說明具體變更內容與原因。
   - 可選的 footer：以 `Refs: M2` 或 `Refs: PLAN.md M1` 格式標註對應之里程碑。
2. **Type 允許清單（嚴格限定以下 9 種）**：
   - `feat`：新功能或系統實作。
   - `fix`：修復 Bug 或數值缺陷。
   - `refactor`：程式碼重構（未新增功能或修復 Bug）。
   - `perf`：效能優化（如降低 GC、批次渲染優化）。
   - `test`：新增或修改測試案例。
   - `docs`：文件變更（如 PLAN.md, AGENTS.md）。
   - `build`：建置系統或依賴變更（如 package.json, vite.config.ts）。
   - `chore`：輔助工具、例行維護或設定調整。
   - `style`：程式碼風格或格式整理（不影響運行邏輯）。
3. **Scope 建議清單**：
   - 模組範圍：`core`、`physics`、`rendering`、`entities`、`systems`、`ui`、`ai`、`config`、`debug`、`tests`、`docs`。
   - 跨模組或全專案層級變更可省略 scope。
4. **Description 規範**：
   - 使用英文（English）。
   - 使用祈使句語氣（如 `add`, `fix`, `scaffold`, `refactor`）。
   - 開頭小寫。
   - 結尾不加句號。
   - 標題長度不超過 72 字元。
5. **里程碑與執行紀律**：
   - 每個里程碑至少有 1 個 commit；可依邏輯拆成多個，但每個 commit 都必須能獨立通過 `npm run typecheck`、`npm test` 與 `npm run lint`。
   - **禁止使用無 type 的提交訊息**（如禁止 `"M1: foundation"`）。
   - **嚴禁私自 `git commit --amend` 或 force push 已回報給使用者的 commit**，除非使用者明確要求。
   - **不得額外安裝套件**：不得為了檢查 commit 格式安裝 `commitlint` 或 `husky` 等工具（維持套件白名單不變）。
