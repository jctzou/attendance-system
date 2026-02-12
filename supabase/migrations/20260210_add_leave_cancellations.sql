-- 創建請假取消申請表
CREATE TABLE leave_cancellations (
    id SERIAL PRIMARY KEY,
    leave_id INTEGER NOT NULL REFERENCES leaves(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    cancel_reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 創建索引以提高查詢效能
CREATE INDEX idx_leave_cancellations_leave_id ON leave_cancellations(leave_id);
CREATE INDEX idx_leave_cancellations_user_id ON leave_cancellations(user_id);
CREATE INDEX idx_leave_cancellations_status ON leave_cancellations(status);

-- 添加 updated_at 觸發器
CREATE TRIGGER update_leave_cancellations_updated_at 
    BEFORE UPDATE ON leave_cancellations 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 啟用 RLS
ALTER TABLE leave_cancellations ENABLE ROW LEVEL SECURITY;

-- RLS 政策: 員工可以查看自己的取消申請
CREATE POLICY "View own cancellations" ON leave_cancellations
    FOR SELECT
    USING (
        auth.uid() = user_id
        OR
        -- 主管可以查看所有取消申請
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('manager', 'super_admin')
        )
    );

-- RLS 政策: 員工可以創建自己的取消申請
CREATE POLICY "Create own cancellations" ON leave_cancellations
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- RLS 政策: 主管可以更新取消申請(審核)
CREATE POLICY "Managers can review cancellations" ON leave_cancellations
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('manager', 'super_admin')
        )
    );

-- 註解
COMMENT ON TABLE leave_cancellations IS '請假取消申請記錄表';
COMMENT ON COLUMN leave_cancellations.leave_id IS '關聯的請假記錄 ID';
COMMENT ON COLUMN leave_cancellations.user_id IS '申請取消的員工 ID';
COMMENT ON COLUMN leave_cancellations.cancel_reason IS '取消原因';
COMMENT ON COLUMN leave_cancellations.status IS '審核狀態: pending(待審核), approved(已批准), rejected(已拒絕)';
COMMENT ON COLUMN leave_cancellations.reviewed_by IS '審核者 ID';
COMMENT ON COLUMN leave_cancellations.reviewed_at IS '審核時間';
