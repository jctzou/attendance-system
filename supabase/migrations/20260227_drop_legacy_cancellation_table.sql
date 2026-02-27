-- 刪除已廢棄的舊版取消申請表 (其功能已被 leaves 表中的 cancel_reason 與 cancel_pending 狀態取代)
DROP TABLE IF EXISTS leave_cancellations CASCADE;
