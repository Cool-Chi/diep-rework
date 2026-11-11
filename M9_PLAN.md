# Milestone 9 (M9)：AI 擬真戰場生態與多紀元自主演化訓練計畫

> **專案檔案位置**：`M9_PLAN.md` (diep-rework 專案根目錄)  
> **基底版本**：M8 完整封裝 (`v1.3.0-m8-complete`)  
> **狀態**：基礎建設完工、單元測試 182 項 100% 通過、靜態型別與 Linter 零錯誤。

---

## 1. 核心目標 (Core Objectives)

在 M8 確立之 8000x8000 世界地圖、9.2 基礎彈速、`1.2 + 1.1*p` 子彈耐久、750/950 感知半徑、±35.5° (`0.62 rad`) 前向攔截視錐與 0% Aim Jitter 向量混合底座上，推進以下四大升級：
1. **AI 強弱人設分層與真實配點流派 (`src/ai/aiPersonas.config.ts`, `src/ai/aiTactics.ts`)**：
   - 4 種真人玩家階層（Newbie 40% / Aggressor 25% / Tactician 25% / Apex 10%），槽位固定綁定、重生重抽技巧抖動參數。
   - 解決廢角問題：配點由「職業查表」決定，所有人設套用 `minStatFloor` 最低保障點數，杜絕零穿透/零裝填。
   - 擬人化行為差異：反應間隔（2~8 ticks）、瞄準誤差（Apex 0.02 rad ~ Newbie 0.14 rad）、殘血勸架（Third-partying）與多敵包夾規避意識。
   - **防抖重要但書**：Aim Noise 嚴禁每 tick 重新抽樣！僅在 `reactionIntervalTicks` 決策刷新時抽樣一次並保持穩定，保護 0% Aim Jitter。
   - **後座力趕路職業合理性限制**：
     * `rear`（Tri-Angle / Booster / Fighter）：自帶背向砲管，朝前進方向瞄準直接推進。
     * `backfire`（Destroyer / Annihilator / Machine Gun / Penta Shot）：高後座力職業且確認近身無敵方威脅時轉向背後推進。
     * `none`（Sniper / Assassin / Hunter / Ranger / Predator / Basic 等）：狙擊系絕對禁止為趕路轉向背後。
2. **保護 M8 零抖動紅線的可訓練戰術基因組 (`src/config/aiGenome.json`, `src/ai/aiGenome.ts`)**：
   - 【M8 凍結紅線】：`AI_INTERCEPT_MAX_ANGLE = 0.62 rad`、`AI_INTERCEPT_LOCK_TICKS = 4`、邊界切線滑動邏輯不進入基因組。
   - 抽離 5 股向量力場權重（combat, retreat, farm, evade, border）、各職業分支交戰距離比（twin, sniper, machineGun, flank）、撤退曲線斜率與目標切換效用權重。
   - 內建 `sanitizeGenome` 安全 clamp，設定嚴格邊界（如 border 權重 ≥ 0.8、stickiness ≥ 1.15 防止換鎖抽搐）。
3. **確定性偽隨機數產生器 (`src/core/rng.ts`)**：
   - 實作輕量、零配置的 Mulberry32 PRNG，注入 `SpawnSystem`、`aiTactics` 與 `AISystem`，確保演化訓練場次 100% 可重現。
4. **雙階段無頭演化訓練器 (`tests/m9-evolution-trainer.test.ts`)**：
   - Stage A（微操篩選）：1200x1200 決鬥沙盒高速驗證出界率 0、對敵瞄準專注率 100%。
   - Stage B（FFA 大生態演化）：8000x8000 40 AI 長時模擬，以真實戰場健康度為適應度函數（Fitness Function），移動抖動率 > 1% 直接淘汰（Fitness 歸零）。
   - 自動匯出 `reports/m9-epoch-summary.json`。

---

## 2. 模組交付清單

| 檔案路徑 | 職責與變更內容 | 狀態 |
|---|---|---|
| [`src/core/rng.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/core/rng.ts) | 確定性 Mulberry32 PRNG (零配置、可注入、種子可重現) | 已完工 |
| [`src/ai/aiPersonas.config.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiPersonas.config.ts) | 4 種強弱人設定義、40/25/25/10 金字塔、保底點數與後座力趕路模式 | 已完工 |
| [`src/config/aiGenome.json`](file:///c:/Users/weiqi/Projects/diep-rework/src/config/aiGenome.json) | 可訓練戰術基因組基底 JSON | 已完工 |
| [`src/ai/aiGenome.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiGenome.ts) | 基因組解析、Clamp 防呆、向量轉換與 M8 凍結紅線防護 | 已完工 |
| [`src/ai/aiTactics.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/aiTactics.ts) | 注入 PRNG，依職業查表分配流派，落實 `minStatFloor` 最低保障點數 | 已完工 |
| [`src/entities/Tank.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/entities/Tank.ts) | 擴充 `persona`, `aiDecisionTimer`, `aiNoiseOffset`, `aiSkillJitter`, `aiRecoilBoost` 等狀態 | 已完工 |
| [`src/systems/SpawnSystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/systems/SpawnSystem.ts) | 注入 PRNG，槽位固定綁定人設，重生重抽技巧抖動 | 已完工 |
| [`src/ai/AISystem.ts`](file:///c:/Users/weiqi/Projects/diep-rework/src/ai/AISystem.ts) | 決策刷新節流、穩定 Aim Noise、殘血勸架、包夾規避、基因組向量混合與後座力趕路 | 已完工 |
| [`tests/rng.test.ts`](file:///c:/Users/weiqi/Projects/diep-rework/tests/rng.test.ts) | PRNG 重現性、分佈與高斯抽樣測試 (7/7 通過) | 已完工 |
| [`tests/aiPersonas.test.ts`](file:///c:/Users/weiqi/Projects/diep-rework/tests/aiPersonas.test.ts) | 40/25/25/10 分佈、保底點數防廢角、職業後座力限制測試 (4/4 通過) | 已完工 |
| [`tests/aiGenome.test.ts`](file:///c:/Users/weiqi/Projects/diep-rework/tests/aiGenome.test.ts) | 基因組 clamp 上下界、凍結紅線欄位防護、向量編解碼測試 (5/5 通過) | 已完工 |
| [`tests/m9-frozen.test.ts`](file:///c:/Users/weiqi/Projects/diep-rework/tests/m9-frozen.test.ts) | 0.62 rad / 4 ticks 攔截與牆角切線滑動回歸測試 (5/5 通過) | 已完工 |
| [`tests/m9-evolution-trainer.test.ts`](file:///c:/Users/weiqi/Projects/diep-rework/tests/m9-evolution-trainer.test.ts) | 雙階段無頭訓練器與報告匯出 (1/1 通過) | 已完工 |

---

## 3. 測試與驗收指標

- **Vitest 單元測試**：35 個測試檔案、182 項測試 100% 通過（`npx vitest run`）。
- **Biome Linter**：90 個檔案檢查無任何錯誤與警告（`npm run lint`）。
- **TypeScript 型別檢查**：嚴格型別檢查 0 錯誤（`npm run typecheck`）。
- **Headless Arena 量化指標**：
  * Stage A 微操決鬥：出界率 0 ticks、專注對敵瞄準率 100%。
  * Stage B 全圖 FFA：移動抖動率 < 0.3%（硬門檻 < 1.0%）、瞄準抖動率 0.00%（0% Jitter 紅線完美守住）、Apex vs Newbie K/D 顯著分層。
