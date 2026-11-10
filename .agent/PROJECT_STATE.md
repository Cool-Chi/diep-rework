# PROJECT_STATE.md - 專案狀態快照與交接備忘 (M1 ~ M6 完工)

> **建立時間**：2026-11-11  
> **當前狀態**：M1 至 M6 核心里程碑已全數通過實機自主驗收，功能完整、架構穩定、測試全過。  
> **適用對象**：接續開發新對話視窗的 AI Agent 或工程師，可直接基於本文件銜接後續擴充工作。

---

## 1. 專案核心架構總覽 (Architecture Overview)

- **執行環境**：純前端、All-in-Canvas、無伺服器架構（Vite + TypeScript Strict + Pixi.js v8）。
- **時鐘單一真值**：固定模擬步長 `SIM_TICK_RATE = 25` TPS（每 tick 40ms，`FixedStepper` 累加時間並計算每幀平滑渲染插值 `alpha`）。
- **世界尺度基準**：1 網格 = 25 單位，Lv 1 坦克半徑 = 25 單位（直徑 50 單位 = 2 格寬），地圖範圍 4000×4000。
- **熱路徑零垃圾收集 (Zero-GC)**：
  - 模擬與渲染迴圈嚴禁 `new` 物件、閉包與陣列解構。
  - 500+ 形狀、600+ 子彈與 1024 粒子全面池化（`ObjectPool`）。
  - 碰撞粗篩採用基於 `Int32Array` 的空間雜湊（`SpatialHash`）。
- **品質防線**：27 個測試檔案、129 個 Vitest 單元測試 100% 通過，Biome Linter 0 錯誤，正式建置（`npm run build`）完全 Tree-shaking 剔除 `DebugOverlay`。

---

## 2. 現有 9 款坦克職業清單與配置矩陣 (Tank Classes Matrix)

所有職業定義於 [`src/config/tanks.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/tanks.config.ts)，目前已實作原版 Tier 1 ~ Tier 3 坦克拓撲樹：

```
Tier 1 (Lv 1)                  Tier 2 (Lv 15)                  Tier 3 (Lv 30)
─────────────                  ──────────────                  ──────────────
                               ┌─ Twin ───────────────────────┬─ Triple Shot
                               │                              └─ Twin Flank
Basic Tank ────────────────────┼─ Sniper ──────────────────────── Assassin
                               ├─ Machine Gun ─────────────────── Destroyer
                               └─ Flank Guard ─────────────────── Twin Flank
```

### 職業詳細參數矩陣：

| 職業 ID | 階層 | 名稱 | 解鎖等級 | 砲管幾何 (寬×長) | 特殊幾何與角度 | 裝填乘數 | 傷害乘數 | 貫穿乘數 | 速度乘數 | 子彈半徑 | 壽命 (ticks) | FOV 倍率 | 轉職後繼清單 |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `basic` | 1 | Basic Tank | 1 | 18 × 38 | 基準單管 | 1.0x | 1.0x | 1.0x | 1.0x | 9.0 | 75 | 1.000 | `twin`, `sniper`, `machine_gun`, `flank_guard` |
| `twin` | 2 | Twin | 15 | 18 × 38 | 雙管平行 ($\pm 10\text{px}$) | 1.0x | 0.65x | 0.9x | 1.0x | 8.1 | 75 | 1.000 | `triple_shot`, `twin_flank` |
| `sniper` | 2 | Sniper | 15 | 18 × 48 | 長身管單管 | 1.5x | 1.15x | 1.0x | 1.25x | 9.0 | 105 | 1.111 | `assassin` |
| `machine_gun` | 2 | Machine Gun | 15 | 18(根) ~ 26(口) × 34 | 外擴喇叭口 (0.20 rad 散射) | 0.5x | 0.70x | 1.0x | 0.90x | 9.0 (統一) | 65 | 1.000 | `destroyer` |
| `flank_guard` | 2 | Flank Guard | 15 | 前 18×38 / 後 18×30 | 前後反向 ($0$ 與 $\pi$) | 前後各 1.0x | 前後各 1.0x | 1.0x | 1.0x | 9.0 | 75 | 1.000 | `twin_flank` |
| `triple_shot` | 3 | Triple Shot | 30 | 18 × 38 | 三管扇形 ($0, \pm 0.785\text{ rad}$) | 1.0x | 0.70x | 1.0x | 1.0x | 9.0 | 75 | 1.000 | 無 (上限) |
| `assassin` | 3 | Assassin | 30 | 18 × 56 | 超長狙擊砲身管 | 2.0x | 1.40x | 1.1x | 1.50x | 9.0 | 125 | 1.250 | 無 (上限) |
| `destroyer` | 3 | Destroyer | 30 | 36 × 36 | 巨型口徑身管 (後座力 3.5x) | 3.25x | 3.50x | 2.0x | 0.75x | 18.0 (巨彈) | 70 | 1.000 | 無 (上限) |
| `twin_flank` | 3 | Twin Flank | 30 | 18 × 38 (4 根) | 前雙管 + 後雙管平行 | 1.0x | 0.65x | 0.9x | 1.0x | 8.1 | 75 | 1.000 | 無 (上限) |

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

---

## 4. 留存的 `TODO(tune)` 數值調校常數索引表

以下常數因原版 Wiki 未公開公式或屬於操作手感參數，已在 [`src/config/constants.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/constants.ts) 中標準化為具名常數並註明 `TODO(tune)`，均可透過 `DebugOverlay` 的即時滑桿直接調整：

| 檔案位置 | 常數名稱 | 當前數值 | 物理 / 遊戲性含義 | 調校建議與影響 |
| :--- | :--- | :--- | :--- | :--- |
| `src/config/constants.ts:65` | `CAMERA_FOV_PER_LEVEL` | `0.005` | 每升 1 級相機額外擴大之視野比例 | 影響高階坦克的視野開闊度 (Lv 30 約 +14.5%) |
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
| `src/config/constants.ts:183` | `BASE_RECOIL_FORCE` | `0.5` | 基準砲管開火施加於坦克之反推力衝量 | Destroyer 會乘以 3.5 倍產生強烈後座力 |
| `src/config/constants.ts:202` | `SHAPE_RADII` | `[14, 16, 26]` | 方塊 / 三角 / 五邊形碰撞半徑 | 影響與形狀貼身肉搏撞擊體積 |
| `src/config/constants.ts:211` | `SHAPE_BASE_DRIFT` | `0.25` | 幾何形狀漫遊速度上限 | 決定野外刷怪場的動態漂移活躍度 |
| `src/config/constants.ts:230` | `HEALTHBAR_OFFSET_FACTOR`| `1.6` | 動態血條相對於實體底緣的垂直偏移倍率 | 確保血條不與坦克底座或多邊形重疊 |
| `src/config/constants.ts:236` | `HEALTHBAR_WIDTH_FACTOR` | `1.4` | 動態血條寬度相對於半徑的縮放比例 | 隨實體大小等比例寬縮 |

---

## 5. 後續擴充開發標準切入點指南 (Extension Playbook)

### 模式 A：新增 Tier 4 坦克職業 (Lv 45)
1. **設定資料**：開啟 [`src/config/tanks.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/tanks.config.ts)，在 `TankClassId` 型別中新增鍵值（如 `booster`, `ranger`, `overlord`, `annihilator` 等）。
2. **定義幾何與砲管**：呼叫技能 `/tank-class-builder`，指定 `tier: 4`、`requiredLevel: 45`、各砲管尺寸、相對角度、開火相位與相機 FOV（如 Ranger 為 `1.428`）。
3. **註冊進化樹**：將新職業 ID 加入其前置 Tier 3 坦克的 `evolutions` 陣列中。
4. **DebugOverlay 註冊**：在 [`src/debug/DebugOverlay.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/debug/DebugOverlay.ts) 的快捷職業按鈕列表中新增一鍵切換按鈕。
5. **單元測試**：在 `tests/tanks.config.test.ts` 中驗證拓撲連結性。

### 模式 B：新增特殊幾何形狀（如 Alpha Pentagon 或 Crasher）
1. **實體型別**：在 [`src/entities/Shape.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Shape.ts) 的 `ShapeType` 加入 `alpha_pentagon` 或 `crasher`。
2. **數值與生成**：在 [`src/config/constants.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/constants.ts) 加入其專屬半徑、HP、經驗值，並在 [`src/systems/ShapeSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/ShapeSystem.ts) 加入地圖中央「五邊形巢穴（Nest）」的聚集生成規則。
3. **貼圖渲染**：在 [`src/rendering/ShapeRenderer.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/rendering/ShapeRenderer.ts) 預先烘培高解析度貼圖並註冊入 Sprite 池。

### 模式 C：新增陣營與隊伍模式（Teams / 2-Teams / 4-Teams）
1. **實體欄位**：在 `Tank` 與 `Bullet` 增加 `teamId: number`（0 為中立/個人，1~4 為藍紅綠紫隊伍）。
2. **同隊碰撞過濾**：在 [`src/systems/CollisionSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/CollisionSystem.ts) 加上 `if (a.teamId === b.teamId) return;`（子彈不傷隊友、同隊坦克僅推開不扣血）。
3. **基地保護區**：在 [`src/systems/SpawnSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/SpawnSystem.ts) 劃分角落基地座標，並在基地內部署基地無敵防禦三角箭頭。
