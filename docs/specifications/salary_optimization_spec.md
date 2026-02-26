# 薪資管理優化規格書 (Salary Management Optimization Spec)

> **版本**: v1.1
> **狀態**: 進行中 (In Progress)
> **目標**: 優化現有薪資管理頁面，區分「未結算」與「已結算」兩套對照視圖，確保歷史數據的不可變性 (Immutability)。

---

## 1. 頁面功能概觀與角色權限

- 本頁面為系統月度結算總表。
- 允許**管理員 (Manager/Admin)** 檢視所有員工此發薪週期內的薪資計算結果，並且針對個別人員執行「結算」(Freeze) 與「取消結算」(Unfreeze) 動做。
- 員工端 (`employee`) **無法**進入此頁面。對他們而言，只有「已結算」之款項才會在其個人薪資區顯示。

---

## 2. 介面佈局與資料流 (UI Layout & Data Flow)

### 2.1 頁面結構
- **控制列 (Control Bar)**: 包含月份選擇器與進階設定按鈕。
- **員工卡片 (Employee Card)**: 單一員工薪資的最小呈現單位，根據**結算狀態**動態變色。手機板需呈現單卡片垂直堆疊，桌面版為 Grid。

### 2.2 員工卡片設計細節
- **層次 A: 識別與狀態 (Header Left)**
    - 顯示員工頭像與粗體姓名。
    - 列出「工資類型標籤」 (`鐘點` / `月薪`) 與「結算狀態標籤」 (若已結算則顯示綠標與鎖頭圖示)。
- **層次 B: 關鍵數據區 (Header Center/Right)**
    - **鐘點制 (Hourly)**: 顯示 `工時/時薪`，如「120h / $200」。展開實施細節或實時預覽時，其異常狀態（遲到/早退）的顯示受全域 `NEXT_PUBLIC_SHOW_HOURLY_STATUS` 變數控制。
    - **月薪制 (Monthly)**: 顯示 `假勤/月薪`，如「遲1/早0/假2 | $45,000」。
    - **動態獎金**: 顯示可編輯之 `bonus 금액` 與備註。
    - **實發金額**: 以最大級數顯示總計 `$Net_Amount` 於卡片最右側作為視覺焦點。

---

## 3. 特殊頁面邏輯與狀態管理 (Local Logic & State)

卡片狀態區分為 `Unsettled` 與 `Settled`，兩者的操作與資料流極端不同：

### 3.1 狀態 1: 未結算 (Unsettled)
- **觸發**: 該月份 `salary_records.is_paid = false` 或者無該月紀錄。
- **資料來源**: 即時運算 (Live Calculation)。每次打開頁面或刷新，都會由後端抓取該月最新的 `attendance` 與 `leaves` 送入薪資引擎 (`utils/salary-engine.ts`) 重新吐出當下結果。
- **允許操作**:
    - [編輯獎金]: 開啟 `BonusDialog` 更新任意加給。
    - [結算薪資]: 使用醒目的 Primary Button，點擊後觸發 `settleSalary` Server Action，**將目前的運算結果永久存成 Snapshot (`JSONB` 格式)**，並將狀態轉為已結算。

### 3.2 狀態 2: 已結算 (Settled)
- **觸發**: 該月份 `salary_records.is_paid = true`。
- **資料來源**: 唯讀快照 (Snapshot Data)。必須直接解析 `salary_records.settled_data` JSON。即使事後員工補假、管理員調整時薪，此卡片上的數字**絕對不可有任何變動**。
- **允許操作**:
    - [不可編輯]: 隱藏獎金編輯與資料修改入口。
    - [展開實時對照 (Live Analysis)]: 底部提供一個展開手風琴 (`Accordion`)，點擊後會再次於背景執行 Live 引擎，顯示「若現在重算」的新結果，提供管理員手動核對落差，決定是否需要撤銷結算。
    - [取消結算]: 使用具有紅色 `Destructive` 屬性的 `ConfirmDialog` 再次確認無誤後，解除該員工月份鎖定。

---

## 4. 參考文件 (References to Global Rules)
開發此頁面前，請務必詳閱 [系統架構白皮書 (System Architecture)](system_architecture.md)：
- **[6.1 引擎化架構 - 薪資計算公式]**: 所有的月薪基礎基底、遲到扣款與獎賞公式規範。所有加總皆嚴禁在前端進行，需呼叫 `utils/salary-engine.ts`。
- **[11.5 資料查詢與權限防呆]**: 為了避免清單漏掉「同樣身為員工的管理員自身」，查詢 `users` 時請嚴格遵守白皮書內定義的多角色 `in` 陣列查詢法。
- **[10.3 響應式佈局與輸入元件]**: 應配合小螢幕禁用橫向捲動 (`Horizontal Scroll Table`) 的設計方針。
