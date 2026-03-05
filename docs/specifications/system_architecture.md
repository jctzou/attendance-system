# 系統架構白皮書 (System Architecture v3.0)

> **狀態**: 第 3 版 (Release)
> **日期**: 2026-03-05
> **目的**: 本文件為系統開發的「單一事實來源 (Single Source of Truth)」，定義所有全域規範、資料庫結構、全域 UI 標準、即時廣播架構與防呆機制。所有頁面開發必須嚴格遵循此標準。

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

所有資料表結構以此定義為準。各資料表的詳細關聯與建立 SQL，請參考 `supabase/migrations/`。

### `users` (使用者)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | UUID | PK, linked to `auth.users` |
| `display_name` | Text | 顯示名稱 |
| `employee_id` | Text | 員工編號 (Unique) |
| `avatar_url` | Text | 頭像 URL (Supabase Storage: `avatars`) |
| `role` | Enum | `'employee'`, `'manager'`, `'super_admin'` |
| `salary_type` | Enum | `'monthly'`(月薪), `'hourly'`(時薪) |
| `salary_amount` | Numeric | 基本薪資或時薪 |
| `work_start_time` | Time | 排班開始 (Local Time HH:mm:ss) |
| `work_end_time` | Time | 排班結束 (Local Time HH:mm:ss) |
| `break_hours` | Numeric | 個人固定午休設定 (Optional) |
| `onboard_date` | Date | **到職日** (特休計算基準) |
| `annual_leave_total` | Numeric | 本年度特休總天數 |
| `annual_leave_used` | Numeric | 本年度已休特休天數 |

### `attendance` (出勤)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK -> users.id |
| `work_date` | Date | **台北時間**日期 (YYYY-MM-DD) |
| `clock_in_time` | Timestamptz | 上班打卡 (UTC ISO) |
| `clock_out_time` | Timestamptz | 下班打卡 (UTC ISO) |
| `work_minutes` | BigInt | 計算工時 (儲存單位：**分鐘**) |
| `break_duration` | BigInt | 午休扣除時間 (儲存單位：**分鐘**) |
| `status` | Text | `'normal'` (全站統一，不使用 `'late'` 等字詞) |
| `is_edited` | Boolean | 是否經過手動修改 |

### `leaves` (請假)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK → users.id |
| `leave_type` | Text | `sick_leave`, `personal_leave`, `annual_leave`, `family_care_leave`, `menstrual_leave`, `other` |
| `start_date` / `end_date` | Date | 單日日期 (等同) |
| `days` | Numeric | 天數，允許 `0.5` 或 `1.0` |
| `status` | Text | `pending`, `approved`, `rejected`, `cancel_pending`, `cancelled` |
| `group_id` | UUID | 多日請假的群組識別碼 (同次申請共用) |
| `approver_id` | UUID | FK → users.id，審核主管 ID |
| `cancel_reason` | Text | 員工申請取消時的原因 |

### `notifications` (通知)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `user_id` | UUID | FK → users.id |
| `type` | Text | `new_leave_request`, `leave_approved`, 等 |
| `is_read` / `is_cleared`| Boolean | 已讀與軟刪除旗標 |

### `salary_records` (薪資記錄)
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | PK |
| `year_month` | Text | `YYYY-MM` |
| `is_paid` | Boolean | 是否已結算凍結 |
| `settled_data` | JSONB | **結算快照** (Snapshot) |

---

## 3. 全域 UI/UX 設計規範

### 3.1 色彩系統與深色模式
-   **Primary**: `orange-500`。
-   **狀態文字與背景**: 嚴禁整塊卡片染色。必須使用徽章 (Badge) 或文字顏色。
    -   Success: `emerald`
    -   Warning: `orange` / `amber`
    -   Destructive: `red` / `rose`
-   **深色模式 (v4)**:
    - 採用純無彩 `neutral` 色階，嚴禁使用 `slate` 等微冷/微暖灰階作為背景。
    - 禁止在 css 使用 `!important` 寫死。一律使用 `dark:`。
    - `globals.css` 中以 `@custom-variant dark (&:is(.dark *));` 喚醒全域。

### 3.2 對話框與彈跳視窗 (Dialog / Modal)
-   **禁止原生**: 禁止出現 `window.alert()` 或 `window.confirm()`。
-   **全域元件 (`ActionDialogs.tsx`)**:
    -   使用 `ConfirmDialog` 作為任何操作確認（支援 `isLoading`）。
    -   使用 `AlertDialog` 作為單方面提示。
-   **Sidebar 推擠補償**:
    -   包含 `fixed inset-0` 的視窗，在大螢幕 (`>= md`) 必須設置補償：`md:pl-[calc(280px+1rem)]`，讓對話框中心點對齊右側可用區域而非整個螢幕。

### 3.3 響應式佈局與 Input
-   **iOS Safari `<input>` 修正**:
    - 所有 `<input>` 必須包含 `box-border` 與 `appearance-none` 消除原生圓角外溢。
-   **表格轉換卡片**:
    - 面對資料列表，`< md` 的手機裝置 **絕對禁止橫向捲動表格**，必須改以堆疊卡片 (`Card`) 呈現。大螢幕再使用 `Table`。

### 3.4 全域載入體驗 (Global Loading)
-   導入 **`nextjs-toploader`** 解決 App Router 軟導航停頓感。
-   頂部出現 `#FF5F05` 進度條。
-   大範圍資料讀取可搭配 Skeleton 骨架屏 (如 `DayCardSkeleton`) 提供脈衝效果緩解等待焦慮。

---

## 4. 全域即時通訊與通知架構 (Realtime & Notification Broadcast)

針對全站「現在上班員工頭像連動」與「通知紅點即時跳動」，統一透過 **Supabase Broadcast** 進行。

### 4.1 RLS Bypass 與 Server Broadcast
1.  **RLS 限制**: 前端觸發無法跨員工存取 (例如員工 A 打卡，想讓員工 B 看到最新名單)。
2.  **廣播時機**: Server Action 完成資料寫入後，呼叫 `utils/supabase/broadcast.ts` (`sendServerBroadcast`)。
3.  **大原則**: 在 Server Action 內，凡是涉及「取得全局資料」或「替別人發送通知」，一律強制使用含有 `SERVICE_ROLE_KEY` 的 **`createAdminClient()`**。
    - 例外：一般使用者自身操作仍用普通 `createClient()`。

### 4.2 通知產生的最佳實踐 (DB Triggers vs Server Actions)
由於「多日請假拆分 (`group_id`)」會一次 Insert 多筆 Row，若在 Server Action 或普通 Trigger 各自發通知，會造成通知訊息爆炸。
- **資料庫 Trigger (唯一寫入通知方)**: `new_leave_request`, `leave_approved`, `leave_rejected`, `leave_cancel_request` 由 DB Trigger `handle_leave_notifications()` 負責寫入，並透過 `group_id` 去重，一組申請只會產生一則資料庫通知。
- **Server Action 廣播紅點 (僅推訊號)**: Server Action 以 Broadcast 發出信號，觸發前端 `NotificationBell` 數字 +1 並發起重新 Fetching。
- **例外**: 刪除動作 (硬刪除如 `cancel_pending`) 觸發器抓不到，改由 Server Action 直接執行刪除並呼叫 `createNotification()`。

---

## 5. 時區與通用邏輯 (Timezone & Engineering)

### 5.1 單一時區規範
系統一律鎖死在 **Asia/Taipei (UTC+8)**。
-   資料庫的 `Timestamptz` 存 UTC。`Date` 存 `YYYY-MM-DD` (已視為台北時間)。
-   前端 Input datetime-local 變更需手動處理，呼叫轉換 `formatToTaipeiTime`。

### 5.2 引擎化架構 (Engine Utils)
所有計算邏輯強制內聚於 Utils：
1.  `utils/attendance-engine.ts`: 工時分鐘轉換、淨時間計算 (扣午休)。
    - **Target Net Time 計算**: 全站採「表定淨工時」為目標。比對時必定以 `Actual Net Time - Target Net Time` 算誤差，避免扣休爭議。
2.  `utils/salary-engine.ts`: 日薪 `Math.round(月薪/30)` 及 `Math.ceil()` 無條件進位總計。
3.  `utils/leave-policies.ts`: 負責假別天數與權重計算 (事假1.0、病假0.5)。

### 5.3 邏輯軟刪除 (Soft Deletion)
通知等審計資料嚴禁 `DELETE`，改以 `is_cleared = true` 並於 GET API 加 `eq('is_cleared', false)` 過濾。例外：取消請假為保持列表乾淨，採用硬刪除，後果需以 Modal 向用戶確認。

---

## 6. 上傳、儲存與 AI 整合 (Storage & Ext. Services)

### 6.1 前端裁切與壓縮
-  **資源控制**: 頭像等使用者圖檔，一律在登入端通過 `ImageCropper` 強制 1:1 裁切，並壓縮至 **< 200KB** 始可上傳。
-  **Cache Busting**: 覆蓋舊檔時，前端 URL 需附加時間戳避免 Browser 舊快取。並務必從 Bucket 移除孤兒舊檔。

### 6.2 AI 運勢導師 (Fortune Integration)
-  **定位**: 結合 `gpt-4o-mini` 提供員工打卡時隨機短語 (< 50字)。
-  **存取點**: 打卡 Server Action `fortune.ts`。
-  **暫存**: 客戶端同一日 (Taipei Date) 內快取，隔日重新抓取。預設準備 Fallback 「今天也是充滿希望的一天！」。

---

## 7. 開發規範與 TypeScript

### 7.1 Server Actions 要求
-   **Zod**: 所有輸入須經 `zod.safeParse()`。
-   **無 any**: typescript 絕對禁止 `any`。若推斷有誤用 `.returns<T>()`。
-   **標準回傳**: `ActionResult<T> = { success: boolean, data?: T, error?: AppError }`。

### 7.2 Enum 同步與 `never`
如果 Supabase `types/supabase.ts` 被推斷為 `never`，必檢查是否有漏掉空的物件 (如 `Relationships: []`)。請隨時確保 Enum 狀態欄位於 DB 與 TypeScript Type 完全一致。

---
