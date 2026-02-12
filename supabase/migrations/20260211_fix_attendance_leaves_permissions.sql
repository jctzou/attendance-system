
-- Enable RLS on attendance if not already enabled
ALTER TABLE IF EXISTS attendance ENABLE ROW LEVEL SECURITY;

-- Allow managers to view all attendance records
DROP POLICY IF EXISTS "Managers can view all attendance" ON attendance;
CREATE POLICY "Managers can view all attendance" ON attendance
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );

-- Enable RLS on leaves if not already enabled
ALTER TABLE IF EXISTS leaves ENABLE ROW LEVEL SECURITY;

-- Allow managers to view all leave records
DROP POLICY IF EXISTS "Managers can view all leaves" ON leaves;
CREATE POLICY "Managers can view all leaves" ON leaves
  FOR SELECT
  USING (
    (SELECT role FROM users WHERE id = auth.uid()) IN ('manager', 'super_admin')
  );
