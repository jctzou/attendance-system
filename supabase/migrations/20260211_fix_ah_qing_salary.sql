-- Fix Ah Qing salary settings
UPDATE users
SET 
  salary_type = 'hourly',
  salary_amount = 183, -- Minimum wage or placeholder
  updated_at = NOW()
WHERE display_name = '阿慶' OR email LIKE '%ahqing%' OR email = 'jctzou@gmail.com'; -- Using jctzou@gmail.com as observed in browser
