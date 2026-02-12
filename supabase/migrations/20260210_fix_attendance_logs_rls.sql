-- 修正 attendance_edit_logs 表的 RLS 政策
-- 允許主管查看所有員工的修改記錄

-- 1. 刪除舊的 "View own logs" 政策
DROP POLICY IF EXISTS "View own logs" ON attendance_edit_logs;

-- 2. 創建新的政策,正確檢查主管權限
CREATE POLICY "View own logs" ON attendance_edit_logs FOR SELECT
    USING (
        -- 員工可以查看自己的修改記錄
        EXISTS (
            SELECT 1 FROM attendance 
            WHERE attendance.id = attendance_edit_logs.attendance_id 
            AND attendance.user_id = auth.uid()
        ) 
        OR
        -- 主管可以查看所有修改記錄
        EXISTS (
            SELECT 1 FROM users
            WHERE users.id = auth.uid()
            AND users.role IN ('manager', 'super_admin')
        )
    );

-- 註解
COMMENT ON POLICY "View own logs" ON attendance_edit_logs IS '員工可以查看自己的修改記錄,主管可以查看所有修改記錄';
