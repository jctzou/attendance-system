-- 建立一個可以繞過 RLS 的 Database Function 讓一般員工也能抓到管理員的 ID
CREATE OR REPLACE FUNCTION get_admin_ids()
RETURNS TABLE (id uuid) 
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY SELECT users.id FROM users WHERE role IN ('manager', 'super_admin');
END;
$$ LANGUAGE plpgsql;
