# 薪資管理規格書 (Salary Management Spec)

> **版本**: v2.0
> **狀態**: 已實作 (Implemented)
> **最後更新**: 2026-02-28
> **目標**: 定義薪資管理頁面的完整架構、資料流、UI 行為，以及所有已實施的優化與 Bug 修正記錄。

---

## 1. 頁面功能概觀與角色權限

- 本頁面為系統月度結算總表。
- 允許**管理員 (Manager / Super Admin)** 檢視所有員工此發薪週期內的薪資計算結果，並針對個別人員執行「結算」(Freeze) 與「取消結算」(Unfreeze)。
- 員工端 (`employee`) **無法**進入此頁面。對他們而言，只有「已結算」的款項才會在其個人薪資區顯示。

---

## 2. 頁面架構（方案 C：Server Component + Batch Query）

### 2.1 元件分割架構

```
app/admin/salary/
├── page.tsx            ← async Server Component（SSR 取資料）
├── SalaryClient.tsx    ← Client Component（所有互動邏輯）
├── actions.ts          ← Server Actions（計算、結算、取消結算、獎金）
└── components/
    ├── ControlBar.tsx          ← 月份選擇器、設定按鈕
    ├── EmployeeCard.tsx        ← 員工薪資卡片
    ├── BonusDialog.tsx         ← 獎金設定對話框
    └── SalarySettingsDialog.tsx ← 員工薪資設定（類型 / 金額）
```

### 2.2 資料流圖

```
瀏覽器請求 /admin/salary?month=2026-02
          │
          ▼
  page.tsx (Server Component)
      ├── calculateAllMonthlySalaries(yearMonth)  ← 批次計算（5 次 DB）
      └── getAllUsers()                            ← 員工清單（給設定對話框）
          │
          │  傳入 initialRecords、usersList
          ▼
  SalaryClient.tsx (Client Component)  ← HTML 初始即含完整資料，無 loading
      ├── ControlBar（月份切換 → router.push → URL 更新 → SSR 重算）
      ├── EmployeeCard × N（展示薪資卡片）
      ├── BonusDialog（更新獎金 → router.refresh()）
      ├── SalarySettingsDialog（更新設定 → router.refresh()）
      └── Resettle ConfirmDialog（取消結算 → router.refresh()）
```

### 2.3 月份切換機制

- 使用者切換月份 → `router.push('/admin/salary?month=YYYY-MM')`
- URL 更新 → Next.js 重新執行 `page.tsx` → 重新批次計算對應月份資料
- 優點：月份 URL 可直接書籤或分享

### 2.4 結算後刷新機制

- 任何寫入操作（結算、取消結算、獎金）執行後 → 呼叫 `router.refresh()`
- `router.refresh()` 重新觸發目前 URL 的 SSR，取得最新 DB 狀態
- **不需**手動更新 Client 端 state

---

## 3. 批次計算架構（核心優化）

### 3.1 `calculateAllMonthlySalaries(yearMonth)` — 唯一入口

位於：`app/admin/salary/actions.ts`

**DB 查詢次數（固定，不隨員工數增加）**：

| # | 查詢 | 說明 |
|---|------|------|
| 1 | `auth.getUser()` | 驗證登入身份 |
| 2 | `users` 表 | 取得所有員工（薪資設定） |
| 3 | `attendance` 表 | 批次撈取所有員工當月出勤 |
| 4 | `leaves` 表 | 批次撈取所有員工核准請假 |
| 5 | `salary_records` 表 | 批次撈取結算狀態與獎金 |

**改善前 vs 改善後**：

```
改善前（逐人查詢）：N 員工 × 5 次 = N×5 次 DB 往返
改善後（批次查詢）：固定 5 次 DB 往返（無論員工人數）

10 人：51 次 → 5 次
20 人：101 次 → 5 次
```

### 3.2 JS 端分組邏輯

```typescript
// 用 Map 在 JS 端 O(1) 分組，效能優於多次 Array.find()
const attendanceByUser = new Map<string, any[]>()
const leavesByUser = new Map<string, any[]>()
const salaryRecordByUser = new Map<string, any>()
```

### 3.3 不自動 saveSalaryRecord

> **改善前**：每次頁面載入都會自動呼叫 `saveSalaryRecord`，對每位員工做一次 UPSERT，N 員工額外增加 N 次寫入。
>
> **改善後**：頁面載入**完全不寫入 DB**，只在明確操作（結算、更新獎金）時才寫入。

---

## 4. 介面規格

### 4.1 頁面結構

- **控制列 (Control Bar)**：月份選擇器、員工薪資設定按鈕。
- **員工卡片列表**：逐人垂直堆疊，根據結算狀態視覺變化。

### 4.2 員工卡片設計細節

- **層次 A: 識別與狀態 (Header Left)**
    - 顯示員工頭像與粗體姓名。
    - 列出「工資類型標籤」（`鐘點` / `月薪`）與「結算狀態標籤」（已結算顯示綠標與鎖頭圖示）。
- **層次 B: 關鍵數據區 (Header Center/Right)**
    - **鐘點制 (Hourly)**：顯示 `工時/時薪`，如「120h / $200」。
    - **月薪制 (Monthly)**：顯示 `假勤/月薪`，如「遲1/早0/假2 | $45,000」。
    - **動態獎金**：顯示可編輯的 `bonus` 金額與備註。
    - **實發金額**：以最大字級顯示總計 `$Net_Amount`。
- **層次 C: 狀態視覺區分**
    - 嚴格遵守《系統架構白皮書 10.2.2 節》色彩紀律。
    - **絕對禁止**將卡片大面積文字色替換為高飽和綠色系。
    - 僅允許：底色微調（已結算偏灰）+ 右上角綠色 Icon Badge。

---

## 5. 狀態邏輯

### 5.1 未結算 (Unsettled)

- **觸發**：`salary_records.is_paid = false` 或無該月記錄。
- **資料來源**：SSR 即時計算（`calculateAllMonthlySalaries`）。
- **允許操作**：
    - `[編輯獎金]`：開啟 `BonusDialog` 更新任意加給。
    - `[結算薪資]`：觸發 `settleSalary` Server Action，將計算結果**永久存成 Snapshot（JSONB）**，狀態轉為已結算。

### 5.2 已結算 (Settled)

- **觸發**：`salary_records.is_paid = true`。
- **資料來源**：唯讀快照，直接解析 `salary_records.settled_data`。即使事後補假或調整時薪，已結算金額**絕對不可變動**。
- **允許操作**：
    - `[不可編輯]`：隱藏獎金編輯。
    - `[展開實時對照 (Live Analysis)]`：手風琴展開，呼叫 `calculateMonthlySalary(forceLive=true)` 作單人即時重算，供管理員對照快照與現況。
    - `[取消結算]`：`ConfirmDialog` 確認後呼叫 `resettleSalary` Server Action，解除鎖定。

---

## 6. Server Actions 索引

| 函式 | 用途 |
|------|------|
| `calculateAllMonthlySalaries(yearMonth)` | **批次計算**所有員工薪資（SSR 主路徑）|
| `calculateMonthlySalary(userId, yearMonth, forceLive?)` | **單人計算**（已結算卡片展開 Live 對照用）|
| `settleSalary(userId, yearMonth)` | 結算：寫入快照，`is_paid = true` |
| `resettleSalary(userId, yearMonth)` | 取消結算：清除快照，`is_paid = false` |
| `updateBonus(userId, yearMonth, amount, notes)` | 更新獎金與備註 |
| `updateUserSalarySettings(userId, type, amount)` | 更新員工薪資類型與金額 |
| `getAllUsers()` | 取得員工清單（給設定對話框用）|

---

## 7. Bug 修正記錄

### 7.1 `endDate` Timezone 問題（修正於 v1.2）

**問題**：`calculateMonthlySalary` 中 `endDate` 使用 `toISOString()` 計算月底，在 UTC+8 本機環境下會少算一天。

```typescript
// 舊寫法（有問題）
const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0]

// 新寫法（安全，與 attendance/actions.ts 一致）
const lastDay = new Date(yearNum, monthNum, 0).getDate()
const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`
```

已同步修正至 `calculateAllMonthlySalaries` 的日期計算。

### 7.2 工時異常診斷 Log（v1.2 新增，v2.0 延伸至批次函式）

兩個函式（`calculateMonthlySalary`、`calculateAllMonthlySalaries`）均內建異常偵測：

- **單筆 `work_hours > 24`** → `console.warn` 目標記錄的 `work_date` 與工時值
- **單月筆數 > 35** → 警告日期篩選可能未生效（僅 `calculateMonthlySalary`）

> **已知案例 - 工時 625h**：補登/修改對話框 `TimeSlotSelector` 的日期 fallback bug，導致 `clock_out_time` 寫入今日（而非補登日期），造成工時橫跨 26 天。根本原因已修正並記錄於 `attendance_record_spec.md §3.6`。

---

## 8. 參考文件

- [系統架構白皮書](system_architecture.md)（薪資計算公式 §6.1、查詢防呆 §11.5、RWD §10.3）
- [考勤記錄規格書](attendance_record_spec.md)（補登时間安全規範 §3.6）
