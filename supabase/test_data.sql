-- ============================================
-- 測試資料插入腳本 (Refactored)
-- 注意：使用者資料現在由 Setup Tool (Auth) 建立
-- 本腳本主要用於插入「考勤」與「請假」資料
-- ⚠️ 必須等到使用者建立完成，並取得 UUID 後才能建立這些資料
-- ============================================

-- 這裡先留空，或提供範本
-- 實際操作時，建議使用 Setup Tool 裡面的 "Generate Data" 按鈕直接寫入資料庫，
-- 或者在 SQL Editor 查詢出 user_id 後手動替換。

/* 範本：
INSERT INTO attendance (user_id, work_date, clock_in_time, clock_out_time, work_hours, status) 
VALUES 
(
  (SELECT id FROM users WHERE email = 'employee@example.com'), 
  '2026-01-31', 
  '2026-01-31 09:00:00+08', 
  '2026-01-31 18:00:00+08', 
  8.00, 
  'normal'
);
*/
