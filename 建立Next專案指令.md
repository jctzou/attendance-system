# Next.js 專案建立指令

## 🎯 請在終端機中執行以下指令：

### 1. 進入專案目錄
```bash
cd /Users/justinzou/Desktop/attendance-system
```

### 2. 建立 Next.js 專案
```bash
npx create-next-app@latest . --typescript --tailwind --app --eslint
```

這個指令會自動：
- ✅ 安裝 Next.js 14
- ✅ 設定 TypeScript
- ✅ 設定 Tailwind CSS  
- ✅ 使用 App Router
- ✅ 設定 ESLint

**預計時間：2-3 分鐘**

### 3. 等待安裝完成
看到類似訊息代表成功：
```
Success! Created attendance-system at /Users/justinzou/Desktop/attendance-system
```

### 4. 安裝 Supabase SDK
```bash
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### 5. 建立環境變數檔案
```bash
cp .env.example .env.local
```

這會複製您的 Supabase 連線資訊。

### 6. 啟動開發伺服器測試
```bash
npm run dev
```

然後開啟瀏覽器前往：http://localhost:3000

應該會看到 Next.js 的歡迎頁面！

---

## ✅ 完成後請告訴我結果

如果看到任何錯誤訊息，請直接貼給我。
