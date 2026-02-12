# 打卡系統設計規格書 (Attendance Clock-in Specification)

> **版本**: v1.0
> **日期**: 2026-02-12
> **狀態**: 已發布 (Released)
> **目標**: 建立一個直覺、防呆且視覺現代化的員工打卡介面，支援月薪與鐘點制不同邏輯。
> **參考文件**: [系統架構白皮書 (System Architecture)](system_architecture.md), [薪資管理優化規格書](salary_optimization_spec.md)

---

## 1. 系統概觀 (System Overview)

本頁面為員工每日使用的核心功能，負責記錄上下班時間，並即時回饋出勤狀態（正常/遲到/早退）。

### 1.1 核心功能
1.  **實時時鐘**: 顯示伺服器/客戶端一致的標準時間。
2.  **打卡操作**: 上班打卡 (Clock In) 與 下班打卡 (Clock Out)。
3.  **狀態回饋**: 打卡後立即顯示狀態（如：遲到、早退、工時）。
4.  **防呆機制**: 避免重複打卡、提供誤按取消功能。

---

## 2. 介面設計規範 (UI/UX Specification)

介面以「現代化卡片 (Modern Card)」為核心，強調清晰的數字顯示與大尺寸按鈕。

### 2.1 色彩計畫 (依據統一設計規範)
-   **全域一致性**: 打卡面板必須使用 **白色背景 (`bg-white`)**，搭配深色陰影以營造懸浮感。
-   **主色調**:
    -   **上班按鈕**: 深色系 (`bg-slate-800`)，象徵沈穩開始工作。
    -   **下班按鈕**: 品牌主色 (`bg-primary` / Orange)，象徵活力與完成。
    -   **狀態標籤**:
        -   正常: Emerald (`bg-emerald-100 text-emerald-600`)
        -   遲到: Orange (`bg-orange-100 text-orange-600`)
        -   早退/異常: Red (`bg-red-100 text-red-600`)

### 2.2 版面配置 (Layout)
-   **卡片容器**:
    -   最大寬度: `max-w-lg`
    -   圓角: `rounded-xl`
    -   陰影: 強烈陰影 (`shadow-[0_20px_50px_rgba(0,0,0,0.05)]`)
    -   邊框: 細微邊框 (`border border-slate-200`)
-   **資訊層次**:
    1.  **日期與時間**: 最頂層，使用超大字級 (`text-6xl` or `7xl`) font-mono 顯示時間。
    2.  **排班資訊**: 
        -   **月薪制**: 顯示規定上下班時間 (如 09:00 - 18:00)。
        -   **鐘點制**: 不顯示。
    3.  **分隔線**: 漸層分隔線區隔資訊與操作區。
    4.  **操作區 (Operation Area)**:
        -   **未上班狀態**:
            -   **鐘點制**: 顯示時間段選擇器 (Slot Selector) + 上班打卡按鈕。
            -   **月薪制**: 直接顯示「上班打卡」按鈕。
        -   **上班中狀態**:
            -   **鐘點制**: 
                -   **時間段選擇器**: 選擇下班時間 (Slot Selector)。
                -   **午休時數選單**: 選擇休息時間 (1h / 1.5h / 2h)。
                -   「下班打卡」按鈕。
            -   **月薪制**: 顯示「下班打卡」按鈕。
    5.  **狀態區**:
        -   顯示今日打卡時間 (上班/下班需同時顯示)。
        -   顯示狀態標籤 (Late/Normal)。
        -   顯示已工作時數。

---

## 3. 業務邏輯規則 (Business Rules)

### 3.1 上班打卡 (Clock In)
-   **觸發條件**: 當日尚未有 `clock_in_time` 記錄。
-   **立即回饋**: 點擊按鈕後，**介面必須立即顯示上班打卡時間** (Taipei Time HH:mm:ss)，不可有延遲感。此規則適用於 **月薪制** 與 **鐘點制** 所有員工。
-   **遲到判定 (Lateness Logic)**:
    -   比對 `now` 與 `users.work_start_time`。
    -   若 `now > work_start_time` (容許誤差 0 分鐘)，標記 `status = 'late'`。
-   **鐘點制特殊邏輯 (Hourly Users)**:
    -   打卡時需選擇 **「前一區段」** 或 **「後一區段」** (每 30 分鐘為一單位)。
    -   **打卡後介面**: 進入「上班中」狀態，**必須顯示「午休時數選擇器」**。
        -   選項: `1.0 hr` (預設), `1.5 hr`, `2.0 hr`。
        -   說明: 供員工依據當日實際狀況調整休息時間。

### 3.2 下班打卡 (Clock Out)
-   **觸發條件**: 已有 `clock_in_time` 且尚未有 `clock_out_time`。
-   **鐘點制特殊邏輯 (Hourly Users)**:
    -   **下班時間選擇**: 同上班打卡，需選擇 **「前一區段」** 或 **「後一區段」** (每 30 分鐘為一單位) 作為下班時間。
    -   **工時計算**: 依據「選擇的下班時間」與「上班時間」計算，並扣除「選擇的午休時間」。
-   **工時計算 (Work Hours Calculation)**:
    -   **月薪制**: `工時 = (下班時間 - 上班時間) - users.break_hours` (固定參數)。
    -   **鐘點制**: `工時 = (選擇的下班時間 - 上班時間) - 當下選擇的午休時數` (動態參數)。
-   **資料寫入**: 下班打卡當下，將計算後的淨工時寫入 `attendance.work_hours`。
-   **早退/異常判定**:
    -   早退: `now < users.work_end_time`。
    -   異常: 若工時為負數或極短，視為異常。

### 3.3 取消下班 (Cancel Clock Out)
-   **允許條件**: 當日已有 `clock_out_time`。
-   **行為**: 
    1.  點擊按鈕時，**必須** 彈出「自定義確認 Modal」 (嚴禁使用 native confirm)。
        -   **標題**: "確認取消下班？"
        -   **內容**: "這將清除您的下班時間並重新計算工時，您確定要繼續嗎？"
        -   **按鈕**: [取消] / [確定取消] (紅色/Destructive)。
    2.  用戶確認後，清除 `clock_out_time` 與 `work_hours`，將狀態回復為上班中。
-   **目的**: 防止員工誤按或是下班後又回來加班。

---

## 4. 資料結構 (Data Schema)

主要依賴 `attendance` 資料表：

| 欄位 | 說明 | 來源/邏輯 |
| :--- | :--- | :--- |
| `user_id` | 員工關聯 ID | `auth.users` |
| `work_date` | 工作日期 | `YYYY-MM-DD` (Taipei Time) |
| `clock_in_time` | 上班時間 | ISO Timestamp (UTC) |
| `clock_out_time` | 下班時間 | ISO Timestamp (UTC) |
| `status` | 狀態標籤 | `'normal'`, `'late'`, `'early_leave'`, `'absent'` |
| `work_hours` | 計算工時 | Numeric (小數點後 2 位) |

---

## 5. 前端實作細節 (Frontend Implementation)

### 5.1 關鍵元件
-   **`ModernClockPanel.tsx`**: 
    -   使用 `useTransition` 處理 Server Actions 的 loading 狀態。
    -   使用 `setInterval` 每秒更新客戶端顯示時間。
    -   判斷 `salaryType` ('hourly' vs 'monthly') 決定渲染內容。

### 5.2 狀態管理
-   **Server Component (`page.tsx`)**: 負責初始資料抓取 (`userProfile`, `todayRecord`)。
-   **Client Component (`ModernClockPanel.tsx`)**: 負責互動與即時回饋。
    -   打卡後不需重新整理頁面，透過 Server Actions 的 `revalidatePath` 自動更新 UI。

---

## 6. 技術注意事項 (Technical Notes)

1.  **時區處理**: 
    -   所有日期比對與顯示 **必須** 強制指定 `Asia/Taipei` 時區。
    -   前端送出時間前，建議使用 `YYYY-MM-DDTHH:mm` (Local ISO) 格式進行處理與驗證，最後再轉為 UTC ISO String 寫入資料庫，以避免瀏覽器自動時區轉換造成的誤差。
2.  **防重複打卡**: 後端 `clockIn` Action 必須再次檢查 DB 是否已有當日記錄 (Double Check)，防止網絡延遲造成的重複寫入。
3.  **鐘點制時間段**: 前端計算 Slot 時需注意跨小時進位問題 (e.g. 09:55 -> Next Slot 10:00)。

---

> 本文件旨在確保打卡頁面的一致性與可維護性，任何重構皆應遵守此規範。
