-- 修改 leaves 表的 status constraint,添加 'cancelled' 狀態

-- 1. 刪除舊的 check constraint
ALTER TABLE leaves DROP CONSTRAINT IF EXISTS leaves_status_check;

-- 2. 添加新的 check constraint,包含 'cancelled'
ALTER TABLE leaves ADD CONSTRAINT leaves_status_check 
    CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'));

-- 註解
COMMENT ON CONSTRAINT leaves_status_check ON leaves IS '請假狀態限制: pending(待審核), approved(已批准), rejected(已拒絕), cancelled(已取消)';
