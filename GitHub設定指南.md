# GitHub 整合設定指南

## 📋 前置檢查

### 確認是否已安裝 Git
已經檢查過了，Git 已安裝在您的系統上！

---

## 🚀 設定步驟

### 第一步：建立 GitHub 儲存庫

#### 1. 登入 GitHub
前往：https://github.com
- 如果沒有帳號，請先註冊（免費）

#### 2. 建立新儲存庫（Repository）
1. 點擊右上角的「**+**」號
2. 選擇「**New repository**」
3. 填寫資訊：
   - **Repository name**: `attendance-system`
   - **Description**: `員工打卡及薪資管理系統 - Supabase + Next.js`
   - **Public** 或 **Private**（建議選 **Private**）
   - ❌ **不要**勾選「Add a README file」（我們本地已經有了）
   - ❌ **不要**勾選「Add .gitignore」（我們已經建立了）
4. 點擊「**Create repository**」

#### 3. 記下儲存庫網址
建立完成後會看到一個頁面，記下您的儲存庫 URL，例如：
```
https://github.com/你的使用者名稱/attendance-system.git
```

---

### 第二步：初始化本地 Git 儲存庫

開啟終端機，執行以下指令：

#### 1. 進入專案目錄
```bash
cd /Users/justinzou/Desktop/AntigravityTest
```

#### 2. 初始化 Git
```bash
git init
```

#### 3. 設定使用者資訊（如果還沒設定過）
```bash
git config --global user.name "你的名字"
git config --global user.email "你的email@example.com"
```

#### 4. 將所有檔案加入 Git
```bash
git add .
```

#### 5. 建立第一個 commit
```bash
git commit -m "Initial commit: 建立專案基礎架構和 Supabase schema"
```

#### 6. 設定主分支名稱為 main
```bash
git branch -M main
```

---

### 第三步：連接遠端儲存庫

#### 1. 加入遠端儲存庫
將下面的網址換成您的 GitHub 儲存庫網址：
```bash
git remote add origin https://github.com/你的使用者名稱/attendance-system.git
```

#### 2. 推送到 GitHub
```bash
git push -u origin main
```

**可能需要的認證：**
- 如果要求輸入密碼，需要使用 **Personal Access Token**（不是 GitHub 密碼）
- 如果還沒有 Token，請參考下方「建立 Personal Access Token」

---

### 第四步：驗證

前往您的 GitHub 儲存庫頁面，應該會看到：
- ✅ README.md
- ✅ .gitignore
- ✅ supabase/ 資料夾
- ✅ 其他專案檔案

---

## 🔑 建立 GitHub Personal Access Token

如果推送時要求密碼，需要建立 Personal Access Token：

### 1. 進入 GitHub Settings
1. 點擊右上角頭像 → **Settings**
2. 左側選單最下方點選 **Developer settings**
3. 點選 **Personal access tokens** → **Tokens (classic)**

### 2. 產生新的 Token
1. 點擊 **Generate new token** → **Generate new token (classic)**
2. 填寫：
   - **Note**: `AntigravityTest - attendance-system`
   - **Expiration**: 選擇有效期限（建議 90 days）
   - **Scopes**: 勾選 `repo`（完整控制私有儲存庫）
3. 點擊 **Generate token**
4. ⚠️ **立即複製 Token！** 離開頁面後就看不到了

### 3. 使用 Token 推送
執行 `git push` 時：
- **Username**: 您的 GitHub 使用者名稱
- **Password**: 貼上剛才複製的 Token（不是您的 GitHub 密碼）

---

## 📝 日常使用 Git 指令

### 查看狀態
```bash
git status
```

### 加入變更
```bash
# 加入特定檔案
git add 檔案名稱

# 加入所有變更
git add .
```

### 提交變更
```bash
git commit -m "說明這次改了什麼"
```

### 推送到 GitHub
```bash
git push
```

### 拉取最新版本
```bash
git pull
```

### 查看提交歷史
```bash
git log --oneline
```

---

## ✅ 完成檢查清單

- [ ] GitHub 儲存庫已建立
- [ ] 本地 Git 已初始化
- [ ] 已設定 user.name 和 user.email
- [ ] 已建立第一個 commit
- [ ] 已連接遠端儲存庫
- [ ] 已成功推送到 GitHub
- [ ] 在 GitHub 網頁上確認檔案都在

---

## 🎯 完成後的下一步

GitHub 設定完成後，我們就可以：
1. ✅ 建立 Next.js 專案
2. ✅ 整合 Supabase SDK
3. ✅ 部署到 Vercel（只需要連接 GitHub 儲存庫即可）

**請在完成 GitHub 設定後告訴我！** 遇到問題隨時詢問。
