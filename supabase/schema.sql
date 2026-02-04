-- ============================================
-- 員工打卡及薪資管理系統 - Supabase Schema (UUID 版)
-- ============================================

-- ⚠️ 注意：執行此腳本前請確認已清空原有表格，或者在乾淨的 Project 執行。

-- 啟用 UUID 擴展 (通常 Supabase 預設開啟)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. 使用者表 (users)
-- ============================================
-- 重要：id 必須與 auth.users 的 id 一致 (UUID)
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    employee_id VARCHAR(20) UNIQUE,
    display_name VARCHAR(100),
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    avatar_url TEXT,
    role TEXT CHECK (role IN ('employee', 'manager', 'super_admin')) DEFAULT 'employee',
    salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly')) DEFAULT 'hourly',
    salary_amount DECIMAL(10, 2) DEFAULT 0,
    work_start_time TIME DEFAULT '09:00:00',
    work_end_time TIME DEFAULT '18:00:00',
    hire_date DATE,
    resign_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 建立索引
CREATE INDEX idx_users_employee_id ON users(employee_id);
CREATE INDEX idx_users_email ON users(email);

-- 註解
COMMENT ON TABLE users IS '使用者/員工資料表 (與 Auth 同步)';

-- ============================================
-- 1.1 Trigger for Auto-Sync User
-- ============================================
-- 此函數會在 auth.users 新增資料後自動執行
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, employee_id, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'display_name',
    NEW.raw_user_meta_data->>'employee_id',
    COALESCE(NEW.raw_user_meta_data->>'role', 'employee')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 綁定 Trigger 到 auth.users
-- 注意：這需要足夠的權限 (Postgres role 通常可以)
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. 打卡記錄表 (attendance)
-- ============================================
CREATE TABLE attendance (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    work_date DATE NOT NULL,
    clock_in_time TIMESTAMPTZ,
    clock_out_time TIMESTAMPTZ,
    work_hours DECIMAL(5, 2),
    status TEXT DEFAULT 'normal', -- 可能包含多個狀態，如 'late early_leave'
    ip_address INET,
    device_info VARCHAR(255),
    is_edited BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, work_date)
);

CREATE INDEX idx_attendance_work_date ON attendance(work_date);
CREATE INDEX idx_attendance_user_date ON attendance(user_id, work_date);

-- ============================================
-- 3. 打卡修改記錄表 (attendance_edit_logs)
-- ============================================
CREATE TABLE attendance_edit_logs (
    id BIGSERIAL PRIMARY KEY,
    attendance_id BIGINT NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
    editor_id UUID NOT NULL REFERENCES users(id),
    old_clock_in_time TIMESTAMPTZ,
    new_clock_in_time TIMESTAMPTZ,
    old_clock_out_time TIMESTAMPTZ,
    new_clock_out_time TIMESTAMPTZ,
    edit_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. 請假記錄表 (leaves)
-- ============================================
CREATE TABLE leaves (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    leave_type TEXT CHECK (leave_type IN ('sick_leave', 'personal_leave', 'annual_leave', 'other')) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    hours DECIMAL(5, 2) NOT NULL,
    reason TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    approver_id UUID REFERENCES users(id),
    approval_note TEXT,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_leaves_user_id ON leaves(user_id);

-- ============================================
-- 5. 薪資歷史表 (salary_history)
-- ============================================
CREATE TABLE salary_history (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    salary_type TEXT CHECK (salary_type IN ('hourly', 'monthly')) NOT NULL,
    salary_amount DECIMAL(10, 2) NOT NULL,
    effective_date DATE NOT NULL,
    note TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. 操作日誌表 (operation_logs)
-- ============================================
CREATE TABLE operation_logs (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50),
    target_id BIGINT,
    details JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. 自動更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attendance_updated_at BEFORE UPDATE ON attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_leaves_updated_at BEFORE UPDATE ON leaves FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Row Level Security (RLS)
-- ============================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_edit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_logs ENABLE ROW LEVEL SECURITY;

-- 修正後的 RLS 政策 (直接比較 UUID，超級快且正確)

-- Users
CREATE POLICY "Users view own data" ON users FOR SELECT
    USING (auth.uid() = id OR (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin'));

CREATE POLICY "Admins manage users" ON users FOR ALL
    USING ((SELECT role FROM users WHERE id = auth.uid()) = 'super_admin');

-- Attendance
CREATE POLICY "View own attendance" ON attendance FOR SELECT
    USING (user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin'));

CREATE POLICY "Manage own attendance" ON attendance FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins update attendance" ON attendance FOR UPDATE
    USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin'));

-- Leaves
CREATE POLICY "View own leaves" ON leaves FOR SELECT
    USING (user_id = auth.uid() OR (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin'));

CREATE POLICY "Create own leaves" ON leaves FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers approve leaves" ON leaves FOR UPDATE
    USING ((SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin'));
