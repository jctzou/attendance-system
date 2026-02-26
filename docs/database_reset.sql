-- 此腳本將除 users 以外的所有資料表清空，並重置流水號(id)為 1
TRUNCATE TABLE 
  attendance, 
  attendance_edit_logs, 
  leaves, 
  leave_balances, 
  leave_cancellations, 
  annual_leave_logs, 
  salary_records 
RESTART IDENTITY CASCADE;
