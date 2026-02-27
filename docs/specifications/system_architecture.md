# 系統架構白皮書 (System Architecture v2.1)

> **狀態**: 正式版 (Release)
> **日期**: 2026-02-15
> **目的**: 本文件為系統開發的「單一事實來源 (Single Source of Truth)」，定義所有全域規範、資料庫結構與技術標準。

---

## 1. 系統概觀

本系統是一個基於 **Next.js 14+ (App Router)** 的應用程式，整合 **Supabase** 作為後端服務。

### 核心技術棧
-   **Framework**: Next.js 15 (App Router)
-   **Language**: TypeScript (Strict Mode)
-   **Database**: PostgreSQL (via Supabase)
-   **Styling**: Tailwind CSS v4
-   **State**: React Server Components (RSC) + Server Actions + React Hooks

---

## 2. 資料庫綱要 (Database Schema)

所有資料表結構以此定義為準。

### `users` (使用者)
員工基本資料與設定。

| 欄位 | 類型 | 必填 | 說明 |
| :--- | :--- | :--- | :--- |
| `id` | UUID | Yes | PK, linked to `auth.users` |
| `display_name` | Text | Yes | 顯示名稱 |
| `employee_id` | Text | Yes | 員工編號 (Unique) |
| `avatar_url` | Text | No | 頭像 URL (Supabase Storage: `avatars`) |
| `role` | Enum | Yes | 一般員工 (`'employee'`), 管理員 (`'manager'`), 超級管理員 (`'super_admin'`) |
| `salary_type` | Enum | Yes | `'monthly'`(月薪), `'hourly'`(時薪) |
| `salary_amount` | Numeric | Yes | 基本薪資或時薪 |
| `work_start_time` | Time | Yes | 排班開始 (Local Time HH:mm:ss) |
| `work_end_time` | Time | Yes | 排班結束 (Local Time HH:mm:ss) |
| `onboard_date` | Date | Yes | **到職日** (特休計算基準) |
| `annual_leave_total` | Numeric | No | 本年度特休總天數 |
| `annual_leave_used` | Numeric | No | 本年度已休特休天數 |
| `last_reset_date` | Date | No | 上次特休重置日期 |

### `attendance` (出勤)
每日打卡記錄。

| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK -> users.id |
| `work_date` | Date | **台北時間**日期 (YYYY-MM-DD) |
| `clock_in_time` | Timestamptz | 上班打卡 (UTC ISO) |
| `clock_out_time` | Timestamptz | 下班打卡 (UTC ISO) |
| `work_hours` | Numeric | 計算工時 (小數點 2 位) |
| `break_duration` | Numeric | 午休扣除時數 (Hourly Only) |
| `status` | Text | `'normal'`, `'late'`, `'early_leave'`, `'absent'` |
| `is_edited` | Boolean | 是否經過手動修改 |

### `leaves` (請假)

> 詳細規格請參閱 [leave_system_spec.md](leave_system_spec.md)。

| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK → users.id |
| `leave_type` | Text | `sick_leave`, `personal_leave`, `annual_leave`, `other` |
| `start_date` | Date | 單日日期（新架構：等同 end_date）|
| `end_date` | Date | 單日日期（新架構：等同 start_date）|
| `days` | Numeric | 天數，只允許 `0.5` 或 `1.0` |
| `hours` | Numeric | Legacy 欄位（days * 8）|
| `reason` | Text | 請假事由 |
| `status` | Text | `pending`, `approved`, `rejected`, `cancelled`, `cancel_pending` |
| `group_id` | UUID | 多日請假的群組識別碼（同次申請共用）|
| `approver_id` | UUID | FK → users.id，審核主管 ID |
| `approval_note` | Text | 主管備註（保留，未來擴充）|
| `approved_at` | Timestamptz | 審核時間戳 |
| `cancel_reason` | Text | 員工申請取消時填寫的取消原因 |
| `created_at` | Timestamptz | 建立時間 |
| `updated_at` | Timestamptz | 更新時間 |



### `notifications` (系統通知)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK -> users.id (接收者) |
| `type` | Text | 通知類型分類 |
| `title` | Text | 標題 |
| `message` | Text | 內文 |
| `link` | Text | 導向連結 (Optional) |
| `is_read` | Boolean | 是否已讀 (Default `false`) |
| `is_cleared` | Boolean | 是否軟刪除清理 (Default `false`) |

### `salary_records` (薪資記錄)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK -> users.id |
| `year_month` | Text | `YYYY-MM` |
| `base_salary` | Numeric | 本薪 |
| `bonus` | Numeric | 獎金 |
| `total_salary` | Numeric | 實發金額 |
| `is_paid` | Boolean | 是否結算 |
| `settled_data` | JSONB | **結算快照** (Snapshot) |

### `annual_leave_logs` (特休軌跡)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK -> users.id |
| `year` | Integer | 年資年度 |
| `action` | Text | `'grant'`(發放), `'reset'`(結算) |
| `days_change` | Numeric | 異動天數 |
| `description` | Text | 說明 |

### 已棄用 / 整合之資料表 (Deprecated / Merged Tables)

| 資料表 | 狀態 | 說明 |
| :--- | :--- | :--- |
| `leave_cancellations` | **已刪除** | 原設計用於儲存取消申請。現已將其功能（原因、審核狀態）整合進 `leaves` 表，並將實體資料表刪除。 |

---

## 3. 全域 UI/UX 設計規範

### 3.1 色彩系統 (Color System)
-   **Primary**: `var(--color-primary)` (#FF5F05 - 企業橘)
-   **Surface**:
    -   Light: `bg-white`, `border-slate-200`
    -   Dark: `bg-slate-900`, `border-slate-700`
-   **Status Colors**:
    -   **Success**: Emerald (`text-emerald-600 bg-emerald-100`)
    -   **Warning**: Amber/Orange (`text-orange-600 bg-orange-100`)
    -   **Error/Destructive**: Rose/Red (`text-red-600 bg-red-100`)

### 3.2 元件規範
-   **Card**: `rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 bg-[var(--color-card-light)]`
-   **Dialog/Modal**:
    -   必須使用 `fixed inset-0` 遮罩。
    -   禁止使用原生 `confirm/alert`。
    -   表單提交禁止使用 `<form>` (防止換頁)，一律使用 `onClick` + `server action`。
-   **Inputs**:
    -   手機版寬度 `w-full`，桌面版 `w-auto`。
    -   必須顯示 Loading 狀態。

---

## 4. 時區與邏輯標準 (Timezone & Logic Standards)

### 4.1 單一時區規範
系統所有業務邏輯強制以 **Asia/Taipei (UTC+8)** 為基準。

-   **前端顯示**: 所有時間 (UTC ISO) 必須轉換為 `Asia/Taipei` 顯示。
-   **後端計算**: 接收到 UTC 時間後，必須轉為台北時間進行比對。
-   **資料庫儲存**:
    -   `Timestamptz` 欄位存 UTC。
    -   `Date` 欄位 (如 `work_date`) 存台北時間的日期字串 (YYYY-MM-DD)。
    -   `Time` 欄位 (如 `work_start_time`) 存台北時間的 HH:mm:ss。

### 4.2 出勤判定 (Grace Period)
-   **遲到 (Late)**: 實際上班 > 表定上班 + **59秒** 寬容值。
-   **早退 (Early Leave)**: 實際下班 < 表定下班 (0秒寬容)。

---

## 5. 開發規範 (Development Standards)

### 5.1 Server Actions
-   **路徑**: `app/[feature]/actions.ts`
-   **驗證**: 所有輸入參數必須使用 **Zod** 驗證。
-   **權限**: 每個 Action 第一步必須檢查 `getUserProfile` 確認 `role`。
-   **回傳**: 統一格式 `{ success: boolean, data?: T, error?: string }`。

### 5.2 TypeScript
-   **Strict Mode**: Enabled.
-   **No Any**: 嚴禁使用 `any`。若 Supabase 推斷失敗，使用 `.returns<T>()` 或定義介面轉型。
-   **Supabase Types**: 保持 `types/supabase.ts` 與資料庫同步，Enum 需嚴格對應。

### 5.3 錯誤處理
-   **Inline Error**: 錯誤訊息應顯示於 UI 元件附近，而非全域 Alert。
-   **Recoverable**: 驗證錯誤應可修正並重試。

---


## 6. 核心業務邏輯規範 (Business Logic Standards)

**目的**：消除前後端計算不一致導致的 Bug，所有的計算必須封裝在獨立的 **Engine Utils** 中。

### 6.1 引擎化架構 (Engine Utils)
系統將複雜的業務規則從 UI 與 API 路由中抽離，獨立建立三個核心運算引擎：
1. **`utils/attendance-engine.ts`**:
   - 負責**出勤狀態判定**。包含遲到/早退判定、工時計算、休息時間扣除等。
   - 時薪制的 30 分鐘防呆進位邏輯 (Nearest 30 minutes)。
2. **`utils/salary-engine.ts`**:
   - 負責**月薪與時薪的複雜計薪**。處理基本薪資、全勤獎金、請假扣款等。
   - 提供實時 Snapshot 運算以支援前端「即時試算」。
3. **`utils/annual-leave-engine.ts`**:
   - 負責**特休週年制發放邏輯**。比對到職日 (`onboard_date`)、計算年資與應得天數。

### 6.2 薪資計算公式
-   **月薪制**：`當月實發 = (基本薪資 + 獎金) - (缺勤扣款 + 遲到/早退扣款)`
-   **扣款標準**：遲到/早退之扣款邏輯必須由後端 `actions.ts` 統一計算，**禁止**在前端進行金額運算。

### 出勤判定邏輯
-   **基準時間**：系統應以 `users.work_start_time` 為準。超過 1 分鐘即標註 `status = 'late'`。
-   **防呆機制**：同一 `user_id` 在同一 `work_date` 僅允許一筆 `attendance` 記錄（除非特定排班需求）。重複打卡應視為 **更新 (Update)** 而非新增 (Insert)。
-   **統一計算核心 (Centralized Calculation)**：任何涉及打卡時間的寫入（新增/修改/補登/取消下班），**必須** 呼叫同一套計算邏輯 function (e.g. `calculateAttendanceFields`)。該核心必須：
    1.  讀取最新 `users` 設定 (`work_start_time`, `work_end_time`)。
    2.  將 ISO 時間轉換為台北時間字串 (`HH:mm:ss`)。
    3.  重新執行 `determineAttendanceStatus`。
    4.  **禁止** 在個別 API 中自行撰寫判斷式，以確保邏輯一致。

### 6.3 系統通知與權限管理 (Notifications & RLS)
**目的**：解決一般員工無法跨權限派發「系統通知」給特定部門或管理員的 Row Level Security (RLS) 限制。
-   **架構決策 (Database Triggers)**：所有涉及系統內部通知發送的業務動作（如請假申請發送審核通知給管理者、管理員核准請假發送結果給使用者），**嚴禁** 於 Next.js 前端 (Server Actions) 呼叫 `createNotification` 來跨帳號寫入通知。
-   **實作方法**：必須於 Supabase `migrations` 內建立具有 `SECURITY DEFINER` (建立者權限) 的觸發器函式 (Trigger Functions) 並綁定至關聯資料表 (e.g., `leaves` 的 `AFTER INSERT OR UPDATE` 事件)。這能確保派發通知的動作在資料庫底層用最高權限執行，完美避開普通員工被 RLS `users` 策略擋下的盲區。
-   **好處**：這讓 Next.js 端無需持有高權限金鑰 (Service Role Key)，同時使程式碼更為乾淨，統一由資料庫集中處理寄發事件。
-   **前端呈現**：
    *   `NotificationBell` 採用高品質卡片設計（深淺雙支援，如 `shadow-xl` / `rounded-2xl` 的平滑過渡設定）。
    *   支援監聽 `mousedown` 點擊外面空白處 (Outside Click) 來關閉通知面板，不再依賴影響全域排版的 `fixed inset-0` 遮罩。

### 6.4 資料軟刪除策略 (Soft Deletion)
**目的**：保留歷史操作軌跡，並優化大規模刪除時的 RLS 安全審核複雜度。
-   對於通知清單 (`notifications`) 或具備追溯性質的業務資料，**嚴禁**使用 `DELETE` 語法進行實體刪除。
-   **正確做法**：新增如 `is_cleared` (Boolean) 或 `deleted_at` (Timestamptz) 欄位。使用者執行刪除行為時，一律改為 `UPDATE` 資料表將旗標設為 `true`。讀取 (GET) 的 API 則強制附加 `.eq('is_cleared', false)` 進行過濾。

### 6.5 特休假發放與排程機制 (Annual Leave & Cron Jobs)
**目的**：確保法令特休假天數自動配發的準確性。
-   **發放標準**：系統採「週年制」。依據台灣《勞基法》第 38 條給假標準：滿半年 3 天、滿一年 7 天、滿兩年 10 天，後續依 14, 15, 15... 遞增計算。此邏輯封裝於 `utils/annual-leave-engine.ts`。
-   **排程服務 (Background Services)**：給假判斷不依賴前端觸發，而是提供 API Endpoint (`/api/cron/annual-leave`) 供外部排程系統（如 Vercel Cron）每日凌晨呼叫。該 API 會讀取所有員工 `onboard_date` 並配合引擎判定是否為週年紀念日，進而寫入 `annual_leave_logs` 紀錄。
-   **安全限制**：任何排程 API 都必須透過判斷 `SUPABASE_SERVICE_ROLE_KEY` 或是專屬的 Bearer Token 以防止未經授權的外部偽造請求。

### 6.6 鐘點人員打卡校正與審計日誌 (Hourly Auto-Correction & Audit Logs)
**目的**：避免時鐘點人員薪資結算時因小數點或零碎分鐘產生無法對齊的誤差。
-   **強制作法**：介面上「鐘點制員工 (`salary_type === 'hourly'`)」進行任何打卡（上班、下班）或後補打卡操作時，**強制禁止** 自由選時，只能使用以 30 分鐘為一階的 `TimeSlotSelector`（例如 `09:00`, `09:30`）。
-   **修訂日誌 (`edit_logs`)**：當系統接受此類經過「自定義時間」選擇校正過的打卡請求時，除了將 `attendance.is_edited` 標記為 `true`，還必須強制在背景向 `attendance_edit_logs` 資料表寫入一筆追蹤記錄，記錄使用者當時的「實際操作時間」與「選擇校正後的時間」，確保後續審計透明。
-   **異常狀態顯示切換 (Feature Flag)**：對於鐘點制員工之「遲到 (Late) / 早退 (Early Leave)」紀錄，底層 `attendance-engine.ts` 仍會如實計算與寫入資料庫。但在 UI 呈現層，一律透過全域環境變數 `NEXT_PUBLIC_SHOW_HOURLY_STATUS` (封裝於 `utils/features.ts`) 來決定是否隱藏這些紅燈警告。預設為 `false` (隱藏)，以此保持版面乾淨並為未來擴充保留後路。

### 6.7 員工帳號與權限生命週期管理 (Employee Account Lifecycle)
**目的**：確保員工由到職至離職的權限控制符合企業級資訊安全規範。
-   **架構決策 (Admin API)**：涉及登入帳號 (`auth.users`) 的敏感操作，如修改登入 Email、封鎖帳號 (Ban) 等，**禁止** 透過普通 Supabase Client 或是以不安全的手段繞過。
-   **實作方法**：所有管理員針對員工登入權限的操作，必須在 Server Action 中使用夾帶 `SUPABASE_SERVICE_ROLE_KEY` 的 `createAdminClient()` 執行。若環境變數中缺少此金鑰，系統應直接拋出錯誤拒絕執行，並且**禁止**靜默跳過錯誤以允許未同步的資料庫變更。

---

## 7. 資料驗證與安全 (Validation & Security)

**目的**：確保資料庫數據乾淨，防止非法格式寫入。

### 雙重驗證
-   **Schema 驗證**：必須引入 **Zod Schema** 進行型別驗證。
-   **參數檢查**：所有 Server Actions 接收參數前，必須先通過 `zod.safeParse()`。

### 欄位保護
-   **敏感欄位**：嚴禁在前端傳遞 `total_salary` 等敏感欄位。所有涉及金錢的最終數值必須由後端根據 `salary_amount` 重新計算產出。

---

## 8. 錯誤排除與重構策略 (Bug Resolution Strategy)

**目的**：阻斷舊 Bug 延續，強制重新實作。

### 邏輯隔離
-   針對舊系統中「出勤/薪資計算誤差」等已知 Bug，重構時 **禁止參考** 舊有的 `utils` 或舊版計算函式。

### 全新實作
-   重構該模組時，應直接根據本白皮書定義的 API 與資料表結構「從零撰寫」邏輯。

### 失敗處理
-   所有 API 必須回傳標準錯誤格式 `{ success: boolean, message: string, error_code: string }`，並在前端 UI 顯示對應的提示訊息。

---

## 9. 狀態管理與樂觀更新 (State & Optimistic UI)

**目的**：解決 UI 閃爍與操作延遲感。

### 樂觀更新 (Optimistic Updates)
-   在處理「打卡」或「請假申請」等操作時，應使用 React 的 `useOptimistic` 勾子或狀態預設，先讓介面顯示「處理中」，待資料庫確認後再更新最終狀態。

### 單一事實來源
-   前端所有資料必須在 Server Action 執行完成後，透過 `revalidatePath` 刷新快取，確保介面資料與資料庫完全同步。

---

## 10. 前端 UI 組件與使用者體驗規範 (Frontend UI & UX Guidelines)

為了保持系統 UI 的設計一致性，並消除不同瀏覽器渲染差異，禁止使用瀏覽器內建元件，並統一下列開發原則：

### 10.1 對話框與彈出視窗 (Dialog / Modal)
*   **禁止使用原生函式：** 嚴格禁止系統中出現任何 `window.alert()` 與 `window.confirm()` 等原生阻塞式彈出視窗。
*   **統一對話框模組 (`ActionDialogs.tsx`)：**
    *   **ConfirmDialog**：用於危險操作或是需要雙向確認的情境（如：主管「批准/拒絕」請假、員工「撤銷請假」），可傳入 `isLoading` 鎖定防止連點，並支援 `isDestructive` 按鈕紅色危險警告設定。
    *   **AlertDialog**：用於單向系統訊息提示或錯誤回報（如：表單送出失敗、系統通知錯誤等）。
*   **自訂 Dialog 版面重心校正：**
    *   由於系統的 Desktop 主框架左側配有實體寬度 280px 的固定側邊選單 `Sidebar`，開發任何浮動於全螢幕之上的對話框（`fixed inset-0`）時，視覺中心會跟著向左偏移。
    *   **開發守則**：對話框的外框容器（如 `components/ui/Dialog.tsx`）必須在螢幕大於 `md` 的斷點時，加上與側欄等寬的推擠補償 `md:pl-[calc(280px+1rem)]` 以保持彈跳視窗完美座落於右側實際工作區的正中央。

### 10.2 顏色與主題系統 (Theme)

為了確保跨系統、跨裝置的視覺一致性，並維持企業級應用的專業與沈穩感，所有 UI 開發皆須嚴格遵守以下色彩規範：

#### 10.2.1 基礎色彩定義 (Color Palette)
*   **主色調 (Primary)**: 系統品牌色 (`orange-500` 系為主色)，用於主要的 Call-to-Action 按鈕、重要焦點與活躍狀態。
*   **亮色模式背景 (Light Mode Backgrounds)**:
    *   主畫面底板 (App Background): `bg-background-light` (預設為 `#E0E0E0`) 或 `bg-slate-50`。
    *   卡片容器 (Cards/Surfaces): `bg-white`，建立與底板間微微浮出的立體景深。
*   **深色模式背景 (Dark Mode Backgrounds)**:
    *   **純灰階紀律**: 嚴禁使用帶有色偏的冷灰或暖灰（如 `slate`, `gray`, `zinc` 等家族），全系統深色底板**必須統一採用純無彩度的 `neutral` 色階**。
    *   主畫面底板 (App Background): 最深色的 `neutral-900` (`#171717`)。
    *   側邊欄與上方導覽列 (Navigation/Sidebar): 微亮的 `neutral-800`。
    *   卡片容器 (Cards/Surfaces): 獨立的元件層級 `neutral-800` 或利用半透明白色 (`white/5`) 提亮，建立明顯層級與景深感。

#### 10.2.2 狀態提示與互動色彩紀律 (State & Interaction Colors)
*   **警告與語意色彩 (Semantic Colors)**:
    *   ✅ 成功/已完成 (Success): 以 `emerald` 綠色系為主 (`emerald-500`)。
    *   ⚠️ 警告/待處理 (Warning): 以 `orange` 橘色系為主 (`orange-500`)。
    *   🚨 錯誤/拒絕 (Error/Destructive): 以 `rose` 或 `red` 紅色系為主 (`rose-500`)。
*   **狀態辨識的色彩紀律 (State Indication)**:
    為維持版面的專業度與長時間閱讀的舒適性，當 UI 必須呈現如「啟用/停用」、「結算/未結算」、「例假/上班」的列表或卡片狀態時，**嚴禁**大面積地修改該區塊內的「實體文字或背景主題顏色」（例如將整個卡片內的數字和文字都變紅或變綠）。狀態差異的展現應收斂於：
    1.  **專用的狀態微章 (Badge)**: 於右上角或標題旁使用半透明底色的小徽章 (`bg-[color]-100` / `dark:bg-[color]-900/40`) 標示狀態。
    2.  **卡片背景底色的微調**: 利用系統既有色階產生「下沉」或「提亮」的錯覺。例如：(亮色) `white` 退為微灰 `slate-50 / neutral-50`；(暗色) `neutral-900` 微微浮出為 `neutral-900/40`。以此區分靜態或非活躍的物件，確保任何狀態下數據的絕對可讀性。

#### 10.2.3 深色模式實作規範 (Dark Mode)
*   **全面採用 Tailwind v4 `dark:` 前綴**：所有 Custom Component（如 `Card`、`LeaveTable`、`ActionDialogs` 等）皆須實作亮色與暗色雙版本的 Utility Classes。
*   **全域深色切換機制 (Global Dark Mode Toggle)**：因專案使用 Tailwind CSS v4，若要由 `<ThemeToggle />` 手動切換 `<html>` 標籤的 `.dark` class 來改變全站主題，必須確保在 `app/globals.css` 頂端宣告 `@custom-variant dark (&:is(.dark *));`，以喚醒對應的 `dark:` 偽樣式。
*   **嚴禁硬刻樣式 (No Hardcoded CSS Overrides)**：絕對禁止在 `globals.css` 內部使用寫死的自訂 Class + `!important`（如 `.dark .card-root { background-color: ... !important; }`）來強行調整深色背景。所有顏色變化都必須收斂回歸到 React 元件階層的 Tailwind 原生 class。

### 9.2 全域元件快取刷新 (Global Layout Revalidation)
-   **痛點與問題**：在 Next.js App Router 中，位於根目錄 `layout.tsx` 裡面的全域元件（如 Header 內的 `NotificationBell`），由於其高度快取的特性，常見的 `revalidatePath('/')` 有時無法順利觸發其內部 Server Component 的重新渲染。
-   **正確做法**：針對這類全域常駐的狀態更新（例如：全部標記為已讀、清除所有通知），必須於 Server Action 結尾精準呼叫 **`revalidatePath('/', 'layout')`**，強制要求 Next.js 放棄根路由階層的 Cache 並完整重繪，才能確保右上角通知數字能瞬間反應使用者的刪除操作。

---

## 10. 核心技術實作規範 (Core Technical Standards)

### 10.1 時區處理 (Timezone Handling)
資料庫儲存的是 **UTC ISO String** (e.g., `...T01:00:00Z`)，但在前端 `<input type="datetime-local">` 顯示時，**必須轉換為本地時間格式字符串 (Asia/Taipei)**。

-   **錯誤做法**: 直接將 DB 的 UTC ISO String 塞入 input `value`。
    -   *後果*: 瀏覽器會忽略 `Z` 或無法解析，導致顯示時間偏移 (e.g., 09:00 顯示為 17:00)。
-   **正確做法**: 使用 Helper Function 轉換為 `YYYY-MM-DDTHH:mm` (Local Time)。
    ```typescript
    const toLocalISOString = (isoString: string) => {
        const date = new Date(isoString); // Browser converts UTC to Local Date Object
        // Manually format to YYYY-MM-DDTHH:mm using local components
        // (getFullYear, getMonth, etc.)
        // DO NOT use toISOString() here as it converts back to UTC.
    }
    ```
-   **資料提交**: 提交給 Backend Action 前，需將 Input 的 Local String 轉回 **UTC ISO String** (`new Date(localString).toISOString()`)。

### 10.2 驗證邏輯 (Validation Logic)
驗證必須是 **即時 (Real-time)** 且 **具備恢復性 (Recoverable)**。

-   **即時檢查**: 當輸入變更時 (e.g., `onChange`) 立即觸發驗證。
-   **錯誤恢復**:
    -   錯誤發生時 (如「金額不得為負」)，**不可** 清空使用者已輸入的數值。
    -   必須保留非法數值並顯示紅框，直到使用者修正為止。

### 10.3 響應式佈局與輸入元件 (RWD & Inputs)
為確保在 iOS Safari 及小螢幕裝置上的相容性，所有控制列 (Control Bar) 與輸入元件需遵守以下規範：

-   **控制列佈局 (Control Bars)**:
    -   **統一模式**: 使用 `flex items-center gap-2` (標籤與輸入框並排)。
    -   **避免堆疊**: 除非空間極度受限，否則避免在手機版強制 `flex-col`，以維持操作一致性。
-   **輸入框寬度與樣式 (Input Sizing & Reset)**:
    -   **彈性縮放**: 設定 `w-full sm:w-auto`。
    -   **防止破版**: 利用 `flex-shrink` 讓輸入框自動適應剩餘空間。
    -   **iOS Safari 修正 (全域標準)**: 基於 iOS 原生瀏覽器對於 `<input>` (特別是 `type="date"`) 未指定 box model 時會將 padding 外溢導致 `w-full` 超出容器寬度的問題，所有自訂義輸入框元件 (如 `components/ui/Input.tsx`) **必須** 強制加入以下 Tailwind 類別：
        1.  `box-border`: 確保 Padding 計算向內收縮。
        2.  `appearance-none`: 移除 iOS 原生偷加的預設圓角與陰影樣式，統一視覺表現。

-   **表格響應式策略 (Responsive Tables)**:
    -   **手機版卡片化 (Card View)**: 在小螢幕 (`< md`) 上，**禁止** 使用橫向捲動表格 (Horizontal Scroll Table) 顯示關鍵操作資料。必須將每一列 (Row) 轉換為獨立的 **卡片 (Card)** 堆疊顯示，確保所有資訊與操作按鈕完整可見。
    -   **桌面版表格 (Table View)**: 在大螢幕 (`>= md`) 上維持標準表格佈局。

---

## 11. 嚴格開發規範與設計原則 (Strict Coding Standards)

> **生效日期**: 2026-02-13
> **適用範圍**: 所有後端邏輯 (Server Actions), API Routes, 及 Supabase Client 互動。

為了確保系統在 **Vercel** 與 **Supabase** 等嚴格環境下能順利部署並維持穩定，本專案採用以下開發規範。所有程式碼提交 (Commit) 前必須通過 `tsc --noEmit` 檢查。

### 11.1 Supabase 型別定義規範

Supabase 的 TypeScript 型別自動生成 (`supabase gen types`) 在某些邊緣情況下可能不完整，導致嚴格模式下的型別推斷失效 (回傳 `never`)。

#### 手動修正 `types/supabase.ts`
若自動生成的型別導致 `never` 錯誤，必須確認 `types/supabase.ts` 對應的 Table 定義包含以下關鍵欄位：

1.  **Relationships**: 即使沒有關聯，也必須顯式定義為空陣列。
    ```typescript
    Relationships: []
    ```
2.  **Schema Top-Level Keys**: `Database` 介面必須包含所有 Schema 頂層鍵值，即使是空的：
    ```typescript
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
    ```

**原因**: TypeScript 的結構化型別系統在比對 `GenericSchema` 時，若缺少這些鍵值，會判定介面不匹配而回退至 `never`。

#### Enum 同步
`types/supabase.ts` 中的 Enum 定義 (例如 `status`) **必須** 與資料庫中的 Check Constraint 完全一致。
-   **嚴禁** 在程式碼中使用字串字面量 (String Literal) 賦值給 Enum 欄位，除非該字面量已定義在型別中。
-   **範例**: 若 DB 新增 `cancelled` 狀態，TypeScript 定義檔必須同步更新，否則 `update({ status: 'cancelled' })` 會報錯。

### 11.2 嚴禁 `any` 與型別推斷策略

本專案權限極高 (涉及薪資與休假)，**嚴格禁止** 使用 `any` 來繞過型別檢查。

#### 優先使用明確型別 (Explicit Typing)
當 Supabase Client (`supabase.from(...).select(...)`) 的自動推斷失效時，**不可** 使用 `as any`。應採用以下策略：

**策略 A (推薦): 使用 `.returns<T>()`**
Supabase 官方提供的型別斷言方法。
```typescript
const { data } = await supabase
    .from('users')
    .select('id, name')
    .returns<{ id: string, name: string }[]>() // 明確宣告回傳結構
```

**策略 B (備案): 結果轉型 (Result Casting)**
若 `.returns()` 仍無法解決 (例如複雜 Join 或 `single()` 推斷錯誤)，可對 `await` 結果進行轉型，但必須定義完整的 Response 結構：
```typescript
const { data, error } = await supabase
    .from('users')
    .select('*')
    .single() as { data: UserRow | null, error: PostgrestError | null }
```

#### Server Actions 參數
Server Action 的參數 **不可** 定義為 `any`。簡易參數可直接定義，複雜物件應定義 Interface。
```typescript
// BAD
export async function updateProfile(data: any) { ... }

// GOOD
interface ProfileUpdateData {
    displayName: string;
    email: string;
}
export async function updateProfile(data: ProfileUpdateData) { ... }

### 11.3 錯誤處理與與防禦性程式設計

#### 必須檢查 `error`
在存取 `data` 之前，**必須** 先檢查 `error` 是否存在。
```typescript
const { data, error } = await supabase...

if (error) {
    console.error('Query failed:', error)
    return { error: '發生錯誤' }
}

// 只有在檢查過 error 後才能安全使用 data
console.log(data.id)
```

#### 空值處理 (Null Safety)
資料庫的 `Row` 定義中，許多欄位可能是 `null` (例如 `avatar_url`, `annual_leave_used`)。使用前必須進行 Null Check 或提供預設值。
```typescript
// BAD
const usedDays = user.annual_leave_used + 5; // Object is possibly 'null'

// GOOD
const usedDays = (user.annual_leave_used || 0) + 5;
```

### 11.4 部署檢查清單 (Deployment Checklist)

在推送到 Vercel 之前，請執行以下命令確保環境健康：

1.  **型別檢查**: `npx tsc --noEmit` (必須 0 錯誤)
2.  **Lint 檢查**: `npm run lint`
3.  **依賴檢查**: 確認 `package.json` 中的 `@supabase/supabase-js` 版本與本地開發環境一致。

### 11.5 資料查詢與權限防呆 (Query & Access Control)
-   **多重角色篩選陷阱**：針對 Supabase `users` 或關聯查詢時，若需囊括「所有有效員工」，開發者常犯的錯誤是單純 `.eq('role', 'employee')`。因為管理員本身也是員工，這會導致報表遺漏。**正確做法**：永遠明確使用陣列 IN 查詢，如：`.in('role', ['employee', 'manager', 'super_admin'])`。
-   **欄位選取避免沾黏**：在使用 `.select()` 時，若手動組合字串不當（例如變數相加未留空白），容易產生如 `rolesalary_amount` 的語法錯誤。應善用多行字串模板（Template Literals）換行排版。

---

## 12. 錯誤處理標準 (Error Handling Standards)

**目的**：統一全系統的錯誤回傳格式與 User Experience。

### 12.1 Server Action 回傳結構
所有 Server Actions **必須** 回傳符合以下定義的 `ActionResult<T>`：

```typescript
type ActionResult<T = void> = 
  | { success: true; data: T }
  | { success: false; error: AppError };

interface AppError {
  code: string;       // 錯誤代碼 (e.g., 'AUTH_001')
  message: string;    // 人類可讀訊息 (e.g., '帳號或密碼錯誤')
  details?: unknown;  // 除錯用附加資訊 (Optional)
}
```

### 12.2 標準錯誤代碼 (Common Error Codes)

| 代碼 | 說明 | 處理建議 |
| :--- | :--- | :--- |
| `AUTH_001` | 未登入或 Session 過期 | 導向 `/login` |
| `AUTH_003` | 權限不足 (Forbidden) | 顯示「您無權執行此操作」Modal |
| `VAL_001` | 資料驗證失敗 (Zod Error) | 在對應欄位顯示紅字錯誤 |
| `DB_001` | 資料庫連線或查詢錯誤 | 顯示「系統繁忙，請稍後再試」 |
| `DB_002` | 資料不存在 (Not Found) | 導向 404 或列表頁 |
| `BIZ_001` | 業務邏輯衝突 (e.g. 重複打卡) | 顯示 Toast 或 Inline Alert |

### 12.3 錯誤顯示 UX
1.  **表單驗證 (VAL_001)**: 必須顯示於該 Input 下方。
2.  **系統級錯誤 (DB_001)**: 使用 Toast 通知 (右下角)。
3.  **阻斷性錯誤 (AUTH_***)**: 使用全螢幕重導向或強制登出。

---

## 13. 檔案儲存與圖片處理規範 (File Storage & Processing)

**目的**：控制資源消耗，並確保頭像、附件等使用者內容在上傳至伺服器前已經過標準化。

### 13.1 前端上傳前處理 (Pre-processing)
-   **不依賴後端壓縮**：所有圖片的裁切與壓縮動作，**強制**在前端客戶端（Browser）完成，減省 Server Action / Supabase Storage 的頻寬與運算負擔。
-   **裁切與顯示 (Cropping & UI)**：針對頭像 (`avatar_url`) 等特定用途圖片，選擇檔案後應即刻喚起客戶端裁切模態框 (`ImageCropper`)，鎖定對應比例（頭像強制 1:1，且於全系統如 Header、Sidebar、Profile Card 等處均須套用 `rounded-full` 以正圓形顯示）。
-   **壓縮閥值 (Compression)**：客戶端自動執行 Iterative Compression 降階壓縮。目標空間佔用為 **`< 200KB`**，只有小於等於此條件的 Blob 才能進入 `upload` 程序。

### 13.2 Storage Bucket 管理與清理
-   **公有與私有**：像是登入狀態的頭像通常使用 `public` 設定。
-   **快取清除 (Cache Busting)**：上傳新檔案覆蓋舊網址時，為了避免瀏覽器永久快取，更新後的 URL 應自動附加時戳參數 (`?t=12345678`) 強制刷新視圖。
-   **孤立檔案清理 (Cleanup)**：如果系統允許上傳替換，Server Action 在獲取新圖片 URL 並更新 Database 成功後，**必須** 呼叫 Supabase 移除相同路徑下的舊檔案以避免無用資料堆疊。

