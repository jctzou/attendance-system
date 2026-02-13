# 個人帳號設定規格書 (Account Settings Spec)

> **版本**: v1.0
> **日期**: 2026-02-13
> **狀態**: 規劃中 (Planning)
> **目標**: 提供員工自助管理個人資料的介面，包含基本資訊、安全設定與個人化頭像。
> **參考文件**: [系統架構白皮書 (System Architecture)](system_architecture.md)

---

## 1. 系統概觀與角色權限

### 1.1 核心功能
本頁面允許 **所有登入使用者** (包含 Employee, Manager, Admin) 管理其個人帳號資訊。

### 1.2 權限範圍
-   **自我管理**: 使用者僅能修改 **自己** 的資料 (`auth.uid() === user_id`)。
-   **敏感資料保護**: 員工編號 (`employee_id`)、職位 (`role`)、薪資設定 (`salary_type`, `salary_amount`) 為唯讀資訊，**嚴禁**在此頁面修改。

---

## 2. 介面設計規範 (UI/UX)

依照 `system_architecture.md` 之全域規範，本頁面採用 **卡片式佈局 (Card Layout)**。

### 2.1 頁面結構
-   **標題**: "帳號設定" (Account Settings)
-   **佈局**: 
    -   **手機版**: 單欄垂直堆疊 (`stack-y`)。
    -   **桌面版**: 雙欄佈局 (`grid-cols-12`)。
        -   **左側 (Col-4)**: 個人概覽卡片 (頭像、基本資訊)。
        -   **右側 (Col-8)**: 設定表單卡片 (修改名稱、安全性)。

### 2.2 元件設計
-   **個人概覽卡片 (Profile Card)**:
    -   **頭像區**: 圓形頭像 (Avatar)，支援 Hover 相機圖示提示上傳。
    -   **唯讀資訊**: 顯示 `員工編號` 與 `職稱` (灰色文字)，職稱需對應中文顯示 (如: admin -> 管理員)。
-   **設定表單 (Settings Form)**:
    -   分為多個獨立區塊 (Section)，例如「基本資料」、「登入安全」。
    -   **按鈕**: 操作按鈕應位於該區塊右下角，並具備 Loading 狀態。

---

## 3. 業務邏輯與功能細節

### 3.1 修改顯示名稱 (Display Name)
-   **欄位**: `users.display_name`
-   **規則**:
    -   必填。
    -   長度限制: 2 ~ 50 字元。
-   **行為**: 修改後需同步更新系統中顯示的名稱 (需考慮 Server Action 的 `revalidatePath` 範圍，建議全域刷新)。

### 3.2 修改頭像 (Avatar Update)
-   **儲存**: 使用 Supabase Storage (`avatars` bucket)。
-   **流程**:
    1.  前端選擇圖片 (無初始尺寸限制)。
    2.  **裁切 (Cropping)**: 強制開啟裁切模態框 (`ImageCropper`)，鎖定 **1:1** 正方形比例。
    3.  **壓縮 (Compression)**: 前端自動壓縮圖片，目標大小 **< 200KB** (Iterative Compression)。
    4.  **上傳**: 將處理後的 Blob 上傳至 Supabase Storage。
    5.  **清理 (Cleanup)**: 更新成功後，Server Action 自動刪除舊的 avatar 檔案以節省空間。
    6.  更新 `users.avatar_url` 欄位。
-   **快取清除**: 上傳新頭像時，URL 後加上時間戳記 (`?t=...`) 以強制刷新瀏覽器快取。

### 3.3 重設密碼 (Reset Password)
-   **機制**: 使用 Supabase Auth 的 `updateUser` API。
-   **輸入**:
    -   新密碼 (New Password)
    -   確認新密碼 (Confirm Password)
-   **驗證**:
    -   長度至少 6 碼。
    -   兩次輸入必須一致。
-   **安全確認**: 修改成功後，建議自動登出或顯示「修改成功，下次登入請使用新密碼」之 Toast 通知。

---

## 4. 資料結構參照 (Data Schema Reference)

請參照 `system_architecture.md` 第 2 節之 definition。

-   **Users**: 已擴充 `avatar_url` 欄位。
-   **Storage**: 確認使用 `avatars` bucket，並設定適當的 RLS Policy (Public Read, Owner Update).

---

## 5. 技術實作規範 (Implementation)

### 5.1 Server Actions (`app/account/actions.ts`)
-   `updateProfile(data: { displayName: string })`: 更新基本資料。
-   `updateAvatar(formData: FormData)`: 處理圖片上傳與 URL 更新。
-   `updatePassword(password: string)`: 呼叫 `supabase.auth.updateUser`。

### 5.2 資料驗證 (Zod Schema)
```typescript
const profileSchema = z.object({
  displayName: z.string().min(2, "名稱至少 2 個字"),
})

const passwordSchema = z.object({
  password: z.string().min(6, "密碼至少 6 碼"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "密碼不一致",
  path: ["confirmPassword"],
})
```

### 5.3 響應式策略 (RWD)
-   **頭像編輯**: 在手機版點擊頭像應跳出 Action Sheet 或直接開啟檔案選擇器。
-   **表單佈局**: 在手機版輸入框寬度應為 `w-full`。
