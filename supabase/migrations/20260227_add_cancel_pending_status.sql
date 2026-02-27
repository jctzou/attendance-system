-- 新增請假取消申請機制
-- 1. 擴充 status 欄位的 CHECK constraint，加入 cancel_pending 狀態
-- 2. 確保 cancel_reason 欄位存在（用於員工填寫的取消原因）
-- 3. 確認 approver 相關欄位存在（記錄審核人資訊）

-- Step 1: 移除舊的 status CHECK constraint
ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_status_check;

-- Step 2: 建立新的 status CHECK constraint，加入 cancel_pending
ALTER TABLE leaves ADD CONSTRAINT leaves_status_check
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'cancel_pending'));

COMMENT ON CONSTRAINT leaves_status_check ON leaves IS
    '請假狀態: pending(待審核), approved(已批准), rejected(已拒絕), cancelled(已取消), cancel_pending(取消審核中)';

-- Step 3: 確保 cancel_reason 欄位存在
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
COMMENT ON COLUMN leaves.cancel_reason IS '員工申請取消假單時填寫的取消原因，僅在 cancel_pending 期間有值，主管審核後清空';

-- Step 4: 確保 approver 相關欄位存在（記錄是誰、何時批准/退回）
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS approver_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS approval_note TEXT;
ALTER TABLE leaves ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

COMMENT ON COLUMN leaves.approver_id IS '審核此假單的主管 UUID';
COMMENT ON COLUMN leaves.approval_note IS '主管審核時留下的備註（例如退回原因）';
COMMENT ON COLUMN leaves.approved_at IS '主管審核的時間戳';

-- Step 5: 更新 RLS 政策 — 允許員工更新自己假單的 cancel 相關欄位
-- （允許員工把 approved 狀態的假單改為 cancel_pending）
DROP POLICY IF EXISTS "employees_can_request_cancel" ON leaves;
CREATE POLICY "employees_can_request_cancel" ON leaves
    FOR UPDATE
    USING (
        auth.uid() = user_id
        AND status = 'approved'
    )
    WITH CHECK (
        auth.uid() = user_id
        AND status = 'cancel_pending'
    );
