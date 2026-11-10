---
name: verify-milestone
description: 執行專案完整靜態檢查、Vitest 單元測試，並透過 browsermcp 控制 Microsoft Edge 的 localhost 分頁進行 DebugOverlay 操作與視覺驗收。當使用者輸入 /verify-milestone 或要求驗收里程碑時觸發。
---

# 里程碑收尾與自動化驗收檢查 (Milestone Verification)

用法：在聊天輸入 `/verify-milestone <里程碑編號>`（例如 `/verify-milestone M3a`）。
這個流程專注於全面自動化驗證、除錯操作、視覺回報與 Commit 規範核對，不新增非相關功能；發現問題只能在本里程碑範疇內修正。

## 執行步驟

### 第一階段：目標確認與代碼庫狀態
1. **確認里程碑編號**：從使用者訊息取得（M1、M2、M3a、M3b、M4a、M4b、M5、M6），沒有就詢問，不要猜。
   閱讀 `PLAN.md` 中該里程碑的「驗收標準」與「完成條件」，再加上使用者同一則訊息或前一則指令中額外列出的檢查項目，合併成本次的驗收清單。
2. **Git 工作區檢查**：執行 `git branch --show-current` 與 `git status --short`。
   若有未提交的變更，先完成後續驗證步驟，全部通過後才依 Commit 規範提交；檢查未通過前不得提交。

### 第二階段：終端機靜態與單元測試
3. **型別檢查**：執行 `npm run typecheck`。
4. **單元測試**：執行 `npm test`。記下測試檔數與測試總數，與上一個里程碑回報的數量比較，確認沒有退化；測試數減少必須說明原因。
5. **程式碼風格與 Linter**：執行 `npm run lint`（Biome 檢查，強制 `noExplicitAny`）。
6. **生產建置與 Tree-Shaking 檢查**：執行 `npm run build`，再執行：
   `Select-String -Path dist\assets\*.js -Pattern 'DebugOverlay|DEBUG PANEL' -List`
   無輸出代表正式建置不含 Debug 程式碼；有輸出代表 Tree-Shaking 失敗，必須修正。
   *若步驟 3 到 6 有任何一項失敗，立即修復代碼直到全數通過，不得跳過或回報成功。*

### 第三階段：熱路徑與數值盤點
7. **熱路徑零配置 (Zero-Allocation) 掃描**：執行：
   `Select-String -Path src\systems\*.ts,src\physics\*.ts,src\core\GameLoop.ts,src\core\FixedStepper.ts,src\core\ObjectPool.ts -Pattern '\.map\(|\.filter\(|\.forEach\(|\.reduce\(|Array\.from|Object\.(keys|values|entries)|\.\.\.'`
   逐一檢視命中處：在 tick（25 TPS）或渲染熱路徑內的必須改用標準 `for` 迴圈並複用結構；不在熱路徑的（如初始化、一次性設定）在報告中註明理由。本里程碑若新增了其他熱路徑模組，一併納入掃描。
8. **TODO(tune) 常數盤點**：執行：
   `Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern 'TODO\(tune\)'`
   整理完整清單，並標出本里程碑新增或變更的項目。
9. **來源核對 (Authentic Stats Source)**：本里程碑新增或變更的每個原版數值或公式都要列出來源：
   - 必須在本次工作中實際開啟過該頁面，才可標「已查證」，並附原文一句（逐字複製，不改寫、不翻譯）與連結。
   - 沒開過頁面或找不到原文，一律標「未查證」，並確認該常數有 `TODO(tune)` 與註解。
   - 不得編造出處，不得把推算值當成原文。

### 第四階段：連接 Edge (`browsermcp`) 自動化遊戲功能與視覺驗收
10. **連接 Edge、前景分頁激活與 Console 狀態檢查**：
    - 調用 `browsermcp`（指令 `tab list` 找出 `localhost` 遊戲分頁，**務必執行 `tab select <id>` 將分頁切換至前景**，避免背景分頁遭瀏覽器節流至 1 FPS）。
    - 執行 `console` 讀取當前連線的 `localhost` 分頁訊息，確認無 Runtime Error 或 Pixi.js 警告。
11. **自動化遊戲功能操作、存活狀態確認、動態取樣與視覺驗收**：
    - **確保玩家存活與清除結算遮罩（強制前置步驟）**：
      - 開始操作或截圖前，必須先透過單行 `eval` 開啟無敵模式（`window.__game.devOverlay.isGodMode = true`），並呼叫 `window.__game.hud.gameOverModal.triggerRespawn()`（**嚴禁只呼叫 `respawnPlayer()` 導致 `GameOverModal` 結算遮罩殘留於畫面中央**），確認 `playerTank.active === true` 且 `hud.gameOverModal.container.visible === false`。
      - 驗收世界實體（坦克、砲管、子彈、血條）畫面時，應隱藏 `DebugOverlay` 與 `EvolutionPanel`，避免遮擋畫面中央的坦克與彈道。
    - 依據當前里程碑進行對應的除錯功能模擬操作：
      - **M1/M2/M3**：確認 500 形狀生成 (`Fill Shapes`)、血條顯示、射擊子彈與物理推擠正常。
      - **M4a/M4b**：模擬點擊升級按鈕（`Level 15 (787)` / `Level 30 (6184)`）或切換職業，驗證 `EvolutionPanel` 轉職卡牌彈出、跨級連升連續彈出、砲管渲染幾何與相機 FOV 變化。
      - **M5/M6**：模擬點擊生成 AI 坦克、啟動 600 子彈壓力測試，檢視同屏戰鬥穩定度。
    - **動態多 Tick 連續取樣監控**：
      - 涉及 AI 決策、砲管旋轉平滑度、狀態轉換、開火窒息或物理碰撞時，必須透過單行 `eval` 連續抽樣 20~50 個 ticks（40ms/tick）的實體數據序列（`state`, `shooting`, `rotation`, `hp`），斷言無狀態乒乓閃爍、無停火盲漂、無角度瞬移。
    - **實機截圖、`read_file` 肉眼自檢與 Artifact 存證**：
      - 調用 `screenshot` 工具取得 Canvas 與 HUD 實體畫面截圖。
      - **強制自檢**：每次 `screenshot` 後，Agent **必須立即呼叫 `read_file` 讀取該截圖影像檔**，親眼確認畫面並非停留在 `GAME OVER` 結算畫面、目標坦克與子彈清晰可見、描邊維持恆定 ~3.0px 且無模糊失真。
      - 確認無誤後，將截圖複製至 Artifact 目錄（`C:\Users\<user>\.gemini\antigravity\brain\<conv_id>\...`），並嵌入收尾報告作為客觀視覺證據。
      - 確認畫面渲染、HUD 面板位置、血條層疊與前景分頁下的 FPS / TPS 數據表現（目標 120+ FPS，25 TPS）。

### 第五階段：逐條驗收與 Commit 規範核對
12. **逐條驗收**：對步驟 1 的清單每一項給出狀態與佐證：
    - **已自動驗證**：指出對應的測試名稱、指令輸出或 `browsermcp` 截圖/Console 證據。
    - **需人工驗收**：僅限需要實際肉眼極限感受（如細微操作手感）。`browsermcp` 截圖與控制已覆蓋的部分直接列為自動驗收。
    - **未通過**：詳細說明失敗原因與待修復項目。
    - 檢查：本里程碑新增的實體或功能，是否已在 `DebugOverlay` 提供對應的除錯按鈕或調參功能。
13. **Commit 規範檢查**：執行 `git log --oneline -20`，確認本里程碑所有 commit：
    - 格式為 `<type>(<scope>): <description>`；type 嚴格限定為 `feat|fix|refactor|perf|test|docs|build|chore|style`。
    - description 為英文、祈使句、小寫開頭、結尾無句號、不超過 72 字元。
    - 含有 footer `Refs: <里程碑編號>`（docs 與 chore 類可例外）。
    - 每個 commit 單獨均能通過 `typecheck`、`test` 與 `lint`。
    - 若有尚未提交的變更，在此依上述規範提交。

### 第六階段：報告輸出與停止確認
14. **依標準格式輸出收尾報告**：不得省略任何段落，無內容項目填寫「無」。
15. **立即停止等待確認**：報告輸出後立即停止，嚴禁在未獲得使用者確認指令前擅自推進至下一個里程碑。

## 報告格式

~~~
# <里程碑編號> 收尾報告

## 1. Commit 紀錄
（git log --oneline 輸出，並註明 commit 規範檢查結果）

## 2. 自動檢查結果
| 檢查 | 結果 | 備註 |
（typecheck / test（檔案數、測試數、與上次比較）/ lint / build / dist 無 Debug 字串 / 熱路徑掃描）

## 3. 瀏覽器自動化與視覺驗收 (browsermcp)
| 檢查項目 | 狀態 | 觀察結果 / 截圖證據 |
（Console Logs 狀態 / DebugOverlay 功能測試 / Canvas 渲染與 FPS、TPS / 視錐剔除與物件池）

## 4. 驗收清單
| 項目 | 狀態 | 證據 |
（狀態僅限：已自動驗證 / 需人工驗收 / 未通過）

## 5. 來源核對表
| 常數或公式 | 數值 | 狀態（已查證 / 未查證） | 原文一句 | 連結 |

## 6. TODO(tune) 清單
（本次新增或變更的項目：名稱、起始值、理由；其餘只列名稱）

## 7. 與 PLAN.md 的偏離與需要使用者決定的事項

## 8. 手動驗收步驟
（使用者要做什麼、預期看到什麼）

## 9. 數據性質說明
（凡出現數字，註明是實測、推算或估計；效能數據註明只含 CPU 模擬或渲染更新，是否包含 GPU）
~~~

## 注意事項
- 不得新增未經許可的套件，不得更動 PLAN.md 的範疇；需要調整就列在報告第 7 段。
- 不得把沒有實際執行或量測的結果寫成已完成。
- 熱路徑維持零配置：事件 emit、迴圈內不得建立物件或閉包。
