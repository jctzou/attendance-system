# 系統架構白皮書 (系統重構 v2.0)

> **狀態**: 草稿
> **日期**: 2026-02-11
> **目的**: 作為考勤與薪資管理系統深度重構的「單一事實來源 (Single Source of Truth)」。

## 1. 系統概觀

本系統是一個基於 **Next.js 14+ (App Router)** 的應用程式，整合 **Supabase** 作為後端服務（認證、資料庫、即時更新）。系統設計旨在管理員工出勤、請假及薪資計算，並具備嚴格的角色存取控制 (RBAC)。

### 核心技術
-   **框架**: Next.js 15 (App Router)
-   **語言**: TypeScript (Strict Mode)
-   **資料庫**: PostgreSQL (透過 Supabase)
-   **樣式**: Tailwind CSS v4
-   **狀態管理**: React Server Components (RSC) + Server Actions + React Hooks

---

## 2. 資料庫綱要 (不可變更約束)

重構工作 **必須** 尊重現有的資料庫結構。除有遷移計畫外，不得重新命名或刪除任何欄位，應用程式邏輯必須適應此結構。

### `users` (使用者)
員工資料與設定。
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | UUID | 主鍵 (連結至 `auth.users`) |
| `display_name` | Text | 使用者全名 |
| `employee_id` | Text | 員工編號 (例如：EMP001) |
| `avatar_url` | Text | 頭像圖片 URL (Supabase Storage) |
| `role` | Enum | `'employee'`(員工), `'manager'`(經理), `'super_admin'`(超級管理員) |
| `salary_type` | Enum | `'monthly'`(月薪), `'hourly'`(時薪) |
| `salary_amount` | Numeric | 基本薪資或時薪費率 |
| `work_start_time` | Time | 排班開始時間 (例如：'09:00') |
| `work_end_time` | Time | 排班結束時間 (例如：'18:00') |
| `onboard_date` | Date | 到職日 (特休計算基準) |
| `annual_leave_total` | Numeric | 本年度特休總天數 |
| `annual_leave_used` | Numeric | 本年度已休特休天數 |
| `last_reset_date` | Date | 上次特休重置日期 |

### `annual_leave_logs` (特休記錄)
特休發放與結算軌跡。
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | 主鍵 |
| `user_id` | UUID | 外鍵連結至 `users` |
| `year` | Integer | 年資年度 |
| `action` | Text | `'grant'`(發放), `'reset'`(結算) |
| `days_change` | Numeric | 異動天數 |
| `description` | Text | 說明 |

### `attendance` (出勤)
每日工作記錄。
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | 主鍵 |
| `user_id` | UUID | 外鍵連結至 `users` |
| `work_date` | Date | 記錄日期 |
| `clock_in_time` | ISO Timestamp | 實際上班打卡時間 |
| `clock_out_time` | ISO Timestamp | 實際下班打卡時間 |
| `work_hours` | Numeric | 計算後的工作時數 |
| `break_duration` | Numeric | 午休時數 (Hourly Only) |
| `status` | Text | 例如：`'normal'`(正常), `'late'`(遲到), `'early_leave'`(早退), `'absent'`(缺席) |

### `leaves` (請假)
請假申請與記錄。
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | 主鍵 |
| `user_id` | UUID | 外鍵連結至 `users` |
| `leave_type` | Text | 例如：`'annual'`(特休), `'sick'`(病假), `'personal'`(事假) |
| `start_date` | Timestamp | 請假開始時間 |
| `end_date` | Timestamp | 請假結束時間 |
| `days` | Numeric | 請假天數 (最小單位 0.5 天) |
| `status` | Text | `'pending'`(待審核), `'approved'`(已核准), `'rejected'`(已駁回), `'cancelled'`(已取消) |

### `salary_records` (薪資記錄)
每月薪資快照。
| 欄位 | 類型 | 說明 |
| :--- | :--- | :--- |
| `id` | BigInt | 主鍵 |
| `user_id` | UUID | 外鍵連結至 `users` |
| `year_month` | Text | 格式 `'YYYY-MM'` |
| `base_salary` | Numeric | 計算後的本薪 |
| `bonus` | Numeric | 手動加給獎金 |
| `total_salary` | Numeric | 最終應發金額 |
| `is_paid` | Boolean | 是否已「結算」(鎖定) |
| `paid_at` | Timestamptz | 結算時間 |
| `settled_data` | JSONB | **快照 (Snapshot)**：結算當下的所有詳細數據 (含 rate, work_hours, breakdown) |
| `notes` | Text | 管理員備註 |

---

## 3. 設計系統與 UI/UX

為解決「混亂與不一致的 UI」問題，我們定義一套統一的視覺語言。

### 色彩計畫 (Tailwind)
-   **主色 (Primary)**: `var(--color-primary)` (#FF5F05 - 企業橘)
-   **背景色 (Background)**:
    -   亮色模式: `var(--color-background-light)` (#E0E0E0)
    -   深色模式: `var(--color-background-dark)` (#0F172A)
-   **表面色 (Surface/Cards)**:
    -   亮色模式: `var(--color-card-light)` (#FFFFFF)
    -   深色模式: `var(--color-card-dark)` (#1E293B)
-   **狀態色**:
    -   成功: Emerald/Teal (翠綠/藍綠)
    -   警告: Amber/Orange (琥珀/橘)
    -   錯誤: Rose/Red (玫瑰/紅)

### 字體排印
-   **標題**: `Inter` / `Noto Sans TC` (粗體，緊湊字距)
-   **內文**: `Inter` / `Noto Sans TC`
-   **數字/代碼**: `JetBrains Mono`

### 元件設計模式
1.  **佈局**: `MainLayout` 包覆 `Sidebar` (左側，可折疊) 與 `Header` (頂部)。
2.  **卡片**: 所有資料呈現皆使用圓角卡片 (rounded-xl) 並帶有細微陰影 (`shadow-sm` -> hover 時 `shadow-md`)。
3.  **對話框 (Dialogs)**:
    -   **必須** 使用 `fixed inset-0` 遮罩層搭配背景模糊 (backdrop blur)。
    -   **嚴禁** 使用 `<form>` 標籤進行資料提交，以防止頁面重整。
    -   **必須** 使用手動狀態控制 (`useState`) 處理輸入欄位。

4.  **確認視窗 (Confirmation Modals)**:
    -   **嚴禁** 使用瀏覽器原生的 `window.alert` 或 `window.confirm`。
    -   **必須** 使用系統統一的自定義 Modal 元件 (e.g., `<ConfirmDialog>` or `<Dialog>`)。
    -   **互動規範**:
        -   **點擊遮罩 (Backdrop Click)**: 應關閉視窗 (除非設定 `disableCloseOnOverlay`).
        -   **ESC 鍵**: 應關閉視窗。
        -   **背景鎖定**: 開啟時應鎖定 `body` 捲動。
    -   **樣式規範**:
        -   **Header**: 必須包含標題與關閉按鈕 (X)。
        -   **Footer**: 必須包含操作按鈕，**主要動作**在右側，**取消動作**在左側 (或左側對齊)。
        -   **Destructive Action**: 若為刪除/取消類操作，確認按鈕必須使用紅色 (`bg-red-500`)。

5.  **互動列表與網格 (Interactive Lists & Grids)**:
    -   **項目狀態 (Item States)**:
        -   **預設 (Default)**: `bg-white` (Dark: `bg-slate-800`), `border-slate-200`.
        -   **選取/使用中 (Active)**: `border-[var(--color-primary)]` 或 `ring-[var(--color-primary)]`.
        -   **停用/排除 (Disabled/Excluded)**: `bg-slate-50` (Dark: `bg-slate-900`), `text-slate-400`, `line-through` (若為剔除項目).
        -   **特殊強調 (例假日/警告)**: 必須使用 **Rose/Red** 色系區隔。
            -   Light: `bg-rose-50`, `border-rose-100`, `text-rose-600`
            -   Dark: `bg-rose-900/10`, `border-rose-900/30`, `text-rose-400`

---

## 4. 技術架構 (重構目標)

### 後端原則
1.  **Server Actions 優先**: 邏輯應存放於與功能並列的 `actions.ts` 檔案中。
2.  **嚴格型別**: 所有資料庫回傳值必須定義型別，禁止使用 `any`。
3.  **權限檢查**: 每個 Server Action 在執行前必須驗證 `user.role`。
4.  **RLS 相容性**: 查詢語法必須符合 Row Level Security (RLS) 政策。

### 前端原則
1.  **元件模組化**:
    -   頁面 (Screens) > 功能 (Features) > 元件 (Components) > UI 元素 (UI Elements)。
    -   範例：`app/admin/salary/page.tsx` 是 *頁面*。`SalarySettingsDialog` 是 *功能*。`Button` 是 *UI 元素*。
2.  **無 Form 政策**: 為防止「閃爍」Bug，嚴格禁止使用標準 HTML 表單提交。請使用 `onClick` + `async/await`。
3.  **載入狀態**: 所有非同步動作必須顯示明確的載入回饋 (Loading Spirnner 或 Skeleton)。
4.  **錯誤處理 (Error Handling)**:
    -   **內嵌錯誤顯示 (Inline Error Display)**: 當操作發生錯誤時（特別是在對話框/模態視窗中），錯誤訊息應顯示於該視窗內部的專屬錯誤區塊（Inline Error Container），**嚴禁**使用全域 `alert` 或 `window.confirm` 中斷使用者流程，亦不建議使用易被忽略的 Toast 通知。

### 目錄結構 (目標)
```
/app
  /admin
    /salary          # 功能：薪資管理
      /components    # 功能專屬元件
      actions.ts     # 功能專屬後端邏輯
      page.tsx       # 主要進入點
    /attendance      # 功能：出勤管理
  /employee          # 功能：員工視角
/components
  /ui                # 共用原子元件 (Button, Input, Card)
  /layout            # 側邊欄, 頂部導覽列
/utils
  /supabase          # 核心客戶端
  /format            # 日期/貨幣格式化工具
```


## 6. 核心業務邏輯規範 (Business Logic Standards)

**目的**：消除前後端計算不一致導致的 Bug。

### 薪資計算公式
-   **月薪制**：`當月實發 = (基本薪資 + 獎金) - (缺勤扣款 + 遲到/早退扣款)`
-   **扣款標準**：遲到/早退之扣款邏輯必須由後端 `actions.ts` 統一計算，**禁止**在前端進行金額運算。

### 出勤判定邏輯
-   **基準時間**：系統應以 `users.work_start_time` 為準。超過 1 分鐘即標註 `status = 'late'`。
-   **防呆機制**：同一 `user_id` 在同一 `work_date` 僅允許一筆 `attendance` 記錄（除非特定排班需求）。重複打卡應視為 **更新 (Update)** 而非新增 (Insert)。

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
### 10.3 響應式佈局與輸入元件 (RWD & Inputs)
為確保在 iOS Safari 及小螢幕裝置上的相容性，所有控制列 (Control Bar) 與輸入元件需遵守以下規範：

-   **控制列佈局 (Control Bars)**:
    -   **統一模式**: 使用 `flex items-center gap-2` (標籤與輸入框並排)。
    -   **避免堆疊**: 除非空間極度受限，否則避免在手機版強制 `flex-col`，以維持操作一致性。
-   **輸入框寬度 (Input Sizing)**:
    -   **彈性縮放**: 設定 `w-full sm:w-auto`。
    -   **防止破版**: 利用 `flex-shrink` 讓輸入框自動適應剩餘空間。
    -   **iOS Safari 修正**: 若遇容器溢出問題，可於 Flex 父容器加入 `min-w-0` 或於輸入框加入 `max-w-full`。

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
```

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
