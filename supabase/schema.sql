-- ============================================
-- 員工打卡及薪資管理系統 - Supabase Schema
-- PostgreSQL 版本
-- ============================================

-- 啟用 UUID 擴展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 使用者表 (users)
-- ============================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    employee_id VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role TEXT CHECK (role IN ('employee', 'manager', 'super_admin')) DEFAULT 'employee',
    salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly')) DEFAULT 'hourly',
    salary_amount DECIMAL(10, 2) DEFAULT 0,
    hire_date DATE,
    resign_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- 註解
COMMENT ON TABLE users IS '使用者/員工資料表';
COMMENT ON COLUMN users.employee_id IS '員工編號';
COMMENT ON COLUMN users.role IS '角色: employee(員工), manager(一般管理員), super_admin(最高管理員)';
COMMENT ON COLUMN users.salary_type IS '薪資類型: hourly(時薪), monthly(月薪)';
COMMENT ON COLUMN users.salary_amount IS '薪資金額';

-- ============================================
-- 2. 登入 Token 表 (login_tokens)
-- ============================================
CREATE TABLE login_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    user_agent VARCHAR(255),
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_login_tokens_token ON login_tokens(token);
CREATE INDEX idx_login_tokens_user_id ON login_tokens(user_id);

COMMENT ON TABLE login_tokens IS '登入 Token 記錄（記住登入）';

-- ============================================
-- 3. 打卡記錄表 (attendance)
-- ============================================
CREATE TABLE attendance (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    work_hours DECIMAL(5, 2),
    status TEXT CHECK (status IN ('normal', 'late', 'early_leave', 'absent')) DEFAULT 'normal',
    ip_address INET,
    device_info VARCHAR(255),
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, work_date)
);

CREATE INDEX idx_attendance_work_date ON attendance(work_date);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, work_date);

COMMENT ON TABLE attendance IS '打卡記錄表';
COMMENT ON COLUMN attendance.work_date IS '工作日期';
COMMENT ON COLUMN attendance.status IS '狀態: normal(正常), late(遲到), early_leave(早退), absent(缺勤)';
COMMENT ON COLUMN attendance.is_edited IS '是否被修改過';

-- ============================================
-- 4. 打卡修改記錄表 (attendance_edit_logs)
-- ============================================
CREATE TABLE attendance_edit_logs (
    id BIGSERIAL PRIMARY KEY,
    attendance_id BIGINT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    editor_id BIGINT NOT NULL REFERENCES users(id),
    old_clock_in_time TIMESTAMPTZ,
    new_clock_in_time TIMESTAMPTZ,
    old_clock_out_time TIMESTAMPTZ,
    new_clock_out_time TIMESTAMPTZ,
    edit_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_attendance_edit_logs_attendance_id ON attendance_edit_logs(attendance_id);
CREATE INDEX idx_attendance_edit_logs_editor_id ON attendance_edit_logs(editor_id);

COMMENT ON TABLE attendance_edit_logs IS '打卡修改記錄表';
COMMENT ON COLUMN attendance_edit_logs.editor_id IS '修改者ID';
COMMENT ON COLUMN attendance_edit_logs.edit_reason IS '修改原因';

-- ============================================
-- 5. 請假記錄表 (leaves)
-- ============================================
CREATE TABLE leaves (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type TEXT CHECK (leave_type IN ('sick_leave', 'personal_leave', 'annual_leave', 'other')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approver_id BIGINT REFERENCES users(id),
    approval_note TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaves_user_id ON leaves(user_id);
CREATE INDEX idx_leaves_dates ON leaves(start_date, end_date);
CREATE INDEX idx_leaves_status ON leaves(status);

COMMENT ON TABLE leaves IS '請假記錄表';
COMMENT ON COLUMN leaves.leave_type IS '請假類型: sick_leave(病假), personal_leave(事假), annual_leave(特休), other(其他)';
COMMENT ON COLUMN leaves.hours IS '請假時數';
COMMENT ON COLUMN leaves.status IS '審核狀態: pending(待審核), approved(已批准), rejected(已拒絕)';
COMMENT ON COLUMN leaves.approver_id IS '審核者ID';

-- ============================================
-- 6. 薪資歷史表 (salary_history)
-- ============================================
CREATE TABLE salary_history (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly')) NOT NULL,
    salary_amount DECIMAL(10, 2) NOT NULL,
    effective_date DATE NOT NULL,
    note TEXT,
    created_by BIGINT NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_salary_history_user_id ON salary_history(user_id);
CREATE INDEX idx_salary_history_effective_date ON salary_history(effective_date);

COMMENT ON TABLE salary_history IS '薪資歷史表（記錄薪資變動）';
COMMENT ON COLUMN salary_history.effective_date IS '生效日期';

-- ============================================
-- 7. 操作日誌表 (operation_logs)
-- ============================================
CREATE TABLE operation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id BIGINT,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_operation_logs_user_id ON operation_logs(user_id);
CREATE INDEX idx_operation_logs_action ON operation_logs(action);
CREATE INDEX idx_operation_logs_created_at ON operation_logs(created_at);

COMMENT ON TABLE operation_logs IS '操作日誌表（記錄重要操作）';
COMMENT ON COLUMN operation_logs.action IS '操作類型';
COMMENT ON COLUMN operation_logs.target_type IS '目標類型(user/attendance/leave等)';
COMMENT ON COLUMN operation_logs.details IS '詳細資訊(JSON格式)';

-- ============================================
-- 8. 自動更新 updated_at 的函數
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 為需要的表建立觸發器
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON leaves
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 9. Row Level Security (RLS) 政策
-- ============================================

-- 啟用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- Users 政策
CREATE POLICY "使用者可以查看自己的資料"
    ON users FOR SELECT
    USING (auth.uid()::text = id::text OR 
           (SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('manager', 'super_admin'));

CREATE POLICY "管理員可以新增使用者"
    ON users FOR INSERT
    WITH CHECK ((SELECT role FROM users WHERE id::text = auth.uid()::text) = 'super_admin');

CREATE POLICY "管理員可以更新使用者"
    ON users FOR UPDATE
    USING ((SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('manager', 'super_admin'));

-- Attendance 政策
CREATE POLICY "使用者可以查看自己的打卡記錄"
    ON attendance FOR SELECT
    USING (user_id::text = auth.uid()::text OR 
           (SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('manager', 'super_admin'));

CREATE POLICY "使用者可以新增自己的打卡記錄"
    ON attendance FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "使用者和管理員可以更新打卡記錄"
    ON attendance FOR UPDATE
    USING (user_id::text = auth.uid()::text OR 
           (SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('manager', 'super_admin'));

-- Leaves 政策
CREATE POLICY "使用者可以查看自己的請假記錄"
    ON leaves FOR SELECT
    USING (user_id::text = auth.uid()::text OR 
           (SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('manager', 'super_admin'));

CREATE POLICY "使用者可以新增自己的請假記錄"
    ON leaves FOR INSERT
    WITH CHECK (user_id::text = auth.uid()::text);

CREATE POLICY "管理員可以審核請假"
    ON leaves FOR UPDATE
    USING ((SELECT role FROM users WHERE id::text = auth.uid()::text) IN ('manager', 'super_admin'));

-- ============================================
-- 完成提示
-- ============================================
DO $$
BEGIN
    RAISE NOTICE '============================================';
    RAISE NOTICE '資料庫結構建立完成！';
    RAISE NOTICE '============================================';
    RAISE NOTICE '已建立 7 個資料表：';
    RAISE NOTICE '  1. users - 使用者表';
    RAISE NOTICE '  2. login_tokens - 登入Token表';
    RAISE NOTICE '  3. attendance - 打卡記錄表';
    RAISE NOTICE '  4. attendance_edit_logs - 打卡修改記錄表';
    RAISE NOTICE '  5. leaves - 請假記錄表';
    RAISE NOTICE '  6. salary_history - 薪資歷史表';
    RAISE NOTICE '  7. operation_logs - 操作日誌表';
    RAISE NOTICE '';
    RAISE NOTICE '已啟用 Row Level Security (RLS)';
    RAISE NOTICE '已建立自動更新觸發器';
    RAISE NOTICE '';
    RAISE NOTICE '下一步：執行 test_data.sql 插入測試資料';
    RAISE NOTICE '============================================';
END $$;
