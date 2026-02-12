
-- Enable RLS on salary_history if not already enabled
ALTER TABLE IF EXISTS salary_history ENABLE ROW LEVEL SECURITY;

-- Allow managers to view salary history
DROP POLICY IF EXISTS "Managers can view salary history" ON salary_history;
CREATE POLICY "Managers can view salary history" ON salary_history
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

-- Allow managers to insert salary history
DROP POLICY IF EXISTS "Managers can insert salary history" ON salary_history;
CREATE POLICY "Managers can insert salary history" ON salary_history
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

-- Allow managers to update user salary info
DROP POLICY IF EXISTS "Managers can update user salary info" ON users;
CREATE POLICY "Managers can update user salary info" ON users
  FOR UPDATE
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );
