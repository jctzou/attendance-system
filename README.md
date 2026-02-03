# 員工打卡及薪資管理系統

> 使用 Supabase + Next.js + Vercel 的現代化雲端架構

## 📁 專案結構

```
AntigravityTest/
├── supabase/
│   ├── schema.sql          # PostgreSQL 資料庫結構
│   └── test_data.sql       # 測試資料
├── 雲端架構實作指南.md      # 完整實作教學
└── README.md               # 本檔案
```

## 🚀 技術棧

- **資料庫**: Supabase (PostgreSQL)
- **後端**: Supabase API + RLS (Row Level Security)
- **前端**: Next.js 14 + TypeScript + Tailwind CSS
- **部署**: Vercel
- **版本控制**: GitHub

## 📋 功能特色

### 員工功能
- ✅ 登入認證（支援記住登入）
- ✅ 上下班打卡
- ✅ 查看打卡記錄
- ✅ 修改打卡時間（留存修改記錄）
- ✅ 請假申請
- ✅ 查看請假記錄

### 管理員功能
- ✅ 查看所有員工打卡記錄
- ✅ 修改員工打卡時數
- ✅ 審核請假申請
- ✅ 薪資試算（時薪/月薪）
- ✅ 統計報表
- ✅ 人員權限管理

## 🗄️ 資料庫設計

### 7 個核心資料表

1. **users** - 使用者/員工資料
2. **login_tokens** - 登入 Token（記住登入）
3. **attendance** - 打卡記錄
4. **attendance_edit_logs** - 打卡修改歷史
5. **leaves** - 請假記錄
6. **salary_history** - 薪資變動歷史
7. **operation_logs** - 系統操作日誌

### 安全特性

- ✅ Row Level Security (RLS) - 資料列級別權限控制
- ✅ 自動更新時間戳記
- ✅ 外鍵約束確保資料完整性
- ✅ 密碼 bcrypt 加密

## 🎯 下一步：設定 Supabase

### 1. 建立 Supabase 專案

1. 前往 https://supabase.com
2. 使用 GitHub 登入
3. 建立新專案：
   - Name: `attendance-system`
   - Region: `Northeast Asia (Tokyo)`
   - Database Password: （自動生成）

### 2. 執行資料庫腳本

1. 在 Supabase Dashboard，點選「SQL Editor」
2. 點擊「New query」
3. 複製 `supabase/schema.sql` 的內容並執行
4. 再複製 `supabase/test_data.sql` 的內容並執行

### 3. 測試帳號

| 姓名 | Email | 密碼 | 權限 |
|------|-------|------|------|
| 王大明 | admin@example.com | password | 最高管理員 |
| 李小華 | manager@example.com | password | 一般管理員 |
| 張小美 | employee@example.com | password | 一般員工 |

## 📖 完整教學

請參考 **[雲端架構實作指南.md](./雲端架構實作指南.md)** 獲得詳細的設定步驟。

## 💡 為什麼選擇雲端架構？

| 項目 | 本地方案 | 雲端方案 |
|------|---------|---------|
| 環境設定 | 需安裝 PHP、MySQL | ✅ 無需安裝 |
| 部署 | 需租伺服器 | ✅ 免費部署 |
| 擴展性 | 單機限制 | ✅ 自動擴展 |
| HTTPS | 需設定 SSL | ✅ 自動 HTTPS |
| 維護成本 | 高 | ✅ 低 |

## 📞 需要協助？

遇到任何問題，請隨時詢問！

---

**專案狀態**: 🟡 資料庫腳本已就緒，等待設定 Supabase
