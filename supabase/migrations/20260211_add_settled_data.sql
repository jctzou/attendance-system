-- 新增 settled_data 欄位到 salary_records 表
-- 用於保存結算時的薪資數據快照

ALTER TABLE salary_records 
ADD COLUMN IF NOT EXISTS settled_data JSONB;

COMMENT ON COLUMN salary_records.settled_data IS '結算時的薪資數據快照，包含 base_salary, work_hours, bonus, deduction, total_salary, details 等資訊';
