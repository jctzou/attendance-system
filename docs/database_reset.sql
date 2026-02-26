-- 此腳本將除 users 與其他不在使用中的遺留表以外的「核心活動紀錄」清空，並重置流水號(id)為 1
TRUNCATE TABLE 
  attendance, 
  attendance_edit_logs, 
  leaves, 
  notifications,
  annual_leave_logs, 
  salary_records 
RESTART IDENTITY CASCADE;
