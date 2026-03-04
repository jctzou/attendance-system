-- Rename work_hours to work_minutes in attendance table
ALTER TABLE public.attendance RENAME COLUMN work_hours TO work_minutes;

-- Rename work_hours to work_minutes in salary_records table
ALTER TABLE public.salary_records RENAME COLUMN work_hours TO work_minutes;
