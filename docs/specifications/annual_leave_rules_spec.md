# 特休假管理規格書 (Annual Leave Management Spec)

> **版本**: v1.0
> **日期**: 2026-02-13
> **狀態**: 草稿 (Draft)
> **目標**: 實作符合台灣《勞基法》之特休假自動計算、發放與結算機制。
> **參考文件**: 
> - [系統架構白皮書 (System Architecture)](system_architecture.md)
> - [勞動部 - 特別休假試算系統](https://calc.mol.gov.tw/Trail_New/html/RestDays.html)

---

## 1. 核心業務規則 (Business Rules)

本系統採 **週年制** (以員工「到職日」為基準) 計算特休假。

### 1.1 給假標準 (勞基法第38條)
依據員工累計年資，於「滿足年資條件之當日」自動發放對應天數：

| 累計年資 | 給假天數 | 備註 |
| :--- | :--- | :--- |
| **6 個月以上，未滿 1 年** | **3 天** | 到職滿 6 個月當天發放。 |
| **1 年以上，未滿 2 年** | **7 天** | 到職滿 1 年當天發放。 |
| **2 年以上，未滿 3 年** | **10 天** | 到職滿 2 年當天發放。 |
| **3 年以上，未滿 5 年** | **14 天** | 到職滿 3 年、4 年，每年各 14 天。 |
| **5 年以上，未滿 10 年** | **15 天** | 到職滿 5~9 年，每年各 15 天。 |
| **10 年以上** | **15 天 + (年資-10)** | 每滿 1 年加給 1 天，上限 30 天。 |

*(註：給假單位為「天」，請假最小單位為 **0.5 天**)*

### 1.2 使用期限與結算
-   **使用期限**: 自「給假當日」起算，至「次一年度給假日前一日」止 (即為期一年)。
-   **期末結算**: 
    -   期限屆滿未休完之特休天數，應依法折算工資 (Cash Out)。
    -   系統應於「給假日前一日」自動結算舊假，將未休餘額轉入 `annual_leave_cashout` 待發薪資記錄，並歸零餘額。

---

## 2. 系統架構變更 (Schema Changes)

為支援上述規則，需擴充現有資料表。

### 2.1 `users` 資料表 (擴充)
新增年資結算相關欄位：

| 欄位名稱 | 類型 | 必填 | 說明 |
| :--- | :--- | :--- | :--- |
| `onboard_date` | `Date` | **Yes** | **到職日**。計算年資之唯一基準。 |
| `annual_leave_total` | `Numeric` | No | 本年度「應給」特休總天數 (e.g., 7.0)。 |
| `annual_leave_used` | `Numeric` | No | 本年度「已休」特休總天數 (e.g., 2.5)。 |
| `last_reset_date` | `Date` | No | 上次發放/重置特休的日期 (用於防止重複執行)。 |

*(註：剩餘天數 = `annual_leave_total` - `annual_leave_used`)*
*(註：`leave_balance` 概念將由上述欄位取代，以求精確)*

### 2.2 `annual_leave_logs` (新增 - 軌跡記錄)
記錄特休發放與結算的歷史軌跡。

| 欄位名稱 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | `BigInt` | PK |
| `user_id` | `UUID` | FK -> users.id |
| `year` | `Integer` | 歸屬年度 (以年資數表示，如 0.5, 1, 2) |
| `action` | `Text` | `'grant'` (發放), `'reset'` (結算歸零) |
| `days_change` | `Numeric` | 異動天數 (e.g., +3, -3, +7) |
| `description` | `Text` | 系統備註 (e.g., "滿半年發放 3 天") |
| `created_at` | `Timestamptz` | 執行時間 |

---

## 3. 自動化邏輯 (Automation Logic)

系統需透過排程 (Cron Job) 或每日觸發機制執行檢查。

### 3.1 每日檢查排程 (Daily Job)
每天凌晨 (00:00) 執行 `checkAnnualLeave`：

1.  **查詢對象**: 所有 `status = 'active'` 的員工。
2.  **計算年資**: `current_date` - `onboard_date`。
3.  **規則判定**:
    -   **滿 6 個月**: 
        -   檢查 `last_reset_date` 是否為半年前。
        -   若尚未發放 -> `UPDATE users SET annual_leave_total = 3, annual_leave_used = 0`。
        -   寫入 Log: `action='grant', days=3`。
    -   **滿 N 週年 (N >= 1)**:
        -   **Step A: 結算舊假**:
            -   若 `annual_leave_total - annual_leave_used > 0`，計算折現金額 (視需求，或僅歸零)。
            -   寫入 Log: `action='reset'`。
        -   **Step B: 發放新假**:
            -   依年資對照表取得天數 (Days)。
            -   `UPDATE users SET annual_leave_total = Days, annual_leave_used = 0`。
            -   寫入 Log: `action='grant', days=Days`。

---

## 4. 前端介面設計 (UI/UX)

### 4.1 員工端 - 請假頁面 (`/app/leaves`)
-   **日期選擇與每日明細 (Daily Breakdown)**:
    -   使用者選擇「開始日期」與「結束日期」後，系統應自動列出該區間內的每一天。
    -   **狀態切換**: 每一天皆可獨立設定狀態：
        -   **全天 (1.0)**: 預設值。
        -   **半天 (0.5)**: 適用於上午或下午請假。
        -   **不請假 (0)**: 適用於週間休息日或國定假日 (若包含在區間內)。
    -   **視覺回饋**:
        -   設定為「不請假」的日期，應以灰色背景及刪除線標示。
        -   **例假日 (週六、週日)**: 應以 **Rose/Red** 色系 (e.g., 背景色 `bg-rose-50`, 文字 `text-rose-600`) 進行區隔標示，以利使用者識別。
-   **自動計算 (Auto-Calculation)**:
    -   系統依據每日狀態自動加總產生「請假總天數」。
    -   禁止使用者手動輸入總天數，以避免計算錯誤。
-   **餘額顯示**: 在申請表單上方，明顯顯示「特休剩餘天數」。
    -   公式: `users.annual_leave_total - users.annual_leave_used` 天。
-   **防呆**:
    -   申請特休時，若 `申請總天數 > 剩餘天數`，阻擋送出並提示錯誤。
    -   若 `申請總天數 <= 0`，阻擋送出。

### 4.2 管理端 - 員工資料設定 (`/app/admin/employees/[id]`)
-   **到職日設定**:
    -   新增 `DatePicker` 用於設定 `onboard_date`。
    -   此欄位為必填，且更動後應提示「可能影響特休計算」。
-   **手動調整**:
    -   允許管理員手動修正 `annual_leave_total` (因應特殊協議或補償)。

---

## 5. 移轉計畫 (Migration Plan)

針對現有系統中的員工資料：
1.  **Schema Migration**: 執行 SQL 新增欄位。
2.  **Data Patch**: 
    -   管理員需手動為所有現有員工補登 `onboard_date`。
    -   (過渡期) 系統暫不執行自動計算，直到到職日欄位非空。

---
