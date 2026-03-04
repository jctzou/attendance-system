# 請假系統規格書 (Leave System Specification)

> **版本**: v2.3
> **狀態**: 現行系統描述（Active）
> **最後更新**: 2026-02-28
> **目標**: 100% 描述現有請假系統的資料架構、業務規則、介面設計與 API 行為，作為重構或新實作的唯一技術參考。

---

## 1. 系統概觀

請假系統涵蓋以下角色與功能：

| 角色 | 主要功能 |
|------|---------|
| **員工 (employee)** | 申請請假、查看假單歷史、撤銷待審假單、申請取消已批准假單 |
| **主管 (manager / super_admin)** | 審核員工請假（批准或退回）、審核取消申請 |

---

## 2. 資料庫設計

### 2.1 `leaves` 資料表完整欄位

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | `integer` | 主鍵，自增 |
| `user_id` | `uuid` | 申請人，FK → `users.id` |
| `leave_type` | `text` | 假別，見 §2.3 |
| `start_date` | `date` | **單日日期**（新架構下等同 end_date）|
| `end_date` | `date` | **單日日期**（新架構下等同 start_date）|
| `days` | `numeric` | 請假天數，值只允許 `0.5` 或 `1.0` |
| `hours` | `numeric` | Legacy 欄位，`days * 8`，保留備用 |
| `reason` | `text` | 員工填寫的請假事由 |
| `status` | `text` | 假單狀態，見 §2.2 |
| `group_id` | `uuid` | 群組識別碼，見 §2.4 |
| `approver_id` | `uuid` | 審核主管，FK → `users.id`，審核後寫入 |
| `approval_note` | `text` | 主管備註（目前保留，未來擴充用）|
| `approved_at` | `timestamptz` | 審核時間戳，審核後寫入 |
| `cancel_reason` | `text` | 員工的取消申請原因，暫存於 `cancel_pending` 期間 |
| `created_at` | `timestamptz` | 建立時間 |
| `updated_at` | `timestamptz` | 更新時間 |

#### CHECK Constraint（`leaves_status_check`）
```sql
status IN ('pending', 'approved', 'rejected', 'cancelled', 'cancel_pending')
```

### 2.2 Status 狀態機

```
            員工送出申請
                 │
                 ▼
           ┌─────────┐
           │ pending │  ← 員工可直接刪除（撤銷）
           └─────────┘
            /         \
       主管批准       主管退回
          /               \
         ▼                 ▼
   ┌──────────┐       ┌──────────┐
   │ approved │       │ rejected │
   └──────────┘       └──────────┘
         │
    員工申請取消
         │
         ▼
  ┌───────────────┐
  │ cancel_pending│  ← 員工不可再取消；主管審核中
  └───────────────┘
       /       \
  主管同意    主管拒絕
     /              \
    ▼                ▼
（硬刪除）      ┌──────────┐
               │ approved │  ← 恢復原狀
               └──────────┘
```

#### 狀態說明

| Status | 中文 | 說明 |
|--------|------|------|
| `pending` | 待審核 | 員工剛送出，等待主管審核 |
| `approved` | 已批准 | 主管同意 |
| `rejected` | 已退回 | 主管拒絕 |
| `cancelled` | 已取消 | 保留用（目前撤銷為硬刪除，此狀態未使用）|
| `cancel_pending` | 取消審核中 | 員工對已批准假單提出取消申請，等待主管決定 |

### 2.3 假別類型 (`leave_type`)

自 v2.3 起，假別收斂並統整於 `utils/leave-policies.ts` 做全域打底管理。以下為可用的五種假別：

| 值 (`leave_type`) | 中文名稱 | 本系統設定之「年額度」與週期 | 本系統設定之「扣薪係數」 |
|-------------------|----------|------------------------------|--------------------------|
| `annual_leave` / `annual` | 特休 | **【週年制】**，依登錄額度 | `0.0` (不扣薪) |
| `personal_leave` | 事假 | **【曆年制 1/1~12/31】**，全年上限 14 天 | `1.0` (扣全薪) |
| `sick_leave` | 病假 | **【曆年制 1/1~12/31】**，全年上限 30 天 | `0.5` (扣半薪) |
| `family_care_leave` | 家庭照顧假 | **【曆年制 1/1~12/31】**，全年上限 7 天 (**併入事假計算**) | `1.0` (扣全薪) |
| `menstrual_leave` | 生理假 | **【每月】**，每月上限 1 天 | `0.5` (扣半薪) |

> **注意**：舊有記錄的 `other` (或其他) 假別系統仍保留顯示，但申請介面不再提供。另外 `annual_leave` 和 `annual` 皆視為特休，程式碼中兩者並列處理以維持相容性。

### 2.4 group_id 設計原因與規則

#### 為什麼需要 group_id？

早期設計將多日請假存為單一 row（`start_date ~ end_date`），導致：
- 日曆無法正確逐日顯示
- 跨越週末或假日時薪資計算錯誤（整段都被扣薪）
- 無法對單日進行細緻審核

**現行設計：多日請假拆分為多筆 row，每筆代表單一日，以 `group_id`（UUID）串連。**

#### group_id 的規則

1. **同一次申請，所有日期共用同一個 `group_id`**（在 `applyLeave` 函式中呼叫 `uuidv4()` 一次生成）。
2. **每筆 row 的 `start_date` = `end_date`**（即單日）。
3. **週六、週日或國定假日應設 `days = 0`，不該寫入 DB**（員工在介面上勾選「不請假」，前端不將其納入 `dailyStatus` 陣列送出）。
4. **舊資料（無 group_id）**：程式碼以 `legacy-{id}` 作為虛擬群組 ID 處理，顯示時單獨呈現，不影響功能。

---

## 3. 業務規則

### 3.1 請假申請規則

#### 基本驗證（Zod Schema: `ApplyLeaveSchema`）
- `leaveType`：必填，非空字串
- `startDate` / `endDate`：必填，`endDate` 不能早於 `startDate`
- `days`：必須 `> 0`，且必須是 `0.5` 的倍數（即 `0.5` 或 `1.0`）
- `reason`：必填，非空字串
- `dailyStatus`：至少一天，陣列內每筆含 `{ date: YYYY-MM-DD, days: 0.5 | 1.0 }`

#### 特休與曆年制假別額度檢查（雙軌制）

1. **特休 (`annual_leave`) - 週年制防線**：
   ```
   approvedDays（已批准天數）+ pendingDays（待審中天數）+ 本次申請 days ≤ annual_leave_total
   ```
   違反時拋出錯誤：`特休額度不足。剩餘(含審核中扣除): X 天，本次申請: Y 天`

2. **曆年假別 (`personal`, `sick`, `family_care`) - 曆年防線 (以 startDate 的年份為準)**：
   - 系統提取該年份（1/1 ~ 12/31）所有有效假單，進行額度加算阻擋。
   - `sick_leave`：全年 ≤ 30 天。
   - `family_care_leave`：全年 ≤ 7 天。
   - `personal_leave` + `family_care_leave` 總計 ≤ 14 天。
3. **生理假 (`menstrual_leave`) - 每月防線**：
   - 提取當月所有有效生理假，若累積 ≥ 1 天即報錯。

#### 衝突防呆（`checkLeaveConflicts`）
```
同一員工，同一天（start_date）的有效假單（pending + approved）之 days 加總 ≤ 1.0
```

違反時拋出錯誤：`YYYY/MM/DD 申請天數衝突。該日已請 A 天，本次申請 B 天，合計超過單日上限！`

> **允許的組合**：同一天可以有兩筆各 `0.5`（上午 + 下午），但不能超過合計 `1.0`。

#### 鐘點制員工（`hourly`）限制
- 請假申請對話框中**不顯示「特休」選項**
- 頁面頂部**不顯示**特休餘額摘要區塊

### 3.2 主管審核規則

#### 批准（`approved`）副作用
- 若為特休：`users.annual_leave_used += days`（逐日累計）
- 寫入 `approver_id`（主管 UUID）和 `approved_at`（審核時間戳）
- 發送通知給員工（`leave_approved`）

#### 退回（`rejected`）副作用
- 寫入 `approver_id` 和 `approved_at`
- 不扣特休額度
- 發送通知給員工（`leave_rejected`）

#### 批次vs個別審核
- **批次**（`reviewLeaveGroup`）：同一 `group_id` 且 `status = 'pending'` 的所有 row 全部更新
- **個別**（`reviewLeave`）：只更新指定 `id` 的單筆 row
- 批次審核只影響 `pending` 的行，已被單獨審核的行不受影響

### 3.3 撤銷規則（員工取消 pending 假單）

- **條件**：假單 `status = 'pending'` 且 `user_id = 目前登入員工`
- **行為**：硬刪除（`DELETE FROM leaves WHERE id = ?`）
- **群組撤銷**：`DELETE FROM leaves WHERE group_id = ?`，所有 row 需都是 `pending`，否則報錯

### 3.4 取消申請規則（員工對 approved 假單申請取消）

#### 發起取消申請

**單筆（`requestCancelLeave`）**
- **條件**：假單 `status = 'approved'`、呼叫者為擁有人、需填取消原因
- **行為**：`status` → `cancel_pending`，`cancel_reason` 填入原因
- **Schema 驗證**：`CancelLeaveReqSchema`（`leaveId: number`, `cancelReason: string.min(1)`）

**整批群組（`requestCancelLeaveGroup`）**
- **條件**：指定 `group_id` 下所有假單**全數** `status = 'approved'`、呼叫者為擁有人、需填取消原因
- **行為**：該 `group_id` 所有 row → `status = 'cancel_pending'`，`cancel_reason` 填入相同原因
- **若群組中有任何非 `approved` 狀態的 row**：拋出 `BUSINESS_CONFLICT` 錯誤

#### 主管處理取消申請

**單筆（`approveCancelLeave`）**

| 動作 | 行為 |
|------|------|
| **同意取消** (`approve = true`) | 硬刪除假單；發送通知 `leave_cancel_result` |
| **拒絕取消** (`approve = false`) | `status` 恢復 `approved`，`cancel_reason` 清空為 `null`；發送通知 |

**整批群組（`approveCancelLeaveGroup`）**

| 動作 | 行為 |
|------|------|
| **全部同意取消** (`approve = true`) | 整個 `group_id` 所有 `cancel_pending` row 全部硬刪除；發送通知 `leave_cancel_result` |
| **全部拒絕取消** (`approve = false`) | 整個 `group_id` 所有 `cancel_pending` row 全部恢復 `approved`；發送通知 |

> **注意**：同意取消後，該日假單記錄永久消失，無歷史可查（硬刪除的取捨決定）。

### 3.5 資料庫 Migration 記錄

| Migration 檔案 | 說明 |
|---------------|------|
| `20260210_update_leaves_status_constraint.sql` | 加入 `cancelled` 狀態 |
| `20260227_add_group_id_to_leaves.sql` | 加入 `group_id` 欄位 |
| `20260227_add_cancel_pending_status.sql` | 加入 `cancel_pending`、`cancel_reason`、approver 欄位；新增 RLS 政策 |
| `20260227_drop_legacy_cancellation_table.sql` | 刪除已廢棄的舊版 `leave_cancellations` 資料表 |

---

## 4. API（Server Actions）

所有 Server Actions 位於 `/app/leaves/actions.ts`，回傳 `ActionResult<T>`。

### 員工端

| Function | 參數 | 說明 |
|----------|------|------|
| `getAnnualLeaveBalance()` | — | 取得特休總額、已用、剩餘 |
| `getMyLeaves()` | — | 取得目前員工所有假單（含 approver 姓名）|
| `applyLeave(...)` | leaveType, startDate, endDate, days, reason, dailyStatus | 申請請假 |
| `cancelLeave(leaveId)` | `number` | 撤銷單筆 pending 假單（硬刪除）|
| `cancelLeaveGroup(groupId)` | `string` | 撤銷整個 pending 群組（硬刪除）|
| `requestCancelLeave(leaveId, cancelReason)` | `number, string` | 對已批准**單筆**假單申請取消 |
| `requestCancelLeaveGroup(groupId, cancelReason)` | `string, string` | 對已批准**整批群組**假單申請取消 |

### 主管端

| Function | 參數 | 說明 |
|----------|------|------|
| `getPendingLeaves()` | — | 取得所有 `pending` 和 `cancel_pending` 假單（含 user 資訊）|
| `reviewLeave(leaveId, status)` | `number, 'approved'\|'rejected'` | 審核單筆假單 |
| `reviewLeaveGroup(groupId, status)` | `string, 'approved'\|'rejected'` | 批次審核群組 |
| `approveCancelLeave(leaveId, approve)` | `number, boolean` | 處理**單筆**取消申請 |
| `approveCancelLeaveGroup(groupId, approve)` | `string, boolean` | 處理**整批群組**取消申請 |

---

## 5. 介面設計

### 5.1 員工端 - 請假管理頁 (`/leaves`)

#### 架構（RSC + Client Component 分離）

本頁面採用 **Next.js Server Component + Client Component 分離架構**，以消除鐘點人員特休區塊的閃爍問題（CLS）：

| 檔案 | 類型 | 職責 |
|------|------|---------|
| `app/leaves/page.tsx` | **Server Component** (`async`) | 伺服器端取得 `salaryType`、假單列表、特休餘額，以 props 傳入 Client |
| `app/leaves/LeavesClient.tsx` | **Client Component** (`'use client'`) | 管理 dialog 狀態、刷新邏輯、使用者互動 |

**設計原則**：`salaryType` 在 HTML 送達瀏覽器前即確定，特休區塊的顯示/隱藏由伺服器決定，完全消除 FOUC（Flash of Unstyled Content）。

#### Hydration 注意事項
任何在 `LeaveTable`、`LeavesClient` 等子元件中使用的日期格式化函式，**嚴禁**使用 `toLocaleString()` / `toLocaleDateString()` 等本地化方法，因為 Node.js 與瀏覽器的 ICU 資料不一致會導致 Hydration mismatch。

**正確做法**：統一使用 `formatToTaipeiTime(date, formatStr)` 來格式化所有日期時間顯示。

#### 頂部特休餘額區塊
- 顯示：特休總天數、已使用、剩餘天數
- **鐘點制人員不顯示此區塊**

#### 申請請假對話框（`ApplyLeaveDialog`）

1. 選擇假別（鐘點制不含特休）
2. 選擇開始日期 & 結束日期（RWD：手機單欄、桌機雙欄）
3. 系統自動展開每一天的列表
4. 每天可獨立設定：全天(1.0) / 半天(0.5) / 不請假(0)
   - **例假日（週六、週日）預設為「不請假」**（`days = 0`）
   - 國定假日亦預設「不請假」
   - 不請假的天顯示灰色 + 刪除線；例假日以 Rose/Red 色系標示
5. 自動計算總天數，不可手動輸入
6. 特休餘額不足時即時顯示警告、阻擋送出
7. 送出時只將 `days > 0` 的日期寫入 DB

#### 假單歷史列表（`LeaveTable`）

列表以 `group_id` 為單位展示，多日為可展開群組。

**群組狀態優先級**（決定群組顯示的整體狀態）：
1. 若有任何一筆 `pending` → 整組視為 `pending`
2. 若有任何一筆 `cancel_pending` → 整組視為 `cancel_pending`
3. 其他 → 以第一筆的 `status` 為準

**狀態徽章**：

| Status | 顏色 | 顯示文字 |
|--------|------|---------|
| `pending` | 橙色 | 待審核 |
| `approved` | 綠色 | 已批准 |
| `rejected` | 紅色 | 遭退回 |
| `cancelled` | 灰色 | 已取消 |
| `cancel_pending` | 橙紫色 | 取消審核中 |

**批准人資訊顯示**：
- 已批准 / 取消審核中：顯示「✓ 批准人名稱 · 批准日期」（綠色小字）
- 已退回：顯示「✗ 退回人名稱」（紅色小字）

**操作按鈕邏輯**：

| 群組狀態 | items 數量 | 可用操作 |
|---------|------------|---------|
| `pending` | 多筆 | **全部撤銷**（整批硬刪除）|
| `pending` | 單筆 | **個別撤銷** |
| `approved` | 多筆 | **申請全部取消**（整批） |
| `approved` | 單筆 | **申請取消** |
| `cancel_pending` | — | 顯示「取消申請審核中」提示，無操作 |
| `rejected` | — | 無操作 |

**申請取消流程（員工端）**：

*單日*：
1. 員工點擊「申請取消」按鈕
2. 彈出對話框，填寫取消原因（必填）
3. 送出後，假單 `status` → `cancel_pending`
4. 主管審核後，員工收到通知

*多日整批*：
1. 員工點擊「申請全部取消」按鈕
2. 彈出對話框，填寫取消原因（整批共用同一原因，必填）
3. 送出後，群組所有 row `status` → `cancel_pending`
4. 主管審核後，員工收到通知

**行動版（Mobile）**：Card 形式呈現群組。
**桌面版（Desktop）**：Table 形式，點擊 row 可展開群組明細。

---

### 5.2 主管端 - 假單審核頁 (`/admin/leaves`)

頁面顯示所有 `pending` 和 `cancel_pending` 的假單，以 `AdminLeaveTable` 呈現。

#### 列表分組
- 以 `group_id` 群組化，每組顯示：申請人、假別、日期範圍、總天數、請假事由
- 點擊群組可展開明細（每日列表）

#### 一般請假審核操作

| 層級 | 操作 | 說明 |
|------|------|------|
| 群組 | 全准 / 全退 | 批次審核整組（僅 `pending` 資料行受影響）|
| 單日（展開後） | 單准 / 單退 | 審核群組中單一日 |

> **當群組中有 `cancel_pending` 資料時，「全准/全退」按鈕隱藏，改顯示「假單取消申請中」徽章。**

#### 取消申請審核操作

針對包含 `cancel_pending` row 的群組，展示黃色提示區塊（Mobile）或特殊高亮（Desktop），顯示取消原因。

| 情境 | 可用操作 | 層級 |
|------|----------|---------|
| **整批全部 `cancel_pending`**（多日群組） | **全同意取消** / **全拒絕取消** | 群組層（Desktop 欄位 + Mobile 批次按鈕）|
| **整批全部 `cancel_pending`**（多日群組）展開後 | 逐日：同意取消 / 拒絕取消 | 明細行 |
| **部分 `cancel_pending`**（混合狀態） | 顯示「部分取消申請中」徽章；展開後逐日操作 | 明細行 |
| **單筆群組 `cancel_pending`** | 同意取消 / 拒絕取消 | 群組層 |

所有操作均有確認 Dialog 說明後果（同意→硬刪除；拒絕→恢復 `approved`）。

---

## 6. 日曆顯示（出勤月曆）

> **設計變更 (v2.1)**：为簡化操作動線，**請假申請功能已從「打卡記錄 (`/attendance`)」頁的日曆對話框中完整移除。員工必須前往 **`/leaves` 請假管理頁**申請請假。打卡記錄頁的日曆點擊對話框舊下列行為：
> - 對話框僅提供**打卡補登與修改**功能。
> - 若該日已有請假紀錄，對話框頂部展示一條**唯讀請假狀態橫幅**（假別中文名稱 + 審核狀態）。

### 不同假別的圖示

月曆 (`/attendance`) 上，已批准的假單以**不同小圖示**區分：

| 假別 | 圖示 | 備注 |
|------|------|------|
| 病假 | 🤒（或特定 icon）| |
| 事假 | 🏠（或特定 icon）| |
| 特休 | ⭐（或特定 icon）| |
| 其他 | 📋（或特定 icon）| |

> 具體圖示請參見 `components/attendance/DayCard.tsx` 的實作。

---

## 7. 薪資計算與請假的關係

薪資計算邏輯位於 `/app/admin/salary/actions.ts`。

### 扣薪計算方式 (權重積點制)

為了精確計算半薪假（病假、生理假）與全薪假（事假、曠職）。我們將結算的引擎更新為**日薪固定除以 30**，並結合**權重積點計算**：

1. **日工資**：無論大月小月，一日工資固定為 `Math.round(月薪 / 30)`。
2. **扣薪積點 (`deductPoints`)**：
   - 系統遍歷該月度內，員工所有「已批准」的假單。
   - 事假、家庭照顧假：`days` * 1.0 點。
   - 病假、生理假：`days` * 0.5 點。
   - 特休：`days` * 0.0 點 (不扣薪)。
3. **最後扣款**：
   `扣除總金額 (deduction) = Math.round(日工資 * deductPoints)`

這個設計解決了以往不論何種假別一律扣除整日薪水的問題。

---

## 8. 通知系統整合

### 8.1 通知事件清單

| 事件 | type | 發送對象 | 觸發時機 |
|------|------|---------|---------|
| 新請假申請 | `new_leave_request` | 所有主管 | 員工送出申請後（每個 `group_id` 僅一則）|
| 批准請假 | `leave_approved` | 申請員工 | 主管批准後（每個 `group_id` 僅一則）|
| 退回請假 | `leave_rejected` | 申請員工 | 主管退回後（每個 `group_id` 僅一則）|
| 取消申請（單筆/整批）| `leave_cancel_request` | 所有主管 | 員工申請取消後（每個 `group_id` 僅一則）|
| 取消審核結果 | `leave_cancel_result` | 申請員工 | 主管同意/拒絕取消後（由 `approveCancelLeave` / `approveCancelLeaveGroup` 呼叫 `createNotification` 發送）|

### 8.2 通知架構規範（重要）

#### 問題背景

採用 `group_id` 多日拆分架構後，每次請假操作會對 `leaves` 資料表產生多筆 row INSERT/UPDATE。若 `FOR EACH ROW` Trigger 加上 Server Action 也各自插入通知，則：

```
通知數 = 請假天數 × 2（Trigger 各一則 + Server Action 各一則）
```

#### 現行解決方案：職責分離

| 職責 | 負責方 | 說明 |
|------|--------|------|
| **通知記錄入庫**（`new_leave_request`, `leave_approved`, `leave_rejected`, `leave_cancel_request`）| **DB Trigger** | `handle_leave_notifications()` FOR EACH ROW，但以 `group_id` 最小 `id` 去重，每個 group 只插入一則 |
| **取消審核結果通知**（`leave_cancel_result`）| **Server Action** 直接呼叫 `createNotification()` | DB Trigger 不處理 DELETE 與「cancel_pending → approved」的回滾，故此事件例外由 Server Action 負責 |
| **即時鈴噹 Broadcast 訊號** | **Server Action** 呼叫 `broadcastToManagers()` / `broadcastToUser()` | 通知記錄已存在於 DB，Broadcast 只是讓前端的 `NotificationBell` 即時刷新計數，不插入任何資料 |

#### 各場景 Broadcast 與通知對照表

| 操作場景 | Broadcast 目標 | 通知入庫方式 |
|---------|---------------|------------|
| 員工申請假單 | 所有主管 (`broadcastToManagers`) | DB Trigger（`new_leave_request`）|
| 員工申請取消（單筆/整批）| 所有主管 (`broadcastToManagers`) | DB Trigger（`leave_cancel_request`）|
| 主管批准/退回（單筆）| 員工 (`broadcastToUser`) | DB Trigger（`leave_approved` / `leave_rejected`）|
| 主管批准/退回（整批群組）| 員工 (`broadcastToUser`) | DB Trigger（`leave_approved` / `leave_rejected`，group_id 去重）|
| 主管同意/拒絕取消（單筆）| 員工（`createNotification` 內含 broadcast）| `createNotification()` 直接呼叫（含入庫 + broadcast）|
| 主管同意/拒絕取消（整批）| 員工（`createNotification` 內含 broadcast）| `createNotification()` 直接呼叫（含入庫 + broadcast）|

#### 規範

1. **`handle_leave_notifications` Trigger 去重邏輯**：每個 `group_id` 的所有 row 中，只有 `id` 最小的那筆 row 才執行通知插入；`group_id` 為 NULL 的舊資料視為獨立一筆，永遠插入。
2. **Server Action 中禁止對 `new_leave_request` / `leave_approved` / `leave_rejected` / `leave_cancel_request` 呼叫 `createNotification`**：這四類通知由 DB Trigger 統一負責，避免重複。
3. **`leave_cancel_result` 例外**：`approveCancelLeave` 和 `approveCancelLeaveGroup` 可呼叫 `createNotification()`，因為 Trigger 不處理此情境（DELETE 不觸發 Trigger 通知）。
4. **通知內容使用中文假別**：DB Trigger 以 `CASE` 語句將 `leave_type` 原始值（如 `personal_leave`）轉為中文（如 `事假`）。
5. **Broadcast 物件格式**：`{ targetUserId: string }`，前端 `NotificationBell` 比對 `targetUserId === currentUserId` 後才刷新。

> `SECURITY DEFINER` 加持的 DB Trigger 可跨 RLS 讀取所有使用者角色，等效於 Server Action 中使用 `createAdminClient()`。

---

## 9. 錯誤碼對照

| ErrorCode | 中文 | 使用情境 |
|-----------|------|---------|
| `VALIDATION_FAILED` | 驗證失敗 | Schema 驗證不通過 |
| `NOT_FOUND` | 找不到資料 | 假單 ID 不存在 |
| `FORBIDDEN` | 權限不足 | 非假單擁有人操作 |
| `BUSINESS_CONFLICT` | 業務衝突 | 額度不足、衝突日期、狀態不對 |

---

## 10. 已知限制與技術備注

1. **舊資料相容**：`group_id` 為 null 的舊假單以程式碼中 `legacy-{id}` 虛擬群組方式處理，不影響功能，但無法享有群組操作。

3. **取消後無歷史**：目前採硬刪除，同意取消後假單消失。若未來需要審計功能，可改為軟刪除（`status = 'cancelled'`），程式碼改動量極小。

4. **`approval_note` 未啟用**：欄位已存在，設計用於主管退回時填寫說明，但目前 UI 尚未提供輸入介面。

5. **衝突防呆的舊資料盲區**：`checkLeaveConflicts` 只比對 `start_date`，若DB中存在舊的跨日假單（start_date ≠ end_date），中間的日期不在防呆範圍內。建議對舊資料進行一次正規化清理。

---

## 11. 相關檔案索引

| 檔案 | 說明 |
|------|------|
| `app/leaves/page.tsx` | 員工請假管理頁（**Server Component**，伺服器端取資料）|
| `app/leaves/LeavesClient.tsx` | 員工請假管理頁互動層（**Client Component**，dialog/刷新）|
| `app/leaves/actions.ts` | 所有請假 Server Actions（含 `LeaveRow` 型別定義、群組批次 cancel 函式）|
| `components/LeaveTable.tsx` | 員工假單列表（Client Component，含群組取消申請 UI）|
| `components/ApplyLeaveDialog.tsx` | 請假申請對話框 |
| `components/AdminLeaveTable.tsx` | 主管審核列表（Client Component，含批次取消審核 UI）|
| `app/admin/leaves/page.tsx` | 主管假單審核頁 |
| `utils/leaves_helper.ts` | `checkLeaveConflicts` 衝突防呆工具 |
| `utils/timezone.ts` | 時區工具（含 `formatToTaipeiTime`，避免 Hydration mismatch）|
| `app/admin/salary/actions.ts` | 薪資計算（含請假扣薪邏輯）|
| `types/supabase.ts` | 資料庫型別定義（leaves 表含所有欄位）|
| `supabase/migrations/20260226_notification_triggers.sql` | 請假通知 DB Trigger（原始版）|
| `supabase/migrations/20260228_fix_notification_dedup.sql` | 通知去重修正 Migration（**唯一通知發送方，以 group_id 去重**）|
| `supabase/migrations/20260227_add_cancel_pending_status.sql` | 假單狀態擴充 Migration |
| `supabase/migrations/20260227_drop_legacy_cancellation_table.sql` | 廢棄資料表清理 Migration |
