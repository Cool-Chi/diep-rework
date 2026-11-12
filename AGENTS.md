# AGENTS.md - 開發智能體與工程協作規範 (diep-rework)

> **專案階段**：**M1 ~ M9 核心里程碑全數完工**，已建立純淨正式玩家發布版分支（`release/player-edition`）。
> 本文件是所有參與 `diep-rework` 開發的 AI 智能體（Agent）與開發者必須嚴格遵守的架構規範、程式碼標準、模組索引與實戰避坑紅線。

---

## 1. 核心目錄與檔案架構索引 (Architecture Map)

本專案採用純前端、All-in-Canvas、模組化 ECS-lite 架構，所有 `src/` 下的核心檔案路徑與單行職責如下：

### 核心驅動與時間循環 (`src/core/`)
- [`src/core/Game.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/Game.ts)：遊戲主中樞，組裝系統、管理主循環推進順序、輸入分發與每幀渲染管線。
- [`src/core/GameLoop.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/GameLoop.ts)：`requestAnimationFrame` 迴圈封裝，計算真實幀間隔 $\Delta t$ 並傳遞給步進器。
- [`src/core/FixedStepper.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/FixedStepper.ts)：固定步長模擬器（`SIM_TICK_RATE = 25` TPS），累積時間並輸出整數 ticks 與插值係數 `alpha`。
- [`src/core/Camera.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/Camera.ts)：世界相機，處理目標插值平移、動態 FOV 縮放、視窗變換矩陣、視錐計算與自由相機。
- [`src/core/InputManager.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/InputManager.ts)：玩家鍵鼠監聽（`KeyboardEvent.code`），封裝防卡鍵機制並輸出標準 `InputCommand`。
- [`src/core/EventBus.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/EventBus.ts)：全域扁平事件匯流排，解耦物理、戰鬥、AI 與 HUD，支援零 GC 傳參。
- [`src/core/ObjectPool.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/ObjectPool.ts)：通用高效物件池，以 $O(1)$ 進行 `acquire()` 與 `release()`，杜絕熱路徑 GC。
- [`src/core/deriveStats.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/deriveStats.ts)：依據坦克等級與 8 項屬性加點計算實時戰鬥數值（血量、速度、裝填、傷害等）。
- [`src/core/rng.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/rng.ts)：Mulberry32 偽隨機數產生器 (PRNG)，支援種子注入以實現 100% 確定性無頭訓練。

### 物理與空間分割 (`src/physics/`)
- [`src/physics/PhysicsWorld.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/physics/PhysicsWorld.ts)：自研 2D 圓形物理世界（加速度、每 tick 阻尼減速、速度積分、世界邊界夾取與彈性）。
- [`src/physics/SpatialHash.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/physics/SpatialHash.ts)：基於扁平 `Int32Array`（網格 head 與實體 next）的高效空間雜湊，提供 $O(1)$ 碰撞候選查詢。

### 遊戲邏輯系統處理器 (`src/systems/`)
- [`src/systems/CollisionSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/CollisionSystem.ts)：窄相位圓形碰撞、高速子彈掃掠防穿透（Swept CCD）、M8 子彈互相相消偏轉、撞擊衝量與每 tick 扣血。
- [`src/systems/FireSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/FireSystem.ts)：砲管冷卻計時、多砲管交替/同步開火、後座力衝量注入、口徑半徑對齊與子彈生成。
- [`src/systems/LevelingSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/LevelingSystem.ts)：經驗分數結算、等級提升、升級點數發放、轉職條件檢測與跨級連升觸發。
- [`src/systems/RegenSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/RegenSystem.ts)：坦克生命自然恢復與 30 秒無傷觸發的 Hyper-Regen 急速回血處理。
- [`src/systems/ShapeSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/ShapeSystem.ts)：維護 500+ 幾何形狀（方塊、三角、五邊形）的分區生成、慢速漫遊漂移與定額補位。
- [`src/systems/SpawnSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/SpawnSystem.ts)：管理玩家與 AI 重生機制（折半等級重生、最大最小距離全圖分散選點、無敵護盾）。

### 人工智慧決策機器人 (`src/ai/`)
- [`src/ai/AISystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/AISystem.ts)：AI 核心決策有限狀態機（打怪、戰鬥、撤退、遊蕩），整合 M8 CPA 彈幕攔截、M9 四大人設、切線避障與弱肉強食戰力差威懾逃退。
- [`src/ai/aiPersonas.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiPersonas.config.ts)：4 大 AI 人設（Newbie、Aggressor、Tactician、Apex）定義、代表色（`PERSONA_COLORS`）與性格參數。
- [`src/ai/aiGenome.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiGenome.ts)：可訓練戰術基因組架構，包含 5 向量權重、撤退曲線、目標切換慣性與突變算子。
- [`src/ai/aiTactics.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiTactics.ts)：各職業專屬戰術配置（狙擊風箏距離、衝鋒壓制、預判引導射擊權重）。
- [`src/ai/botNames.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/botNames.config.ts)：原汁原味 diep.io 風格的 100+ 機器人名冊。

### 扁平數據模型 (`src/entities/`)
- [`src/entities/Tank.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Tank.ts)：坦克扁平數據模型（座標、速度、插值前座標、角度、生命、等級、職業定義、輸入指令、人設標記）。
- [`src/entities/Bullet.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Bullet.ts)：子彈實體（位置、速度、傷害、耐久血量、半徑、壽命 ticks、顏色、平滑漸逝進度）。
- [`src/entities/Shape.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Shape.ts)：幾何形狀實體（多邊形種類、生命值、碰撞傷害、質量、旋轉角與經驗值）。
- [`src/entities/Particle.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Particle.ts)：粒子實體（爆破飛濺殘片、顏色、縮放衰減與壽命倒數）。

### 繪製與表現層 (`src/rendering/`)
- [`src/rendering/Renderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/Renderer.ts)：Pixi.js v8 Application 初始化，管理 `WorldContainer` 與 `HUDContainer` 視窗縮放。
- [`src/rendering/TankRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/TankRenderer.ts)：單體坦克視覺繪製（圓形底座、單管/多管幾何、外擴喇叭口、砲管射擊後座力縮放）。
- [`src/rendering/MultiTankRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/MultiTankRenderer.ts)：多坦克管理池渲染器，支援玩家與所有 AI 坦克平滑轉向插值（`lerpAngle`）與名稱顯示。
- [`src/rendering/BulletRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/BulletRenderer.ts)：四規格超取樣共用貼圖（Small / Normal / Large / Huge）Sprite 池，確保任何半徑下邊框恆定 3.0px 且零模糊。
- [`src/rendering/ShapeRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/ShapeRenderer.ts)：幾何多邊形預烘培共用貼圖 Sprite 池渲染器，支援自轉動畫與邊界剔除。
- [`src/rendering/ParticleRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/ParticleRenderer.ts)：爆炸與子彈碰撞火花粒子 Sprite 池渲染器。
- [`src/rendering/HealthBarRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/HealthBarRenderer.ts)：世界層動態血條，掛載於 `WorldContainer` 並與實體共用插值座標，杜絕抖動。
- [`src/rendering/GridRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/GridRenderer.ts)：背景網格貼圖層與地圖邊界深灰色陰影表現。
- [`src/rendering/AiGizmoRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/AiGizmoRenderer.ts)：調試專用 AI 視野圓環、目標鎖定紅線與前進走位綠線視覺化。
- [`src/rendering/culling.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/culling.ts)：手動視錐剔除純函式 `isInBounds`，安全取代 Pixi 內建 Culler。
- [`src/rendering/getRenderPosition.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/getRenderPosition.ts)：零配置插值座標計算器 `(prev + (cur - prev) * alpha)`。

### 使用者介面 (`src/ui/`)
- [`src/ui/HUD.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/HUD.ts)：整合管理所有掛載於 `HUDContainer` 的 Canvas 內嵌 UI 元件與響應式重排。
- [`src/ui/StatUpgradePanel.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/StatUpgradePanel.ts)：左下角 8 項屬性升級面板（進度條、快捷鍵標籤 `[1]~[8]`、點擊升級按鈕）。
- [`src/ui/ScoreBar.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/ScoreBar.ts)：底部中央等級、目前分數與平滑動畫經驗進度條。
- [`src/ui/MiniMap.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/MiniMap.ts)：右下角世界雷達小地圖，標示 4000x4000 邊界與玩家/AI 即時點位。
- [`src/ui/Leaderboard.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/Leaderboard.ts)：右上角前 10 名即時排行榜（分數遞減排序、高光標記玩家）。
- [`src/ui/EvolutionPanel.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/EvolutionPanel.ts)：左上角轉職卡牌 Deck（動態自轉 3D 預覽卡牌、`Ignore` 灰色長方按鈕與靠近展開）。
- [`src/ui/GameOverModal.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/GameOverModal.ts)：死亡結算彈窗（擊殺者、得分、存活時間、擊殺數、一鍵重生按鈕與 Enter 鍵綁定）。
- [`src/ui/KillToast.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/KillToast.ts)：擊殺敵方坦克時的漂浮擊殺通知。
- [`src/ui/FreeCamBanner.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ui/FreeCamBanner.ts)：自由相機頂部提示橫幅與一鍵退出按鈕（僅在開發與自由相機啟動時渲染）。

### 遊戲數值設定 (`src/config/`)
- [`src/config/constants.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/constants.ts)：時鐘真值（`SIM_TICK_RATE = 25`）、物理參數、渲染尺度、M8 子彈相消係數、M9 避障前瞻與 `TODO(tune)` 可調常數。
- [`src/config/levels.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/levels.config.ts)：原版 Lv 1 ~ Lv 45 經驗升級查表與 33 點技能發放邏輯。
- [`src/config/stats.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/stats.config.ts)：原版 8 項屬性加點非線性換算公式與等級尺寸成長係數。
- [`src/config/tanks.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/tanks.config.ts)：全遊戲 21 款坦克職業定義 (Tier 1~4)、轉職拓撲樹、砲管配置、射速、散射與後座力。

### 除錯與沙盒工具 (`src/debug/`)
- [`src/debug/DebugOverlay.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/debug/DebugOverlay.ts)：僅在 `DEV` 載入的除錯面板（按 `` ` `` 鍵切換），支援即時性能監控、一鍵加分/升級/轉職、自由相機、無敵模式、生成 AI、決鬥沙盒與壓力測試。
- [`src/debug/AgentTestInterface.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/debug/AgentTestInterface.ts)：供 Agent 與除錯面板使用的自動化測試靶機與 AI vs AI 雙人決鬥沙盒驅動介面。

---

## 2. 核心原則 (Golden Rules)

1. **里程碑紀律與維護規範 (Milestone & Maintenance Discipline)**：
   - 專案已通過 M1 ~ M9 核心里程碑驗收，並建立正式玩家版分支（`release/player-edition`）。後續新功能、擴充與維護仍須維持高標準：變更前先釐清範疇、新增對應單元測試、實機驗證。
   - **收尾執行 `/verify-milestone`**：每次重大里程碑或版本發布結尾必須執行驗收流程，依其步驟進行完整自動檢查、熱路徑掃描、browsermcp 瀏覽器操作與視覺驗收、驗收清單核對與 commit 規範檢查，並回報給使用者。
2. **零程式碼確認期 (Plan-First Rule)**：
   - 未獲使用者明確「確認開始實作」指令前，不得生成或修改任何專案程式碼檔案。
3. **無伺服器與純前端 (Pure Client-Side)**：
   - 本專案為單一專案、純前端瀏覽器應用。禁止引進需要後端 Node.js 常駐服務運行的架構；所有遊戲迴圈、自研物理、AI 與 UI 均在瀏覽器前端執行。
4. **原版數值與時鐘單一真值 (Authentic Stats & Single Clock Source)**：
   - 所有遊戲數值與公式以原版 diep.io（`diepio.fandom.com/wiki/Stats` 等）為準。已查證數值寫入 `src/config/` 並**在註解中註明實際開啟驗證過的來源 URL 與原文**；查不到的數值必須在 `src/config/constants.ts` 設為具名常數並標註 `TODO(tune)`（註明「未查證」），透過 `DebugOverlay` 提供即時調整，**嚴禁無標記地自行編造數值**。
   - 固定步長模擬頻率（25 ticks/秒）只定義在 `src/config/constants.ts` 的單一常數 `SIM_TICK_RATE = 25`，所有以 tick 為單位的數值皆由它換算，**禁止硬編碼 `0.04`**。
   - 職業階層命名統一採用原版：**Tier 1 (Lv 1)**、**Tier 2 (Lv 15)**、**Tier 3 (Lv 30)**、**Tier 4 (Lv 45)**，型別固定為 `tier: 1 | 2 | 3 | 4`，禁止出現「一階／二階／三階／四階」混用。
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

## 3. 程式碼規範與型別標準 (Coding & TypeScript Standards)

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

## 4. 效能與記憶體管理鐵律 (Performance & Zero-GC Rules)

遊戲支援 **120+ FPS** 高刷顯示器（25 TPS 模擬 + 插值）與 **500+ 形狀 / 600+ 子彈高密度交火**，所有 Agent 必須遵守以下效能規範：

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

---

## 5. M1 ~ M6 歷次實戰踩坑與避坑紅線總表 (Post-Mortem & Anti-Regression Redlines)

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

### E. 數值查證、測試與終端操作紅線 (Authentic Data, Testing & Shell)

13. **【紅線 13】嚴禁編造 Wiki 出處連結與移除壓力測試硬性耗時斷言**：
    - **避坑規範**：所有數值以原版 diep.io 為準。未查證項目必須在 `src/config/constants.ts` 設為具名常數並標註 `TODO(tune)`（註明「未查證」）；`stress.test.ts` 僅驗證零崩潰與輸出基準數據，禁止設定硬性毫秒斷言。
14. **【紅線 14】Windows PowerShell 語法與多行 Commit 提交規範**：
    - **避坑規範**：Windows PowerShell 5.1 不支援 `&&` 指令串接符號，一律改用 `;` 或分行執行；多行 commit 訊息必須寫入暫存檔後以 `git commit -F <file>` 提交。

### F. M8/M9 子彈相消、AI 決策深化與正式發布版紅線 (M8/M9 Deepening & Release Guardrails)

15. **【紅線 15】子彈相消動量守恆與視錐攔截約束（Bullet Clashing & Interception Cone - M8 凍結紅線）**：
    - **踩坑歷史**（M8 Commit `e8b150c`）：初期 AI 只要感知到任何來襲流彈即強制擺動砲管嘗試抵消，導致面對多管散彈時砲口劇烈抽搐、完全無法瞄準敵方坦克本體。
    - **避坑規範**：
      - 普通子彈（`radius < 18`）100% 依靠側身橫移（`evadeX/evadeY`）閃身規避，砲管維持鎖定敵方坦克。
      - 僅當偵測到巨型致命重砲彈（`radius >= 18`，如 Destroyer/Annihilator）且彈道落於正前方最大夾角 $\pm 0.62\text{ rad}$（約 35.5 度）視錐內時，才允許觸發短暫攔截鎖定（`AI_INTERCEPT_LOCK_TICKS = 4`），快速點射相消後立即回歸對人。
16. **【紅線 16】防牆角力場抵消死鎖與障礙切線滑動（Wall-Corner & Obstacle Tangent Sliding - M8/M9 凍結紅線）**：
    - **踩坑歷史**（M8 Commit `78edece` & M9 Commit `cb0ea69`）：撤退力場（$5.94\times$）與地圖邊界或幾何形狀排斥力反向對沖時，向量直接抵消為 0，導致坦克被逼至死角原地定格受死；逃跑時也常因大馬力後撤正對五邊形而自撞扣血。
    - **避坑規範**：
      - 當後撤向量與邊界排斥向量劇烈對立（$\text{dot} < -0.5$）或與障礙避障向量對立（$\text{dot} < -0.2$）時，**嚴禁硬撼對撞**，必須將後撤力投影偏轉為沿邊界或障礙物之**切線向量**滑動繞行，並依 `aiStrafeDirection` 保持時間連續性。
17. **【紅線 17】AI 人設瞄準隨機誤差取樣維持（Aim Noise Sample-Holding - M9 凍結紅線）**：
    - **踩坑歷史**（M9 Commit `2cf44c0`）：若每 tick 隨機抽樣高斯雜訊並疊加至瞄準角度，會導致砲管呈現高頻微顫（Micro-jitter），視覺嚴重破圖且失去擬人真實感。
    - **避坑規範**：瞄準角雜訊偏移（`aiNoiseOffset`）嚴格僅在決策刷新週期（2~8 ticks，依人設 `reactionIntervalTicks`）或切換目標時抽樣一次並保持穩定，其餘時間砲管旋轉平滑過渡，嚴禁每 tick 重抽樣。
18. **【紅線 18】定向逃逸時間維持緩衝（Escape Heading Stabilization 75 Ticks - M9 凍結紅線）**：
    - **踩坑歷史**（M9 Commit `cb0ea69`）：AI 逃跑時一旦敵人剛脫離視野邊緣（`PERCEPTION_RADIUS`），狀態機立即跳回 `farming`，導致 AI 掉頭回跑送死，反覆抽搐。
    - **避坑規範**：敵人脫離視野後，AI 必須強制維持 75 ticks（3.0 秒，`AI_ESCAPE_MAINTAIN_TICKS`）定向逃逸，並安靜趕路（`shooting = false`）加速自然回血，建立安全距離緩衝區後才安全回歸農怪。
19. **【紅線 19】弱肉強食實力差距威懾逃退（Combat Power Disparity Intimidation Retreat - M9 凍結紅線）**：
    - **踩坑歷史**（M9 Commit `bd79ebc`）：滿血低階/低等級 AI（如 Lv 1 Basic Tank）遭遇高階霸主（如 Lv 30 Destroyer）時，因自身血量 100% 而判定為 `engaging`，迎面送頭被一砲秒殺。
    - **避坑規範**：實時計算綜合戰鬥力 $P = \text{level} \times 1.0 + (\text{tier} - 1) \times 8.0 + \frac{\text{hp}}{\text{maxHp}} \times 6.0$。當 $(\Delta P \times \text{persona.intimidationSensitivity}) \ge \text{AI\_INTIMIDATION\_POWER\_DIFF\_THRESHOLD}$（$15.0$）時，弱小 AI 即使 100% 滿血亦必須立即主動避退，進入 `retreating` 狀態。
20. **【紅線 20】正式玩家發布版純淨隔離規範 (Player Release Edition Isolation)**：
    - **發布分支約束**：`release/player-edition` 分支作為終端玩家版本，必須嚴格隔離所有開發與測試工具：
      - `this.devOverlay = null`，完全不載入 `DebugOverlay`，按鍵 `` ` `` 與 `/` 禁用。
      - `isFreeCam = false`，解綁 `KeyC` 自由相機，禁用小地圖點擊跳轉，不渲染 `FreeCamBanner`。
      - 玩家開局與重生後預設 `isGodMode = false`，真實承受傷害與死亡，僅享有原版 3 秒 `invulnerableTicks` 護盾。
      - AI 決策預設 `ignorePlayer = false`，將玩家視為正式敵對目標展開真實攻防。

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
