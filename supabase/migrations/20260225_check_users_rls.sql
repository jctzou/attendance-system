SELECT table_name, policy_name, roles, cmd, qual 
FROM pg_policies 
WHERE table_name = 'users';
