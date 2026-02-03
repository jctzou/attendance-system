-- ============================================
-- 強制修復 RLS 無限遞迴腳本 (Force Fix)
-- ============================================

BEGIN;

-- 1. 停用 RLS (最快速解除所有限制的方法)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 2. 刪除所有已知可能存在的政策 (以防萬一)
DROP POLICY IF EXISTS "使用者可以查看自己的資料" ON users;
DROP POLICY IF EXISTS "Allow users to read own data" ON users;
DROP POLICY IF EXISTS "Users can view their own data" ON users;
DROP POLICY IF EXISTS "Allow public read access" ON users;
DROP POLICY IF EXISTS "Enable read access for all users" ON users;
DROP POLICY IF EXISTS "Allow public read for testing" ON users;
DROP POLICY IF EXISTS "Allow individual read access" ON users;
DROP POLICY IF EXISTS "Allow admin read al" ON users;
DROP POLICY IF EXISTS "Admins can view all data" ON users;

-- 3. 重新啟用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 4. 建立一個絕對安全的暫時測試政策 (不查詢任何資料表)
-- 允許所有人已登入/未登入都能讀取
CREATE POLICY "Allow public read for testing" ON users
  FOR SELECT USING (true);

COMMIT;
