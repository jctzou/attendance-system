-- Look at the first few undeleted notifications to see who the owner is
SELECT id, user_id, title FROM notifications WHERE is_cleared = false LIMIT 5;
