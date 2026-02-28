# 薪資管理規格書 (Salary Management Spec)

> **版本**: v2.1
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

### 2.2 月份切換機制
- 使用者切換月份 → `router.push('/admin/salary?month=YYYY-MM')`
- URL 更新 → Next.js 重新執行 `page.tsx` → 重新批次計算對應月份資料。

---

## 3. 批次計算架構（核心優化）

### 3.1 `calculateAllMonthlySalaries(yearMonth)` — 唯一入口

位於：`app/admin/salary/actions.ts`

**DB 查詢次數（固定 5 次）**：
1. `auth.getUser()`: 驗證權限。
2. `users` 表: 取得所有員工。
3. `attendance` 表: 批次撈取所有員工當月出勤（含 `work_hours`, `break_duration`）。
4. `leaves` 表: 批次撈取所有員工核准請假。
5. `salary_records` 表: 批次撈取結算狀態與快照。

### 3.2 工時精確度 (v2.1 更新)
- **鐘點制 (Hourly)**: 取消原本的 0.5 小時進位/向下取整規則。
- **統一標準**: 淨工時一律計算至 **小數點後二位**（例：8.33h），以維持發薪金額的精確度。

---

## 4. 介面規格

### 4.1 員工卡片設計細節
- **鐘點制 (Hourly)**：顯示 `工時/時薪`，如 「120.25h / $200」。
- **月薪制 (Monthly)**：顯示 `假勤/月薪`，如 「遲1/早0/假2 | $45,000」。
- **實發金額**：即時計算（未結算）或 唯讀快照（已結算）。

---

## 5. 狀態邏輯

### 5.1 未結算 (Unsettled)
- **資料來源**：SSR 即時批次計算。
- **獎金編輯**：可隨時更新。

### 5.2 已結算 (Settled)
- **資料來源**：`salary_records.settled_data` 快照 (JSONB)。
- **不可變性**：即使後續修改出勤紀錄，結算後的卡片數據 **絕對不變**。
- **Live Analysis**: 支援手風琴展開，進行快照與現況的即時對照。

---

## 6. Bug 修正記錄 (重點清單)

| 版本 | 項目 | 說明 |
|------|------|------|
| v1.2 | `endDate` 時區修正 | 修正 UTC+8 環境下月底少算一天的問題。 |
| v2.0 | 性能大躍進 | 導入方案 C 批次查詢與 Server Component，解決萬人查詢效能黑洞。 |
| v2.1 | 工時精度脫鉤 | 移除鐘點人員的 0.5 級距整數化，統一精算至兩位小數。 |
| v2.1 | 鐘點打卡改革 | 配合 `attendance_clockin_spec v1.5` 統一上班邏輯與彈性下班調整。 |

---

## 7. 參考文件
- [打卡系統設計規格書](attendance_clockin_spec.md) (v1.5)
- [考勤記錄規格書](attendance_record_spec.md) (v1.5)
