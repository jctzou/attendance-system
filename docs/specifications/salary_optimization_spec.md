# 薪資管理優化規格書 (Salary Management Optimization Spec)

> **版本**: v1.0
> **日期**: 2026-02-12
> **狀態**: 進行中 (In Progress)
> **目標**: 優化現有薪資管理頁面，明確區分「未結算」與「已結算」狀態，確保歷史數據不可變性，並提供實時數據對照功能。
> **參考文件**: [系統架構白皮書 (System Architecture)](system_architecture.md) - 定義了全域資料庫結構、設計規範與技術棧。

---

## 1. 系統概觀與角色權限

### 1.1 核心功能
管理員 (Admin/Manager) 可在此頁面檢視所有員工（包含自己）的月薪資計算結果，並執行「結算」或「取消結算」動作。

### 1.2 權限範圍
-   **可見範圍**: 所有 `users` 資料表中的有效員工（包含 `role = 'employee'`, `'manager'`, `'super_admin'`）。
-   **操作權限**: 僅 `manager` 與 `super_admin` 可執行結算與獎金調整。

---

## 2. 介面狀態與視覺規範

本頁面以「員工卡片 (Employee Card)」為核心單元，依據薪資狀態分為兩種顯示模式。

### 2.1 狀態定義
| 狀態 | 判斷依據 | 說明 |
| :--- | :--- | :--- |
| **未結算 (Unsettled)** | `salary_records.is_paid = false` | 顯示即時計算數據，允許編輯獎金，允許結算。 |
| **已結算 (Settled)** | `salary_records.is_paid = true` | 顯示結算當下快照 (Snapshot)，數據唯讀，允許展開查看即時數據，允許取消結算。 |

### 2.2 色彩計畫 (依據統一設計規範)
-   **卡片底色**: 統一使用 `bg-[var(--color-card-light)]` (Dark: `bg-[var(--color-card-dark)]`)。
-   **狀態區分**:
    -   **未結算**: 使用標準邊框色 `border-slate-200`。
    -   **已結算**: 使用 **Emerald** 色系邊框 (`border-emerald-500`) 與文字強調，以區別唯讀狀態。

---

## 3. 詳細業務規則 (Business Rules)

### 3.1 未結算狀態 (Unsettled State)
此為預設狀態，數據隨員工出勤、請假狀況即時變動。

#### 3.1.1 數據來源
-   **基本薪資**: 
    -   **月薪制**: 來自 `users.salary_amount`。
    -   **鐘點制**: `users.salary_amount` (時薪) × `attendance.work_hours` (淨工時)。
        -   *Note: 淨工時已於打卡時扣除員工自選的午休時間 (1.0/1.5/2.0 hr)。*
-   **獎金**: 來自 `salary_records.bonus` (可編輯)。
-   **其他加減項**: 來自實時計算 (Real-time Calculation) 的遲到/早退扣款。

#### 3.1.2 操作功能
-   **編輯獎金**: 顯示「編輯」按鈕，點擊開啟 `BonusDialog`。
-   **結算薪資**:
    -   按鈕文字: 「結算薪資」
    -   樣式: `Primary Button` (Brand Color)
    -   行為: 點擊後觸發 `settleSalary` Action。

---

### 3.2 已結算狀態 (Settled State)
此狀態代表薪資單已發送或鎖定，數據必須完全凍結。

#### 3.2.1 數據來源 (Snapshot)
-   **所有數據**: 必須直接讀取 `salary_records.settled_data` JSON 欄位。
-   **不可變性**: 即使員工的時薪 (`users.salary_amount`) 或出勤記錄 (`attendance`) 在結算後被修改，此卡片顯示的金額 **絕對不可變動**。
-   **唯讀限制**: 隱藏/禁用「編輯獎金」按鈕。

#### 3.2.2 擴充功能：實時數據對照 (Live Data Expansion)
-   **UI 元件**: 在卡片底部安插一個「可展開/收合」的區域 (Accordion/Collapsible)。
-   **觸發方式**: 點擊「查看目前計算」或類似連結文字。
-   **內容**: 執行一次 `calculateMonthlySalary` (Live Mode)，顯示若現在重新計算的金額。
-   **目的**: 讓管理員確認結算後是否有補打卡或資料異動，以決定是否需要「重算」。

#### 3.2.3 操作功能
    -   **確認對話框 (Confirmation Dialog)**:
        -   **標題**: 「確認取消結算」
        -   **內容**: 「這將會解除鎖定，並取消員工的薪資記錄，稍後你可以再重新結算」
        -   **按鈕**:
            -   [取消] (Ghost/Outline)
            -   [確定取消結算] (Destructive)

---

## 4. 資料結構與存儲 (Data Schema)

(略 - 保持原樣)

---

## 5. 前端實作邏輯 (Page Logic)

(略 - 保持原樣)

---

## 6. 特殊邊界案例 (Edge Cases)

(略 - 保持原樣)

---

## 7. UI 排版與設計規範 (UI/UX Design Analysis)

### 7.1 頁面結構 (Page Structure)
-   **控制列 (Control Bar)**:
    -   **月份選擇**:
        -   請參照 `system_architecture.md` 第 10.3 節 (響應式佈局規範)。
        -   採用標準 `flex items-center gap-2` 模式。
    -   **設定按鈕**: 保持顯眼位置。

### 7.2 員工卡片設計 (Employee Card Design)

#### 層次 A: 識別與狀態 (Header Left)
-   **頭像 (Avatar)**: 顯示員工頭像 (圓形)，若無則顯示首字縮寫。
-   **姓名**: 粗體顯示。
-   **標籤 (Tags)**:
    -   **工資類型**: `鐘點` (Sky Blue) / `月薪` (Indigo)。
    -   **結算狀態**: 若已結算，顯示 `已結算` (Emerald + Lock Icon)。

#### 層次 B: 關鍵數據 (Header Center/Right)
為方便快速瀏覽，關鍵數字直接顯示於卡片右側（**手機版需完整顯示**，即使堆疊排列）：

1.  **主要數據區** (依薪資類型區分):
    -   **鐘點制 (Hourly)**:
        -   標頭: `工時/時薪`
        -   內容: 顯示 `總工時` (如 120h) 與 `時薪` (如 $200)。
    -   **月薪制 (Monthly)**:
        -   標頭: `假勤/月薪`
        -   內容: 顯示 `異常次數` (遲到/早退/請假) 與 `月薪基數`。
        -   格式範例: `遲1/早0/假2 | $45,000`

2.  **獎金**:
    -   顯示金額 (若 > 0 則高亮 Amber 色)。
    -   顯示備註: 截取前 4 個字，超過則加 `...` (如 "全勤獎金..." )。
3.  **實發金額**: 最大字級顯示，作為視覺焦點。

#### 層次 C: 操作區 (Header Far Right)
(略 - 保持原樣)

#### 層次 D: 展開細節 (Expanded View - 僅已結算)
-   **背景**: 使用深色/對比色背景區隔 (`bg-slate-50`)。
-   **排版**: Grid 系統 (`grid-cols-4`)。
-   **內容區塊 1 (工時/基數)**:
    -   **鐘點制**: 標頭 `工時/時薪`，內容顯示時數與時薪。
    -   **月薪制**: 標頭 `假勤/月薪`，內容顯示遲到/早退/請假次數與月薪基數。


### 7.3 設計原則總結
1.  **資訊分層**: 優先顯示針對「發薪」最重要的金額與狀態。
2.  **狀態視覺化**: 利用卡片背景色 (白 vs 綠) 強烈暗示資料的可變性。
3.  **操作防呆**: 已結算狀態下，移除所有編輯入口，僅保留「取消」與「檢視」功能。

---

## 8. 技術實作注意事項 (Technical Implementation Notes)

為避免開發過程中的常見錯誤，請特別注意以下技術細節：

### 8.1 資料查詢 (Data Fetching)
-   **多重角色篩選**: 為了包含管理員自己的薪資，查詢 `users` 表時 **必須使用 `.in('role', ['employee', 'manager', 'super_admin'])`**，切勿使用 `.eq('role', 'employee')` 導致資料缺漏。
-   **SQL 欄位選取**: 在 Supabase Client 使用 `.select()` 字串時，請務必檢查：
    -   **欄位不重複**: 重複的欄位名稱 (如 `salary_amount, salary_amount`) 可能導致 SQL 解析錯誤或不可預期的行為。
    -   **語法正確性**: 避免欄位名稱沾黏 (如 `rolesalary_amount`)，建議使用多行字串模板以保持可讀性。

### 8.2 狀態一致性 (State Consistency)
-   **前端快取更新**: 執行 `settle` 或 `resettle` 後，務必重新 fetch 該筆資料 (或 return 新資料) 並更新 React Context/State，確保卡片 UI 立即反映變更，而不需重新整理頁面。
