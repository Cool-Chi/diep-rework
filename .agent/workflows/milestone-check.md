---
description: 里程碑收尾檢查（typecheck/test/lint/build、熱路徑掃描、逐條驗收、來源核對、TODO(tune)、commit 規範），輸出固定格式報告後停止。用法 /milestone-check M3a
---

# 里程碑收尾檢查

用法：在聊天輸入 /milestone-check <里程碑編號>，例如 /milestone-check M3a。
這個流程只做驗證與回報，不新增功能；發現問題只能在本里程碑範疇內修正。

## 步驟

1. 確認里程碑編號：從使用者訊息取得（M1、M2、M3a…），沒有就詢問，不要猜。
   閱讀 PLAN.md 中該里程碑的「驗收標準」與「完成條件」，再加上使用者同一則訊息或前一則指令中額外列出的檢查項目，合併成本次的驗收清單。

// turbo
2. 執行 `git branch --show-current` 與 `git status --short`。
   若有未提交的變更，先完成步驟 3 到 8，全部通過後才依步驟 11 的規範提交；檢查沒過不得提交。

// turbo
3. 執行 `npm run typecheck`。

// turbo
4. 執行 `npm test`。記下測試檔數與測試總數，與上一個里程碑回報的數量比較，確認沒有退化；測試數減少必須說明原因。

// turbo
5. 執行 `npm run lint`。

// turbo
6. 執行 `npm run build`，再執行 `Select-String -Path dist\assets\*.js -Pattern 'DebugOverlay|DEBUG PANEL' -List`。
   無輸出代表正式建置不含 Debug 程式碼；有輸出就是失敗，必須修正。

   步驟 3 到 6 任何一項失敗：修正後重跑全部，不得回報成功。若無法在本里程碑範疇內修正，據實回報失敗並停止。

// turbo
7. 熱路徑掃描，執行：
   `Select-String -Path src\systems\*.ts,src\physics\*.ts,src\core\GameLoop.ts,src\core\FixedStepper.ts,src\core\ObjectPool.ts -Pattern '\.map\(|\.filter\(|\.forEach\(|\.reduce\(|Array\.from|Object\.(keys|values|entries)|\.\.\.'`
   逐一檢視命中處：在 tick 或渲染熱路徑內的必須改掉；不在熱路徑的（初始化、一次性設定）在報告中註明理由。
   本里程碑若新增了其他熱路徑檔案，一併加入掃描。

// turbo
8. TODO(tune) 盤點，執行 `Get-ChildItem -Path src -Recurse -Filter *.ts | Select-String -Pattern 'TODO\(tune\)'`。
   整理完整清單，並標出本里程碑新增或變更的項目。

9. 來源核對：本里程碑新增或變更的每個原版數值或公式都要列出來源。規則：
   - 必須在本次工作中實際開啟過該頁面，才可標「已查證」，並附原文一句（逐字複製，不改寫、不翻譯）與連結。
   - 沒開過頁面或找不到原文，一律標「未查證」，並確認該常數有 TODO(tune) 與註解。
   - 不得編造出處，不得把推算值當成原文。

10. 逐條驗收：對步驟 1 的清單每一項給出狀態。
    - 已自動驗證：必須指出對應的測試名稱或指令輸出。
    - 需人工驗收：需要實際操作畫面或手感才能判斷的項目（視覺、操作手感、FPS）。Browser subagent 不可用時如實說明，不得標為已通過。
    - 未通過：說明原因。
    另外檢查：本里程碑新增的實體或功能，是否已在 DebugOverlay 提供對應的除錯功能（AGENTS.md 第 5 節）。

11. Commit 規範檢查：執行 `git log --oneline -20`，檢視本里程碑的所有 commit，逐一確認：
    - 格式為 type(scope): description；type 屬於 feat、fix、refactor、perf、test、docs、build、chore、style。
    - description 為英文、祈使句、小寫開頭、結尾無句號、不超過 72 字元。
    - 有 footer「Refs: <里程碑編號>」（docs 與 chore 類可例外）。
    - 每個 commit 單獨都能通過 typecheck、test、lint。
    不符合的 commit，只有在尚未回報給使用者時才可以 amend；已回報過的 commit 不得 amend、rebase 或 force push，改用新的 commit 修正。
    若有尚未提交的變更，在此依上述規範提交（不要使用 turbo 自動執行）。

12. 依下方格式輸出報告，不得省略段落；沒有內容的段落寫「無」。

13. 報告後立即停止。不得開始下一個里程碑，等使用者明確確認。

## 報告格式

~~~
# <里程碑編號> 收尾報告

## 1. Commit 紀錄
（git log --oneline 輸出，並註明 commit 規範檢查結果）

## 2. 自動檢查結果
| 檢查 | 結果 | 備註 |
（typecheck / test（檔案數、測試數、與上次比較）/ lint / build / dist 無 Debug 字串 / 熱路徑掃描）

## 3. 驗收清單
| 項目 | 狀態 | 證據 |
（狀態僅限：已自動驗證 / 需人工驗收 / 未通過）

## 4. 來源核對表
| 常數或公式 | 數值 | 狀態（已查證 / 未查證） | 原文一句 | 連結 |

## 5. TODO(tune) 清單
（本次新增或變更的項目：名稱、起始值、理由；其餘只列名稱）

## 6. 與 PLAN.md 的偏離與需要使用者決定的事項

## 7. 手動驗收步驟
（使用者要做什麼、預期看到什麼）

## 8. 數據性質說明
（凡出現數字，註明是實測、推算或估計；效能數據註明只含 CPU 模擬或渲染更新，是否包含 GPU）
~~~

## 注意事項
- 不得新增套件，不得更動 PLAN.md 的範疇；需要調整就列在報告第 6 段。
- 不得把沒有實際執行或量測的結果寫成已完成。
- 熱路徑維持零配置：事件 emit、迴圈內不得建立物件或閉包。
