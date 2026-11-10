# AGENTS.md - 開發智能體與工程協作規範 (diep-rework)

> 本文件是所有參與 `diep-rework` 開發的 AI 智能體（Agent）與開發者必須嚴格遵守的架構規範、程式碼標準、執行紀律與 M1~M6 實戰避坑紅線。

---

## 1. 核心原則 (Golden Rules)

1. **里程碑紀律 (Milestone Discipline)**：
   - 嚴格按照 [PLAN.md](./PLAN.md) 定義的里程碑順序（**M1 → M2 → M3a → M3b → M4a → M4b → M5 → M6**）逐步推進。
   - **禁止提前跳步**實作後續階段功能（例如在 M1 物理底座尚未驗收前就開始寫轉職或 AI）。
   - **收尾執行 `/verify-milestone`**：每個里程碑結尾必須執行 `/verify-milestone <編號>`（見 [.agent/skills/verify-milestone/SKILL.md](./.agent/skills/verify-milestone/SKILL.md)），依其步驟進行完整自動檢查、熱路徑掃描、browsermcp 瀏覽器操作與視覺驗收、驗收清單核對與 commit 規範檢查，並依其報告格式回報。回報後**立即停止等待使用者確認**，未獲指示前不得自行進入下一個里程碑。原本散落在各節的收尾回報要求一律以此流程為準，不重複規定。
2. **零程式碼確認期 (Plan-First Rule)**：
   - 未獲使用者明確「確認開始實作」指令前，不得生成或修改任何專案程式碼檔案。
3. **無伺服器與純前端 (Pure Client-Side)**：
   - 本專案為單一專案、純前端瀏覽器應用。禁止引進需要後端 Node.js 常駐服務運行的架構；所有遊戲迴圈、自研物理、AI 與 UI 均在瀏覽器前端執行。
4. **原版數值與時鐘單一真值 (Authentic Stats & Single Clock Source)**：
   - 所有遊戲數值與公式以原版 diep.io（`diepio.fandom.com/wiki/Stats` 等）為準。已查證數值寫入 `src/config/` 並**在註解中註明實際開啟驗證過的來源 URL 與原文**；查不到的數值必須在 `src/config/constants.ts` 設為具名常數並標註 `TODO(tune)`（註明「未查證」），透過 `DebugOverlay` 提供即時調整，**嚴禁無標記地自行編造數值或捏造不存在的 Wiki 子頁面連結**。
   - 固定步長模擬頻率（25 ticks/秒）只定義在 `src/config/constants.ts` 的單一常數 `SIM_TICK_RATE = 25`，所有以 tick 為單位的數值皆由它換算，**禁止硬編碼 `0.04`**。
   - 職業階層命名統一採用原版：**Tier 1 (Lv 1)**、**Tier 2 (Lv 15)**、**Tier 3 (Lv 30)**，型別固定為 `tier: 1 | 2 | 3`，禁止出現「一階／二階／三階」混用。
5. **世界尺度基準 (World Coordinate Scale)**：
   - 嚴格對齊原版尺度：**1 背景格 = 25 世界單位**、**Lv 1 坦克半徑 = 25 世界單位**（直徑 50 單位 = 2 格寬）。
   - 畫面顯示縮放全由 `Camera` 的 `CAMERA_BASE_SCALE * fovMultiplier` 控制，世界座標不放大，所有速度與物理運算一律以「**世界單位 / tick**」進行。
6. **Agent 瀏覽器自主實機驗收鐵則 (Autonomous Browser Verification Rule)**：
   - **嚴禁「紙上談兵」或「僅過單元測試即宣稱交付」**：所有功能開發、Bug 修復或遊戲性調優，Agent **必須主動啟動或連接本機瀏覽器（透過 `browsermcp`）進行全自動實機操作與視覺驗收**。
   - **六步全流程自主驗收清單**：
     1. **前景分頁激活與 Console 檢查**：先執行 `tab list` 與 `tab select <id>` 將 `http://localhost:3000/` 切換為瀏覽器**前景活動分頁（Active Foreground Tab）**，防止背景分頁遭瀏覽器節流至 1 FPS；接著執行 `console` 驗證無任何 Runtime Error 或 Pixi.js 警告。
     2. **確保玩家存活、開啟無敵與清除結算遮罩**：實機測試前，必須先開啟無敵模式（`window.__game.devOverlay.isGodMode = true`），並呼叫 `window.__game.hud.gameOverModal.triggerRespawn()`（**嚴禁只呼叫 `respawnPlayer()` 導致 `GameOverModal` 結算畫面殘留遮擋**），同時確認 `playerTank.active === true` 且 `hud.gameOverModal.container.visible === false`。驗收世界畫面時應關閉 `DebugOverlay` 或 `EvolutionPanel` 遮擋，確保中央視野乾淨。
     3. **模擬操作注入**：透過鍵盤按鍵、`DebugOverlay` 快捷按鈕或單行控制台指令，模擬真實玩家操作（如一鍵升級至 Lv 15/30、卡牌點擊轉職、屬性加點、切換上帝視角等）。
     4. **動態多 Tick 連續取樣監控**：涉及 AI 決策、手感、轉向平滑度或物理碰撞之修改，必須在瀏覽器中連續採樣多個時間區間（如連續 20~50 ticks），檢查實體狀態與屬性數值序列（`aiState`, `shooting`, `rotation`, `hp` 等），**杜絕狀態乒乓閃爍、單幀抽搐、卡彈窒息或漂移死鎖**。
     5. **效能與幀率實測**：透過 `DebugOverlay` 實時監測前景分頁下的 FPS（目標 120+ FPS）、TPS（穩定 25 TPS）、Tick 耗時（預算內 < 40ms，平均 < 1ms）與渲染更新耗時。
     6. **實機截圖與 `read_file` 肉眼自我審查**：調用 `screenshot` 擷取 Canvas 畫面後，Agent **必須立即呼叫 `read_file` 讀取該截圖影像檔進行視覺自檢**，親眼確認：(a) 畫面並非處於 `GAME OVER` 死亡結算頁面、(b) 目標坦克與發射出的子彈清晰可見、(c) 描邊粗細與解析度無異常，最後才將圖片複製至 Artifact 目錄並在報告中呈現。

---

## 2. 程式碼規範與型別標準 (Coding & TypeScript Standards)

1. **嚴格型別與 Linter (Strict TypeScript & Biome)**：
   - `tsconfig.json` 必須開啟 `strict: true`。
   - 採用 **`@biomejs/biome`** 進行程式碼風格檢查與格式化，強制啟用 `noExplicitAny: error`。執行 `npm run lint` 必須對應 `biome check`。
   - **嚴禁使用 `any`**；若有不確定型別，使用 `unknown` 並進行型別收窄（Type Narrowing），或定義明確的 `interface` / `type`。
2. **模組化分層架構 (Modular Systems / ECS-lite)**：
   - **`src/entities/`**：僅存放實體純扁平數值狀態（`id`, `x`, `y`, `vx`, `vy`, `prevX`, `prevY`, `angle`, `prevAngle`, `radius`, `hp`, `stats` 等）。**實體 `id` 一律為數字（`number`）**；熱路徑欄位禁止使用巢狀 `Vector2D` 物件。
   - **`src/physics/`**：自研圓形碰撞（位置積分、速度、每 tick 固定乘數阻尼、圓形推開與衝量、高速子彈掃掠防穿透）與基於 `TypedArray` 的零配置空間雜湊網格（`SpatialHash`）。不依賴任何外部物理引擎。
   - **`src/systems/`**：純邏輯處理器（`PhysicsWorld`, `FireSystem`, `CollisionSystem`, `ShapeSystem`, `LevelingSystem`, `RegenSystem`, `SpawnSystem`, `AISystem`）。System 在固定模擬步長（25 TPS）中推進狀態，**只消費 `InputCommand`**（玩家與 AI 共用同一指令介面），不直接耦合鍵盤事件或渲染物件。
   - **`src/rendering/`**：純視圖表現層。利用實體的 `prevX`/`prevY`/`prevAngle` 與 `x`/`y`/`angle` 搭配渲染插值係數 `alpha` 計算畫面顯示座標與角度，**絕不回寫或修改任何戰鬥與物理數值**。
   - **`src/ui/`**：All-in-Canvas UI。掛載於獨立的 `HUDContainer`，透過 `EventBus` 監聽數值變更，向外發送使用者操作事件（加點、點擊轉職）。僅當候選職業 `>= 1` 時依規則彈出 `EvolutionPanel`，且支援跨級連升後連續彈出下一階轉職選項。
3. **輸入處理規範 (Input Rules)**：
   - 鍵盤輸入**一律使用 `KeyboardEvent.code`**（如 `KeyW`, `KeyA`, `KeyS`, `KeyD`, `KeyE`, `Backquote`, `Digit1` ~ `Digit8`），避免使用者開啟中文輸入法時 `event.key` 變成 `'Process'` 造成操控失效；不得因 `event.isComposing` 忽略 `keydown`。
   - `InputManager`（玩家）與 `AISystem`（AI）均輸出標準化的 `InputCommand`，交由 System 統一處理。
4. **事件驅動解耦 (Event-Driven Decoupling)**：
   - 系統與 UI 間的跨模組通訊必須透過 `EventBus` 發布與訂閱（且 emit 參數須維持扁平零配置），禁止跨層循環引用。

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
3. **Pixi.js v8 渲染最佳化與手動視錐剔除**：
   - 子彈、三種幾何形狀與粒子**必須使用預先烘培共用貼圖（Shared Texture）的預配置 `Sprite` 池**，最大化 GPU 批次繪製（Batch Rendering）。
   - **嚴禁使用 Pixi v8 內建 `Culler.shared.cull` 或設定 `sprite.cullable = true`**（會導致預配置物件池 Sprite 包圍盒快取失效、發射出的子彈完全隱形）。**一律統一使用 `Camera.getVisibleBounds()` 搭配 `src/rendering/culling.ts` 的 `isInBounds(rx, ry, radius, visibleBounds, margin)` 手動設定 `sprite.visible`**。
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
   │   ├── TankContainer (MultiTankRenderer + Player TankRenderer)
   │   ├── HealthBarLayer (置於坦克與形狀之上，共用世界插值座標)
   │   └── ParticleContainer
   └── HUDContainer (固定螢幕像素座標，不受相機縮放影響)
       ├── StatUpgradePanel
       ├── ScoreBar
       ├── MiniMap
       ├── Leaderboard
       ├── EvolutionPanel
       ├── KillToast
       └── GameOverModal
   ```
2. **Pixi v8 API 強制規範**：
   - 初始化畫布必須使用 `await app.init({ ... })`。
   - `Graphics` 繪圖必須先呼叫幾何方法（如 `.circle(x, y, r)`、`.rect(...)`、`.poly(...)`），再呼叫 `.fill(...)` 與 `.stroke(...)`。
   - **嚴禁使用 Pixi v7 已廢棄的 `beginFill()` / `endFill()` / `lineStyle()` 等舊語法**。
3. **座標與角度真值、渲染插值及固定更新順序**：
   - 實體自身的扁平數值欄位（`entity.x`, `entity.y`, `entity.angle`）為遊戲世界的唯一真值（Single Source of Truth）。
   - 每個模擬 tick 開始前先將當前座標與角度存入 `prevX = x; prevY = y; prevAngle = angle;`。
   - 本體 Sprite、世界動態血條（`HealthBarRenderer`）與小地圖圓點**必須共用 `getRenderPosition(entity, alpha, out)` 取得插值座標**；角度必須透過最短弧度差 `lerpAngle(prevAngle, angle, alpha)` 插值。
   - **每幀 `Game.render(alpha)` 固定執行順序（嚴禁調換）**：
     ① `FixedStepper` 跑完當幀所有模擬 ticks → ② 計算玩家插值座標並更新 `Camera.update()` → ③ `Camera.applyTransform(worldContainer)` → ④ 更新所有世界層 Sprite 與 `HealthBarRenderer` → ⑤ 更新 `HUDContainer` 各面板。
4. **碰撞過濾與每 Tick 結算規則**：
   - **同源不互撞**：同一發射者（`ownerId` 相同）的子彈彼此不碰撞、與發射者本人亦不碰撞；MVP 無隊伍系統，其餘單位互為敵人。
   - **每 Tick 結算（不乘 $\Delta t$）**：每個模擬 tick（25 TPS）兩圓重疊時各結算一次傷害（含子彈 vs 目標、坦克 vs 形狀、**坦克 vs 坦克本體互撞與推開**）。
   - **防穿透**：高速子彈每 tick 位移可能大於半徑，必須採用掃掠檢測（Swept Circle-Circle）避免漏判。

---

## 5. 測試、除錯與驗收要求

1. **測試先行與原版數值 Golden Values (Unit Tests)**：
   - 測試先行：實作或修改系統邏輯前，先撰寫或更新 `tests/` 下的 Vitest 單元測試。
   - 數值測試必須以 [PLAN.md](./PLAN.md) 第 6 節的原版數值作為 **Golden Values**。
   - 壓力測試（`tests/stress.test.ts`）僅輸出耗時基準數據並驗證零崩潰，**不做硬性毫秒斷言**（避免不同機器負載造成假性失敗）。
2. **In-Game Debug 沙盒維護（僅 `DEV` 載入）**：
   - `DebugOverlay.ts`（按 `Backquote` `` ` `` 鍵開啟）**只能在 `if (import.meta.env.DEV)` 條件下動態載入**，確保正式生產打包 Tree-shaking 完全剔除除錯面板程式碼。
   - 每個里程碑新增功能時，必須同步擴充 `DebugOverlay` 對應的測試與調參功能。
3. **收尾驗收回報與瀏覽器自主實機驗收**：
   - 里程碑完成或重大功能收尾時的檢查、熱路徑掃描、驗收清單核對與回報，一律依 `/verify-milestone <編號>` 流程執行並套用其報告格式。
   - **實機驗證強制執行**：必須透過 `browsermcp` 自行連線 Edge 瀏覽器，激活前景分頁並確認玩家處於存活且無 `GameOverModal` 遮擋狀態下，執行完整遊戲場景模擬、擷取實機快照並以 `read_file` 親自檢視圖片內容。

---

## 6. 套件管理與終端操作命令

- **本機環境**：Windows 11, PowerShell。
- **核准套件清單（Strict Dependency Allowlist）**：
  - **主要依賴**：`pixi.js@^8`。
  - **開發與測試依賴**：`vite`, `typescript`, `vitest`, `@biomejs/biome`。
  - **嚴格限制**：**上述清單以外的任何第三方套件（含 `jsdom`, `commitlint`, `husky`, `matter-js`），未經詢問並獲得使用者明確同意前，禁止自行安裝**。
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
   - `feat`、`fix`、`refactor`、`perf`、`test`、`docs`、`build`、`chore`、`style`。
3. **Scope 建議清單**：
   - `core`、`physics`、`rendering`、`entities`、`systems`、`ui`、`ai`、`config`、`debug`、`tests`、`docs`（跨模組可省略）。
4. **Description 規範**：
   - 使用英文（English）、祈使句語氣（如 `add`, `fix`, `scaffold`, `refactor`）、小寫開頭、結尾不加句號、長度不超過 72 字元。
5. **里程碑與執行紀律**：
   - 每個里程碑至少有 1 個 commit；每個 commit 都必須能獨立通過 `npm run typecheck`、`npm test` 與 `npm run lint`。
   - **禁止使用無 type 的提交訊息**（如禁止 `"M1: foundation"`）。
   - **嚴禁私自 `git commit --amend` 或 force push 已回報給使用者的 commit**，除非使用者明確要求。
   - 在 Windows PowerShell 提交多行 commit 訊息時，優先寫入暫存檔再以 `git commit -F <file>` 提交，避免多行字串解析錯誤。

---

## 8. M1 ~ M6 歷次實戰踩坑與避坑紅線總表 (Post-Mortem & Anti-Regression Redlines)

> 本節彙整自 M1 至 M6 開發期間所有曾被使用者糾正、退回重做、視覺破圖與物理/AI 異常之實戰教訓。Agent 在撰寫任何新功能、重構或執行驗收時，必須逐條對照避坑：

### A. 瀏覽器自主驗收與視覺審查紅線 (Browser Verification & Visual Audit)

1. **【紅線 1】嚴禁在 `GameOverModal` 死亡結算遮罩下或背景節流分頁中截圖驗收**：
   - **踩坑歷史**：透過 `eval` 直接呼叫 `window.__game.respawnPlayer()` 雖讓底層 `playerTank.active` 變為 `true`，但未關閉 `GameOverModal` 遮罩；且分頁未切換至前景導致 FPS 掉到 1，截出的驗收圖停留在 `GAME OVER` 結算畫面卻未察覺。
   - **避坑規範**：
     - 驗收第一步必須執行 `tab select <id>` 確保遊戲分頁位於前景。
     - 測試前必先執行 `window.__game.devOverlay.isGodMode = true`，並呼叫 `window.__game.hud.gameOverModal.triggerRespawn()` 確保結算視窗關閉（驗證 `hud.gameOverModal.container.visible === false` 且 `playerTank.active === true`）。
     - 每次 `screenshot` 後**必須呼叫 `read_file` 親自檢視圖片**，確認畫面無遮擋、坦克與子彈清晰呈現，嚴禁盲目繳交截圖。
2. **【紅線 2】邊框視覺粗細恆定律（Stroke Invariance ~3.0px）與高解析度超取樣**：
   - **踩坑歷史**（Commit `c71c6f0`）：`BulletRenderer` 初期只烘培單一半徑 9px、邊框 3px 的低解析度貼圖；當 Destroyer 子彈半徑放大至 18~24px 時，直接將 Sprite `scale` 放大 2.67 倍，導致邊框暴增至 ~8px 且嚴重模糊。
   - **避坑規範**：
     - 所有實體（坦克、砲管、形狀、各口徑子彈）在世界座標下的描邊寬度必須恆定維持約 **`STROKE_WIDTH = 3.0px`**。
     - 嚴禁將含描邊的小尺寸貼圖直接高倍數放大；不同尺寸量級的實體必須預先烘培對應規格的高解析度貼圖（如 `normalTexture` 半徑 36 / 筆觸 12、`destroyerTexture` 半徑 72 / 筆觸 12，皆設定 `resolution: 2` 超取樣，再以 `scale ≈ 0.25` 縮小繪製以保持 3.0px 銳利邊框）。
3. **【紅線 3】`browsermcp` 的 `eval` 單行指令約束**：
   - **踩坑歷史**：在 `browsermcp` 傳入多行 JavaScript 字串會被依換行符拆解為多條無效指令而報錯。
   - **避坑規範**：所有傳給 `browsermcp` 的 `eval "() => { ... }"` 必須壓縮為**單行字串（Single-line）**執行。

### B. 渲染層、座標同步與 UI 視覺破圖紅線 (Rendering, Sync & UI Geometry)

4. **【紅線 4】禁用 Pixi v8 `Culler.shared.cull`，強制使用手動邊界剔除 `isInBounds`**：
   - **踩坑歷史**（M2 Commit `1f158dd`）：對物件池預配置的 `Sprite` 啟用 `cullable = true` 與 `Culler.shared.cull()`，造成發射出的子彈在畫面上完全隱形（面板計數增加、有後座力但看不見子彈）。
   - **避坑規範**：全面禁用 Pixi 內建 `Culler`；所有池化 Sprite 一律使用 `isInBounds(rx, ry, radius, visibleBounds, margin)` 手動更新 `sprite.visible`，並在 `DebugOverlay` 監控 `active / visible` 比值（`active > 0 && visible === 0` 時紅字告警）。
5. **【紅線 5】動態血條必須掛載於 `WorldContainer` 並與本體共用插值座標**：
   - **踩坑歷史**（M3b Commit `e8d19e8`）：初期將血條放在 `HUDContainer` 並每幀做世界轉螢幕座標轉換，因與 `Camera.update` 時序差及取整誤差，導致坦克與形狀移動時血條劇烈抖動脫節。
   - **避坑規範**：`HealthBarRenderer` 必須置於 `WorldContainer` 內的 `HealthBarLayer`，與本體及小地圖共用 `getRenderPosition(entity, alpha, out)` 取得插值座標，不做世界轉螢幕轉換、不旋轉、不做 `Math.round` 取整。
6. **【紅線 6】砲管與實體旋轉角度必須插值（`lerpAngle` 最短弧度差）**：
   - **踩坑歷史**（M5 Commit `78edece`）：25 TPS 模擬下直接繪製 `tank.angle`，導致 AI 轉移目標時砲管呈現瞬移與階梯式跳動。
   - **避坑規範**：實體必須維護 `prevAngle`，每幀渲染時使用將角度差正規化至 $[-\pi, \pi]$ 的 `lerpAngle(prevAngle, angle, alpha)` 進行平滑插值。
7. **【紅線 7】梯形砲管幾何方向與同口徑子彈半徑統一**：
   - **踩坑歷史**（M4a Commit `79642dc` & M6 Commit `c71c6f0`）：Machine Gun 梯形喇叭口曾因 `width`（根部）與 `tipWidth`（砲口）定義混淆而畫成普通短砲管；後期又誤加隨機子彈大小浮動。
   - **避坑規範**：
     - 梯形砲管 `width` 為連接坦克本體之根部寬度，`tipWidth` 為前端砲口寬度（外擴喇叭口必須滿足 `tipWidth > width`）。
     - **同一根口徑砲管射出的子彈必須為統一半徑**（`BASE_BULLET_RADIUS * sizeFactor * bulletSizeMultiplier`），並與砲口尺寸錨定對齊，嚴禁對同一砲管子彈半徑做隨機縮放。
8. **【紅線 8】Canvas UI 卡片尺寸與高 DPI 文字清晰度**：
   - **踩坑歷史**（M4b Commit `c9e1637`）：`EvolutionPanel` 初期卡片過小、文字未設高解析度導致排版擁擠與字體模糊；`Ignore` 按鈕位置不符原版。
   - **避坑規範**：Canvas 內嵌 UI 的所有 `Text` 必須設定高解析度（`resolution >= 2`）與清晰描邊；`EvolutionPanel` 採用大尺寸多色動態旋轉預覽卡（104px+），下方配置灰色長方形 `Ignore` 按鈕（點擊收合、滑鼠移開數秒後再靠近自動展開）。

### C. 輸入控制與轉職狀態機紅線 (Input Handling & Evolution Flow)

9. **【紅線 9】防卡鍵鐵則：`keyup` 永遠放行、失焦全清、UI 控件自動 `blur()`**：
   - **踩坑歷史**（M2 Commit `33e283c` & `c5e893b`）：長按移動鍵時操作 `DebugOverlay` 滑桿或失焦，導致 `keyup` 被攔截或遺失，坦克鬆手後仍朝原方向無限暴衝；且焦點留在按鈕上導致按空白鍵誤觸發 UI 按鈕。
   - **避坑規範**：
     - `InputManager` 於 `window` 使用 `{ capture: true }` 監聽；焦點在表單控件時僅忽略 `keydown`，**`keyup` 永遠無條件處理**。
     - 在 `blur`、`visibilitychange`、`pointercancel`、`contextmenu` 與開關 `DebugOverlay` 時強制清空所有按鍵狀態。
     - `DebugOverlay` 按鈕與滑桿操作後立即呼叫 `.blur()` 將焦點歸還 Canvas，且禁止對鍵盤事件呼叫 `stopPropagation()`。
10. **【紅線 10】跨級連升（Lv 1 直升 Lv 30）必須連續觸發轉職面板**：
    - **踩坑歷史**（M4b Commit `c9e1637` & M5 Commit `80c2d54`）：Lv 30 Basic Tank 點擊 Lv 15 轉職卡進化為 Tier 2 後，面板直接關閉而未繼續彈出 Lv 30 (Tier 3) 進化選項。
    - **避坑規範**：`evolveTank()` 完成轉職後必須立即再次呼叫 `checkEvolution()`，若當前等級已達下一階門檻且有候選職業，必須無縫刷新並保持開啟 `EvolutionPanel`。

### D. 物理碰撞、重生分布與 AI 戰術狀態機紅線 (Physics, Spawn & AI FSM)

11. **【紅線 11】坦克本體互撞、重生無敵護盾與全圖分散選點（防中央刷怪與角落堆積）**：
    - **踩坑歷史**（M5 Commit `80c2d54`, `b51c186`, `39ac4d1`）：M5 初期未實作坦克本體互撞；且 AI 重生邏輯瑕疵導致機器人在地圖正中央無限壓新，或 5~6 台 AI 擠在同一角落出生互卡。
    - **避坑規範**：
      - `CollisionSystem` 必須執行 Tank vs Tank 圓形推開與雙方撞擊傷害結算。
      - `SpawnSystem` 嚴格限制僅在 `active === false` 且倒數完畢時重生，並採用具邊界內縮與角落懲罰的**最大最小距離採樣（Maximin Distance Sampling）**遠離所有存活坦克。
      - 重生後賦予 `SPAWN_INVULNERABILITY_TICKS` 無敵閃爍護盾（開火即提前解除）。
12. **【紅線 12】AI 狀態機雙門檻遲滯（Hysteresis 防抽搐）與撤退持續開火**：
    - **踩坑歷史**（M5 Commit `39ac4d1`, `04a0e56`）：AI 在低血量跨越單一撤退門檻時，於 `retreating` 與 `farming` 間微秒級乒乓切換，導致原地飄移、砲管高頻抽動且完全不開火。
    - **避坑規範**：
      - **雙門檻遲滯（Hysteresis）**：進入 `retreating` 的血量門檻（如 `< 35%`）與脫離 `retreating` 的恢復門檻（如 `>= 65%` 或脫離威脅半徑 + 最短維持 ticks）必須分離，徹底杜絕狀態乒乓震盪。
      - **撤退邊退邊打**：AI 在 `retreating` 狀態下移動方向遠離威脅，但**必須持續瞄準威脅或路徑形狀並維持 `shooting = true`**（藉後座力加速脫離並自衛），禁止在有目標時停火盲飄。

---

# Diep.io Clone 專案架構與常駐規範 (M4 ~ M6 階段)

## 1. 使用者意圖自動轉譯 (Intent Translation)
- 使用者輸入之需求多為白話描述或玩法感受。收到指令時，必須自動對應至本專案的 TypeScript 模組、設定檔與測試檔，不得要求使用者提供底層程式碼細節。

## 2. M1 ~ M3b 核心底座紅線 (嚴禁破壞)
- **固定步長與插值**：模擬層嚴格維持 `FixedStepper` (`SIM_TICK_RATE = 25` TPS)，所有移動、射擊冷卻、生命回復皆以 `tick` 計算；渲染層必須維持 `prevX`/`prevY`/`prevAngle` 至 `x`/`y`/`angle` 的平滑插值，禁止將遊戲邏輯綁定在渲染幀率 (FPS) 上。
- **零配置與記憶體管理**：在 `25 TPS` 模擬迴圈、碰撞檢測與渲染更新中，嚴禁頻繁 `new` 物件或產生陣列垃圾。必須全面複用 `ObjectPool` 與基於 TypedArray 的 `SpatialHash`。
- **共享驅動架構 (`InputCommand`)**：無論是玩家 (`InputManager` 透過 `event.code` 觸發) 或 M5 的 `AISystem`，所有坦克實體的移動與開火必須 100% 透過寫入該實體的 `InputCommand` 驅動，共用同一套移動與射擊系統，嚴禁為 AI 寫獨立的作弊移動或開火邏輯。
- **Pixi.js v8 規範**：遵循 Pixi v8 非同步初始化與共用貼圖 Sprite 池化設計，純 HUD 元件統一掛載於 `HUD` 容器，世界動態血條掛載於 `WorldContainer` 的 `HealthBarLayer`，視錐剔除一律採用 `isInBounds` 手動邊界判斷。
- **代碼品質與型別安全**：嚴格遵守 Biome 規範 (`noExplicitAny`)，禁止使用 `any` 型別。

## 3. 里程碑推進與 DebugOverlay 同步鐵則
- 每推進一個子里程碑或新功能：
  1. 必須同步擴充 `DebugOverlay`（僅在 `import.meta.env.DEV` 載入，按 `Backquote` 開啟），確保新功能具備一鍵測試按鈕（如：無敵模式、上帝視角、強制切換職業、生成/清除 AI、壓力測試）。
  2. 正式生產建置 (`npm run build`) 必須確保 Tree-shaking 完全剔除 `DebugOverlay`。

## 4. 完成定義 (Definition of Done)
- 任何代碼修改完成後，必須依序在終端機執行並通過：
  1. `npm run typecheck`
  2. `npm test` (Vitest 單元測試全過)
  3. `npm run lint` (Biome 檢查無報錯)
- **Agent 瀏覽器全流程自主實機驗收（強制）**：
  - 凡涉及 UI (`EvolutionPanel`, `GameOverModal`, `StatUpgradePanel`)、相機視野 FOV、砲管與子彈外觀、戰鬥手感、AI 戰術與狀態機、物理碰撞等任何可玩內容變更：
  - **必須調用 `browsermcp` 自行連接本機 Edge `localhost:3000` 分頁並以 `tab select` 切換至前景**。
  - **必須先開啟 `isGodMode = true` 並呼叫 `hud.gameOverModal.triggerRespawn()` 確保玩家存活且無結算遮罩遮擋**。
  - 讀取 Console 確認 **0 Runtime Error / 0 Warning**。
  - 模擬玩家真實互動（升級、點擊轉職卡牌、開火射擊、切換上帝視角、觸發 600 子彈壓力測試）。
  - 對動態系統進行連續多 Tick 取樣（確保 0 抽搐、0 死鎖、0 漂移、持續開火）。
  - 調用 `screenshot` 擷取 Canvas 實圖後，**必須呼叫 `read_file` 親自檢視截圖影像**確認無 `GameOverModal` 遮擋且邊框/解析度正常，再轉存至 Artifacts 作為交付驗收之唯一具體視覺證據。
