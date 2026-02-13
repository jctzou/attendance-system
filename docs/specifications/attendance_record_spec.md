# 考勤記錄頁面規格書 (Attendance Record Spec)

> **版本**: v1.1
> **日期**: 2026-02-12
> **狀態**: 已實作 (Implemented)
> **目標**: 定義「打卡記錄 (Attendance Record)」頁面的詳細規格，作為未來開發與維護的單一參考標準。

---

## 1. 系統概觀與角色權限

### 1.1 核心功能
本頁面提供「個人」與「管理員」視角的出勤記錄檢視功能。支援月度切換、員工切換 (僅管理員)，僅提供 **日視圖 (Day View)** 模式。

### 1.2 權限範圍
-   **員工 (Employee)**:
    -   僅能查看 **自己** 的出勤記錄。
    -   無法切換「員工」篩選器。
-   **管理員 (Manager / Super Admin)**:
    -   預設查看自己。
    -   可透過「員工下拉選單」查看 **所有員工** 的出勤記錄。
    -   可查看所有人的打卡細節與修改日誌。

---

## 2. 介面佈局與視覺規範 (UI/UX)

### 2.1 頁面結構 (`PageContainer`)
-   **標題**: "打卡記錄"
-   **描述**: "查看與管理出勤紀錄"
-   **操作列 (Toolbar)**:
    -   **員工選擇器**: (僅管理員可見，顯示格式：`姓名 員編`)
    -   **月份選擇器**: (YYYY-MM)
    -   *(移除週視圖切換按鈕)*

### 2.2 日歷視圖 (Calendar Grid)
採用 RWD Grid 系統：
-   **手機版**: `grid-cols-1` (垂直堆疊)。
-   **桌面版**: `grid-cols-7` (七列月曆佈局)。

#### 2.2.1 日卡片 (Day Card) 設計
每個日期為一個獨立的 `Card` 元件，點擊後觸發互動（詳見第 3 節）。

**卡片狀態與樣式 (需對應 Global Design System)**:
-   **今天 (Today)**: `bg-blue-50 border-blue-400`。
-   **週末 (Weekend)**: `bg-red-50 border-red-200`。
-   **平日 (Weekday)**: `bg-[var(--color-card-light)] border-slate-200`。

**內容顯示規則 (依薪資類型區分)**:

| 顯示項目 | 月薪制 (Monthly) | 時薪制 (Hourly) |
| :--- | :--- | :--- |
| **上班時間** | 顯示 (HH:mm) | 顯示 (HH:mm) |
| **下班時間** | 顯示 (HH:mm) | 顯示 (HH:mm) |
| **工作時數** | **不顯示** | **不顯示** |
| **午休時數** | **顯示** (若 > 0) | **顯示** (e.g., "休 1h") |
| **異常狀態** | **顯示** (遲到/早退 - 紅字) | **不顯示** (隱藏遲到早退資訊) |
| **請假資訊** | 顯示 (中文假別) | 顯示 (中文假別) |

**請假資訊顯示**:
-   必須使用中文顯示假別 (e.g., "病假", "事假", "特休")。
-   樣式: 黃色標籤 (`bg-yellow-100 text-yellow-800`).

---

## 3. 互動邏輯 (Interaction Flows)

點擊任何日卡片 (Day Card) 皆會開啟 **操作對話框 (AttendanceActionDialog)**，根據卡片當前狀態呈現不同選項。

### 3.1 狀態 1: 無任何記錄 (No Record)
-   **觸發條件**: 當日無打卡記錄 `attendance = null` 且 無請假記錄 `leave = null`。
-   **對話框功能**:
    -   **Tab A: 補登打卡**: 允許使用者手動輸入 上班/下班 時間。
        -   **時薪人員 (Hourly Only)**: 需額外顯示「午休時間」下拉選單 (0, 0.5, 1... 3.0 hr)。
    -   **Tab B: 新增請假**: 允許使用者申請請假 (選擇假別、時間)。

### 3.2 狀態 2: 已有打卡記錄 (Has Attendance)
-   **觸發條件**: 當日已有打卡記錄 `attendance != null`。
-   **對話框功能**:
    -   **Tab A: 修改打卡**: 允許修改既有的 上班/下班 時間 (修改後標記 `is_edited`)。
        -   **時薪人員 (Hourly Only)**: 需額外顯示「午休時間」下拉選單，並預設帶入原記錄值。
    -   **Tab B: 新增請假**: 若需補請假 (e.g., 下午請假)，可在此新增。

### 3.3 狀態 3: 已有請假申請 (Has Leave)
-   **觸發條件**: 當日已有請假記錄 `leave != null` (包含 Pending 或 Approved)。
-   **對話框功能**:
    -   **Tab A: 補登打卡**: 若請假非全天 (e.g., 只請早上)，允許補登下午的打卡記錄。
    -   **Tab B: 取消/管理請假**:
        -   若狀態為 `Pending`: 顯示「取消申請」按鈕。
        -   若狀態為 `Approved`: 顯示「已核准」狀態 (通常不允許直接取消，需管理員權限或顯示聯絡HR)。
        -   **顯示資訊**: 必須顯示中文假別 (e.g., "病假 09:00~18:00")。

---

## 4. 資料結構參照 (Data Schema Reference)

### 4.1 Attendance (擴充)
```typescript
interface Attendance {
    id: number
    user_id: string
    work_date: string      // YYYY-MM-DD
    clock_in_time?: string // ISO
    clock_out_time?: string // ISO
    work_hours?: number
    break_duration?: number // (Hourly Only) - 需在 UI 顯示
    status: 'normal' | 'late' | 'early_leave' | 'absent' // Monthly 用於顯示紅字
    is_edited: boolean
}
```

### 4.2 User (擴充)
前端需獲取用戶的 `salary_type` 以決定 UI 顯示邏輯。
```typescript
interface UserProfile {
    id: string
    salary_type: 'monthly' | 'hourly'
    // ...
}
```

### 4.3 假別對照表 (Localization & Normalization)
> **注意**: 資料庫中可能存在舊格式 (e.g., `sick_leave`) 與新格式 (e.g., `sick`)。前端顯示時必須統一透過 Mapping 表轉換，**嚴禁直接顯示 DB 原始值**。

```typescript
const LEAVE_TYPE_MAP: Record<string, string> = {
    // Standard Types
    'sick': '病假',
    'personal': '事假',
    'annual': '特休',
    'compensatory': '補休',
    'marriage': '婚假',
    'maternity': '產假',
    'paternity': '陪產假',
    'funeral': '喪假',
    'other': '其他',
    
    // Legacy / Alternative Types (Normalization)
    'sick_leave': '病假',
    'personal_leave': '事假',
    'annual_leave': '特休',
    'maternity_leave': '產假',
    'paternity_leave': '陪產假',
    'funeral_leave': '喪假',
}
```

**顯示邏輯**:
```typescript
{LEAVE_TYPE_MAP[leave.leave_type] || '未定義假別'}
```
*若無對應 Mapping，顯示「未定義假別」或回報錯誤，不可顯示英文 Key。*

---

## 5. 實作注意事項

1.  **時薪制邏輯**: 
    -   渲染卡片時，檢查 `user.salary_type === 'hourly'`。
    -   若是，則忽略 `attendance.status` (遲到/早退)，並額外顯示 `break_duration`。
2.  **權限檢核**:
    -   **補登/修改**: 需檢查是否超過補登期限 (若有此規則)。
    -   **取消請假**: 需檢查請假狀態，Approved 狀態的取消邏輯需謹慎處理。
4.  **時間邏輯驗證**:
    -   **上班時間 < 下班時間**: 當使用者輸入的時間「上班 >= 下班」時：
        -   顯示錯誤提示文字 (e.g., "上班時間不可晚於或等於下班時間").
        -   **禁用** 確認按鈕 (Disable Submit Button).
        -   修正後自動移除錯誤提示並恢復按鈕。
3.  **對話框狀態管理**: 
    -   建議使用單一 `Dialog` 元件，透過傳入 `record` 與 `leave` 物件來動態決定顯示哪些 Tab。

---

## 6. 技術實作規範 (Technical Implementation Guidelines)

> **⚠️ 開發必讀**: 本模組需嚴格遵守 [系統架構白皮書](system_architecture.md) 中的全域規範。

### 6.1 時區與驗證 (Timezone & Validation)
-   **時區處理**: 請參照 `system_architecture.md` 第 10.1 節。所有的時間顯示與輸入皆需轉換為本地時間格式。
-   **驗證邏輯**: 請參照 `system_architecture.md` 第 10.2 節。必須實作即時且具備恢復性的錯誤檢查 (e.g., 上班時間不可晚於下班時間)。
