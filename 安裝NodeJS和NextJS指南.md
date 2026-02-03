# 安裝 Node.js 和建立 Next.js 專案指南

## 📋 第一步：安裝 Node.js

### 方法一：使用官方安裝包（推薦，最簡單）

#### 1. 下載 Node.js
前往：https://nodejs.org/

#### 2. 選擇版本
- 點擊下載 **LTS（長期支援版）** - 綠色按鈕
- 目前是 Node.js 20.x 或 22.x
- macOS 會自動偵測您的系統（Intel 或 Apple Silicon）

#### 3. 安裝
1. 下載完成後，開啟 `.pkg` 檔案
2. 按照安裝精靈指示進行
3. 可能需要輸入 Mac 密碼
4. 安裝完成後，關閉並重新開啟終端機

#### 4. 驗證安裝
重新開啟終端機後，執行：
```bash
node -v
npm -v
```

應該看到版本號（例如 `v20.11.0` 和 `10.2.4`）

---

## 🚀 第二步：建立 Next.js 專案

### 1. 進入專案目錄
```bash
cd /Users/justinzou/Desktop/AntigravityTest
```

### 2. 建立 Next.js 專案
執行以下指令（會詢問一些問題）：
```bash
npx create-next-app@latest . --typescript --tailwind --app
```

**參數說明：**
- `.` = 在當前目錄建立（不另外建立子資料夾）
- `--typescript` = 使用 TypeScript
- `--tailwind` = 使用 Tailwind CSS
- `--app` = 使用 App Router（Next.js 14 新架構）

### 3. 安裝過程中的問題回答

執行後會詢問幾個問題，請這樣回答：

```
✔ Would you like to use ESLint? 
→ Yes（輸入 y）

✔ Would you like to use `src/` directory? 
→ No（輸入 n）

✔ Would you like to use App Router? (recommended)
→ Yes（輸入 y）

✔ Would you like to customize the default import alias (@/*)? 
→ No（輸入 n）
```

安裝時間約 2-3 分鐘。

---

## 📦 第三步：安裝 Supabase SDK

### 1. 安裝 Supabase 套件
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### 2. 建立環境變數檔案
```bash
cp .env.example .env.local
```

這會複製環境變數範本並建立 `.env.local` 檔案（已經包含您的 Supabase 連線資訊）。

### 3. 驗證環境變數
檢查 `.env.local` 檔案內容：
```bash
cat .env.local
```

應該看到：
```
NEXT_PUBLIC_SUPABASE_URL=https://wulqxvqcjarmjhefdpgx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_n9JlJLewfQymf_8pG_624w_OSN_Nzj3
```

---

## 🧪 第四步：啟動開發伺服器

### 1. 啟動專案
```bash
npm run dev
```

### 2. 開啟瀏覽器
前往：http://localhost:3000

應該會看到 Next.js 的預設歡迎頁面！

### 3. 停止伺服器
按 `Ctrl + C` 即可停止

---

## ✅ 安裝完成檢查清單

- [ ] Node.js 已安裝（`node -v` 顯示版本）
- [ ] npm 已安裝（`npm -v` 顯示版本）
- [ ] Next.js 專案已建立
- [ ] Supabase SDK 已安裝
- [ ] `.env.local` 已建立並包含正確的 API 金鑰
- [ ] 開發伺服器可以啟動（`npm run dev`）
- [ ] 瀏覽器可以看到頁面（http://localhost:3000）

---

## 📁 專案結構預覽

安裝完成後，您的專案會是這樣：

```
AntigravityTest/
├── app/                    # Next.js App Router 主目錄
│   ├── favicon.ico
│   ├── globals.css        # 全域樣式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首頁
├── public/                # 靜態檔案
├── supabase/             # Supabase 資料庫腳本
├── .env.local            # 環境變數（不會上傳到 GitHub）
├── .env.example          # 環境變數範本
├── .gitignore
├── next.config.js        # Next.js 設定
├── package.json          # 專案相依套件
├── tailwind.config.ts    # Tailwind CSS 設定
└── tsconfig.json         # TypeScript 設定
```

---

## 🎯 完成後的下一步

安裝完成後，我們就可以：
1. 建立 Supabase client 設定
2. 實作登入功能
3. 實作打卡介面
4. Push 到 GitHub
5. 部署到 Vercel

---

**請先安裝 Node.js，然後告訴我已完成！**

如果安裝過程中遇到任何問題，請隨時告訴我。
