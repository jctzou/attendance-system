-- 允許員工查看自己的已發放薪資記錄
CREATE POLICY "Users view own paid salary records" ON salary_records FOR SELECT
    USING (user_id = auth.uid() AND is_paid = true);
