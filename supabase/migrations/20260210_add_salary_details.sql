-- 新增 details 欄位到 salary_records 表，用於儲存薪資計算的詳細資訊（如遲到次數、請假天數等）
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS details JSONB;

-- 註解
COMMENT ON COLUMN salary_records.details IS '薪資計算詳細資訊 (JSONB)，包含出勤統計、請假天數等';
