---
name: tank-class-builder
description: 標準化新增或修改 M4a (Tier 2) 與 M4b (Tier 3) 坦克職業、砲管幾何渲染、相機 FOV、轉職樹與單元測試。當開發 M4a 或 M4b 職業時觸發。
---

## 執行步驟
1. **更新 `tanks.config.ts`**：
   - 嚴格定義 `tier: 1 | 2 | 3`、`parentClassId`、`requiredLevel` (Tier 2 為 15，Tier 3 為 30) 與 `evolutions` 陣列。
   - 配置各砲管 (Barrel) 的幾何與射擊參數：相對角度 (`angleOffset`)、縱向/橫向偏移、喇叭口寬度 (`tipWidth`)、散射角 (`spread`)、開火相位延遲 (`fireDelayRatio`，如 Twin 交替開火為 `0` 與 `0.5`)、後座力乘數與相機 `fov`（如 Sniper `1.111`、Assassin `1.25`）。
2. **處理轉職面板與自動進化邏輯**：
   - M4a (Lv 15, 787 分)：當候選進化職業 `> 1` 時，觸發左上角 `EvolutionPanel` 顯示卡牌。
   - M4b (Lv 30, 6184 分)：受 `ENABLE_TIER3_CHOICE = false` 控制，若單一父職業僅對應唯一候選職業，不彈出面板，直接自動進化並渲染進化提示文字。
3. **擴充 `DebugOverlay`**：
   - 在 `DebugOverlay` 的職業切換選單中註冊新職業，確保開發環境下可一鍵強制切換。
4. **撰寫與執行測試**：
   - 更新 `tanks.config.test.ts` 驗證職業樹拓撲結構與屬性倍率。
   - 執行 `npm run typecheck && npm test && npm run lint`。
