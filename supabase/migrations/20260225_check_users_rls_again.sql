-- 找出所有 users 的 RLS
SELECT policyname, permissive, roles, cmd, qual FROM pg_policies WHERE tablename = 'users';
