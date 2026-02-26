# 個人帳號設定規格書 (Account Settings Spec)

> **版本**: v1.1
> **狀態**: 規劃中 (Planning)
> **目標**: 提供員工自助管理個人資料的介面，包含基本資訊、安全設定與個人化頭像。

---

## 1. 頁面功能概觀與角色權限

本頁面允許 **所有登入使用者** 管理其個人帳號資訊。
- **自我管理**: 使用者僅能修改自己的資料 (`auth.uid() === user_id`)。
- **敏感資料保護**: 員工編號 (`employee_id`)、職位 (`role`)、薪資設定 (`salary_type`, `salary_amount`) 為唯讀資訊，**嚴禁**在此頁面修改。

---

## 2. 介面佈局與資料流 (UI Layout & Data Flow)

- **頁面佈局 (Card Layout)**:
    - **手機版**: 單欄垂直堆疊 (`stack-y`)。
    - **桌面版**: 雙欄佈局 (`grid-cols-12`)。
        - **左側 (Col-4)**: 個人概覽卡片 (Profile Card)，包含正圓形頭像 (`rounded-full`) 與唯讀資訊（員工編號、職稱）。
        - **右側 (Col-8)**: 設定表單卡片 (修改名稱、安全性操作)，並在最下方放置獨立的「登出系統 (Danger Zone)」卡片區塊。
- **響應式策略**:
    - **頭像編輯**: 在手機版點擊頭像應跳出 Action Sheet 或直接開啟檔案選擇器。
    - **表單佈局**: 在手機版輸入框寬度應為 `w-full`。

---

## 3. 特殊頁面邏輯與狀態管理 (Local Logic & State)

### 3.1 修改顯示名稱 (Display Name)
- **欄位**: `users.display_name`
- **規則**: 必填，長度限制 2 ~ 50 字元。

### 3.2 變更個人頭像 (Avatar Update)
- 更新流程一律遵循全域的「資源儲存與裁切壓縮規範」。
- 僅負責將成功上傳後的 URL 存入 `users.avatar_url`。

### 3.3 重設密碼 (Reset Password)
- **機制**: 使用 Supabase Auth 的 `updateUser` API。
- **驗證**: 密碼長度至少 6 碼，且兩次輸入必須一致。
- **安全確認**: 修改成功後，建議顯示「修改成功，下次登入請使用新密碼」之單向提示框 (`AlertDialog`)。

### 3.4 登出系統 (Sign Out)
- **機制**: 透過表單 `action="/auth/signout"` 呼叫後端登出流程。
- **介面登出入口**: 移除原側邊欄 (Sidebar) 上的登出按鈕，統一收斂至「帳號設定」頁面的最底部，以明確的紅色調提示區塊呈現。

### 3.4 專屬 Server Actions
- `updateProfile(data: { displayName: string })`: 驗證並更新基本資料。
- `updateAvatar(formData: FormData)`: 接收前端處理完之 Blob 進行上傳更新。
- `updatePassword(password: string)`: 呼叫 Supabase 變更密碼。
- 所有 Action 一律回傳標準 `ActionResult<void>`。

---

## 4. 參考文件 (References to Global Rules)
開發此頁面前，請務必詳閱 [系統架構白皮書 (System Architecture)](system_architecture.md)：
- **[2. 資料庫綱要設計]**: 參照 `users` 表與 `Storage` 設定。
- **[10.1 對話框與彈出視窗]**: 參照全域 `ConfirmDialog` 及 `AlertDialog` 使用規範。
- **[13. 檔案儲存與圖片處理規範]**: 參照 `ImageCropper` (1:1 裁切) 與 200KB 壓縮之開發要求。
