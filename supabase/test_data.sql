-- ============================================
-- 測試資料插入腳本 (PostgreSQL)
-- 所有測試帳號密碼都是: password
-- ============================================

-- 1. 插入測試使用者
-- 密碼 hash 是 bcrypt('password') 的結果
INSERT INTO users (employee_id, name, email, phone, password_hash, role, salary_type, salary_amount, hire_date) VALUES
('E001', '王大明', 'admin@example.com', '0912345678', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'super_admin', 'monthly', 50000.00, '2024-01-01'),
('E002', '李小華', 'manager@example.com', '0923456789', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'manager', 'monthly', 40000.00, '2024-01-15'),
('E003', '張小美', 'employee@example.com', '0934567890', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'hourly', 200.00, '2024-02-01'),
('E004', '陳小強', 'employee2@example.com', '0945678901', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'hourly', 180.00, '2024-03-01'),
('E005', '林小玲', 'employee3@example.com', '0956789012', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'employee', 'monthly', 35000.00, '2024-04-01');

-- 2. 插入打卡記錄（最近兩週）
-- 張小美 (E003) 的打卡記錄
INSERT INTO attendance (user_id, work_date, clock_in_time, clock_out_time, work_hours, status) VALUES
(3, '2026-01-20', '2026-01-20 09:00:00+08', '2026-01-20 18:00:00+08', 8.00, 'normal'),
(3, '2026-01-21', '2026-01-21 09:05:00+08', '2026-01-21 18:00:00+08', 7.92, 'late'),
(3, '2026-01-22', '2026-01-22 09:00:00+08', '2026-01-22 17:30:00+08', 7.50, 'early_leave'),
(3, '2026-01-23', '2026-01-23 09:00:00+08', '2026-01-23 18:00:00+08', 8.00, 'normal'),
(3, '2026-01-24', '2026-01-24 09:00:00+08', '2026-01-24 18:00:00+08', 8.00, 'normal'),
(3, '2026-01-27', '2026-01-27 09:00:00+08', '2026-01-27 18:00:00+08', 8.00, 'normal'),
(3, '2026-01-28', '2026-01-28 09:10:00+08', '2026-01-28 18:00:00+08', 7.83, 'late'),
(3, '2026-01-29', '2026-01-29 09:00:00+08', '2026-01-29 18:00:00+08', 8.00, 'normal'),
(3, '2026-01-30', '2026-01-30 09:00:00+08', '2026-01-30 18:00:00+08', 8.00, 'normal'),
(3, '2026-01-31', '2026-01-31 09:00:00+08', '2026-01-31 18:00:00+08', 8.00, 'normal');

-- 陳小強 (E004) 的打卡記錄
INSERT INTO attendance (user_id, work_date, clock_in_time, clock_out_time, work_hours, status) VALUES
(4, '2026-01-20', '2026-01-20 08:55:00+08', '2026-01-20 18:00:00+08', 8.08, 'normal'),
(4, '2026-01-21', '2026-01-21 09:00:00+08', '2026-01-21 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-22', '2026-01-22 09:00:00+08', '2026-01-22 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-23', '2026-01-23 09:15:00+08', '2026-01-23 18:00:00+08', 7.75, 'late'),
(4, '2026-01-24', '2026-01-24 09:00:00+08', '2026-01-24 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-27', '2026-01-27 09:00:00+08', '2026-01-27 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-28', '2026-01-28 09:00:00+08', '2026-01-28 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-29', '2026-01-29 09:00:00+08', '2026-01-29 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-30', '2026-01-30 09:00:00+08', '2026-01-30 18:00:00+08', 8.00, 'normal'),
(4, '2026-01-31', '2026-01-31 09:00:00+08', '2026-01-31 18:00:00+08', 8.00, 'normal');

-- 3. 插入打卡修改記錄（模擬修改情境）
-- 張小美 1/22 的記錄被修改過
UPDATE attendance SET is_edited = true WHERE user_id = 3 AND work_date = '2026-01-22';

INSERT INTO attendance_edit_logs (attendance_id, editor_id, old_clock_in_time, new_clock_in_time, old_clock_out_time, new_clock_out_time, edit_reason)
VALUES (
    (SELECT id FROM attendance WHERE user_id = 3 AND work_date = '2026-01-22'),
    3,
    '2026-01-22 09:00:00+08',
    '2026-01-22 09:00:00+08',
    '2026-01-22 17:00:00+08',
    '2026-01-22 17:30:00+08',
    '忘記打下班卡，實際工作到 17:30'
);

-- 4. 插入請假記錄
INSERT INTO leaves (user_id, leave_type, start_date, end_date, hours, reason, status, approver_id, approved_at) VALUES
(3, 'sick_leave', '2026-02-03', '2026-02-03', 8.00, '感冒就醫', 'approved', 2, '2026-02-02 14:30:00+08'),
(3, 'personal_leave', '2026-02-10', '2026-02-10', 4.00, '處理私事', 'pending', NULL, NULL),
(4, 'annual_leave', '2026-02-05', '2026-02-07', 24.00, '家庭旅遊', 'approved', 2, '2026-01-25 10:00:00+08'),
(5, 'sick_leave', '2026-01-25', '2026-01-25', 8.00, '腸胃炎', 'approved', 2, '2026-01-24 16:00:00+08');

-- 5. 插入薪資歷史記錄
INSERT INTO salary_history (user_id, salary_type, salary_amount, effective_date, note, created_by) VALUES
(3, 'hourly', 180.00, '2024-02-01', '到職薪資', 1),
(3, 'hourly', 200.00, '2024-08-01', '調薪', 1),
(4, 'hourly', 180.00, '2024-03-01', '到職薪資', 1),
(5, 'monthly', 32000.00, '2024-04-01', '到職薪資', 1),
(5, 'monthly', 35000.00, '2025-01-01', '年度調薪', 1);

-- 6. 插入操作日誌範例
INSERT INTO operation_logs (user_id, action, target_type, target_id, details, ip_address) VALUES
(1, 'CREATE_USER', 'user', 5, '{"employee_id": "E005", "name": "林小玲", "role": "employee"}'::jsonb, '192.168.1.100'),
(2, 'APPROVE_LEAVE', 'leave', 1, '{"leave_id": 1, "user_id": 3, "action": "approved"}'::jsonb, '192.168.1.50'),
(3, 'EDIT_ATTENDANCE', 'attendance', 3, '{"work_date": "2026-01-22", "field": "clock_out_time", "old": "17:00", "new": "17:30"}'::jsonb, '192.168.1.25'),
(1, 'UPDATE_SALARY', 'user', 5, '{"user_id": 5, "old_amount": 32000, "new_amount": 35000}'::jsonb, '192.168.1.100');

-- ============================================
-- 驗證查詢
-- ============================================

-- 查看所有使用者
SELECT employee_id, name, role, salary_type, salary_amount FROM users ORDER BY id;

-- 查看打卡記錄
SELECT 
    u.name,
    a.work_date,
    TO_CHAR(a.clock_in_time, 'HH24:MI') as clock_in,
    TO_CHAR(a.clock_out_time, 'HH24:MI') as clock_out,
    a.work_hours,
    a.status,
    a.is_edited
FROM attendance a
JOIN users u ON a.user_id = u.id
ORDER BY a.work_date DESC, u.name;

-- 查看請假記錄
SELECT 
    u.name,
    l.leave_type,
    l.start_date,
    l.end_date,
    l.hours,
    l.status,
    l.reason
FROM leaves l
JOIN users u ON l.user_id = u.id
ORDER BY l.start_date DESC;

-- 查看有修改記錄的打卡
SELECT 
    u.name,
    a.work_date,
    TO_CHAR(ael.old_clock_out_time, 'HH24:MI') as old_time,
    TO_CHAR(ael.new_clock_out_time, 'HH24:MI') as new_time,
    ael.edit_reason,
    e.name as editor_name
FROM attendance a
JOIN users u ON a.user_id = u.id
JOIN attendance_edit_logs ael ON a.id = ael.attendance_id
JOIN users e ON ael.editor_id = e.id
WHERE a.is_edited = true;

-- 顯示統計資訊
SELECT 
    '使用者總數' as 項目,
    COUNT(*)::text as 數量
FROM users
UNION ALL
SELECT 
    '打卡記錄總數',
    COUNT(*)::text
FROM attendance
UNION ALL
SELECT 
    '請假記錄總數',
    COUNT(*)::text
FROM leaves;
