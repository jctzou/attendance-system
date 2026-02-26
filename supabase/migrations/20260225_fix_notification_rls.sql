-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;

-- Create a more permissive update policy for testing
-- In a real app, you might want this to be restricted to the user or admins
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO public
USING (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM users WHERE role IN ('manager', 'super_admin')))
WITH CHECK (auth.uid() = user_id OR auth.uid() IN (SELECT id FROM users WHERE role IN ('manager', 'super_admin')));
