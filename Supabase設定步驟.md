# Supabase 設定步驟指南

## 📍 第一步：註冊 Supabase

### 1. 開啟 Supabase 網站
前往：https://supabase.com

### 2. 註冊/登入
- 點擊右上角的「Start your project」
- **建議使用 GitHub 帳號登入**（這樣後續整合會更方便）
  - 如果沒有 GitHub 帳號，可以先到 https://github.com 註冊
  - 或者使用 Email 註冊也可以

### 3. 授權 GitHub（如果使用 GitHub 登入）
- 點擊「Continue with GitHub」
- 授權 Supabase 存取您的 GitHub 帳號

---

## 📍 第二步：建立新專案

### 1. 進入 Dashboard
登入後會看到 Supabase Dashboard

### 2. 建立組織（第一次使用）
如果是第一次使用，需要先建立組織（Organization）：
- Organization name: 輸入您的名稱或公司名稱
- 點擊「Create organization」

### 3. 建立新專案
點擊「New project」按鈕，填寫以下資訊：

#### 必填項目：

**Name（專案名稱）**
```
attendance-system
```

**Database Password（資料庫密碼）**
- 建議點擊「Generate a password」自動生成強密碼
- ⚠️ **重要：請複製並保存這個密碼！**
- 雖然大多數情況下不需要直接使用，但還是要記錄下來

**Region（地區）**
- 選擇：**Northeast Asia (Tokyo)** 或 **Southeast Asia (Singapore)**
- 這兩個是離台灣最近的，速度最快

**Pricing Plan（價格方案）**
- 選擇：**Free**（免費方案）
- 免費方案包含：
  - 500MB 資料庫空間
  - 50,000 月活躍用戶
  - 對於測試和中小型專案完全足夠

### 4. 建立專案
- 點擊「Create new project」
- 等待 2-3 分鐘讓 Supabase 建立專案
- 建立完成後會自動進入專案 Dashboard

---

## 📍 第三步：取得 API 金鑰

專案建立完成後，您需要記錄以下資訊（之後會用到）：

### 1. 進入 Project Settings
- 點擊左側選單最下方的「⚙️ Project Settings」

### 2. 點選「API」分頁

### 3. 記錄以下資訊

#### Project URL
```
https://xxxxxxxxxxxxx.supabase.co
```
複製「Project URL」

#### anon public key
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOi...（很長的字串）
```
複製「Project API keys」中的「anon」「public」金鑰

---

## 📍 第四步：執行資料庫腳本

### 1. 進入 SQL Editor
- 點擊左側選單的「🔧 SQL Editor」

### 2. 建立新查詢
- 點擊「➕ New query」按鈕

### 3. 執行建表腳本
步驟：
1. 開啟您電腦上的檔案：`/Users/justinzou/Desktop/AntigravityTest/supabase/schema.sql`
2. 複製整個檔案的內容
3. 貼到 Supabase SQL Editor 中
4. 點擊右下角的「▶️ Run」按鈕執行

**預期結果：**
- 如果成功，會看到綠色的「Success. No rows returned」
- 如果有錯誤，會顯示紅色錯誤訊息（請告訴我錯誤內容）

### 4. 驗證資料表是否建立成功
在 SQL Editor 中執行以下查詢：
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

**預期結果：**
應該看到 7 個資料表：
- attendance
- attendance_edit_logs
- leaves
- login_tokens
- operation_logs
- salary_history
- users

### 5. 插入測試資料
1. 點擊「➕ New query」建立另一個新查詢
2. 開啟檔案：`/Users/justinzou/Desktop/AntigravityTest/supabase/test_data.sql`
3. 複製整個內容並貼到編輯器
4. 點擊「▶️ Run」執行

**預期結果：**
- 成功後會顯示插入的資料筆數

---

## 📍 第五步：驗證資料

### 1. 使用 Table Editor 查看
- 點擊左側選單的「📊 Table Editor」
- 點選「users」表
- 應該看到 5 位測試員工的資料

### 2. 測試帳號確認
應該有以下測試帳號：

| 員工編號 | 姓名 | Email | 權限 | 密碼 |
|---------|------|-------|------|------|
| E001 | 王大明 | admin@example.com | super_admin | password |
| E002 | 李小華 | manager@example.com | manager | password |
| E003 | 張小美 | employee@example.com | employee | password |
| E004 | 陳小強 | employee2@example.com | employee | password |
| E005 | 林小玲 | employee3@example.com | employee | password |

---

## ✅ 完成檢查清單

- [ ] Supabase 帳號已註冊
- [ ] 專案「attendance-system」已建立
- [ ] 已記錄 Project URL
- [ ] 已記錄 anon public key
- [ ] 已執行 schema.sql（7個資料表建立成功）
- [ ] 已執行 test_data.sql（測試資料插入成功）
- [ ] 在 Table Editor 中確認看到測試資料

---

## 🎯 完成後的下一步

Supabase 設定完成後，我們就可以：
1. 建立 GitHub 儲存庫
2. 建立 Next.js 專案
3. 連接 Supabase 與 Next.js
4. 部署到 Vercel

**請在完成 Supabase 設定後告訴我！**

遇到任何問題或錯誤，請隨時提供截圖或錯誤訊息，我會協助您解決！
