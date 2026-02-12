
-- Enable RLS on salary_records if not already enabled
ALTER TABLE IF EXISTS salary_records ENABLE ROW LEVEL SECURITY;

-- Allow managers to view salary_records
DROP POLICY IF EXISTS "Managers can view salary_records" ON salary_records;
CREATE POLICY "Managers can view salary_records" ON salary_records
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

-- Allow managers to insert salary_records
DROP POLICY IF EXISTS "Managers can insert salary_records" ON salary_records;
CREATE POLICY "Managers can insert salary_records" ON salary_records
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

-- Allow managers to update salary_records
DROP POLICY IF EXISTS "Managers can update salary_records" ON salary_records;
CREATE POLICY "Managers can update salary_records" ON salary_records
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

-- Allow managers to delete salary_records (if needed, adding just in case)
DROP POLICY IF EXISTS "Managers can delete salary_records" ON salary_records;
CREATE POLICY "Managers can delete salary_records" ON salary_records
  FOR DELETE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );
