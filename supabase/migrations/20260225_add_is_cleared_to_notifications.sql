-- Add is_cleared column to notifications table for soft delete
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_cleared BOOLEAN DEFAULT FALSE;

-- Update RLS policies to allow update (if it's not already allowed for the owner)
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
ON notifications FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
