export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    display_name: string | null
                    employee_id: string | null
                    email: string
                    role: 'employee' | 'manager' | 'super_admin'
                    salary_type: 'monthly' | 'hourly'
                    salary_amount: number | null
                    work_start_time: string | null
                    work_end_time: string | null
                    avatar_url: string | null
                    hire_date: string | null
                    resign_date: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                    onboard_date: string | null
                    annual_leave_total: number | null
                    annual_leave_used: number | null
                    last_reset_date: string | null
                }
                Insert: {
                    id: string
                    display_name?: string | null
                    employee_id?: string | null
                    email: string
                    role?: 'employee' | 'manager' | 'super_admin'
                    salary_type?: 'monthly' | 'hourly'
                    salary_amount?: number | null
                    work_start_time?: string | null
                    work_end_time?: string | null
                    avatar_url?: string | null
                    hire_date?: string | null
                    resign_date?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    onboard_date?: string | null
                    annual_leave_total?: number | null
                    annual_leave_used?: number | null
                    last_reset_date?: string | null
                }
                Update: {
                    id?: string
                    display_name?: string | null
                    employee_id?: string | null
                    email?: string
                    role?: 'employee' | 'manager' | 'super_admin'
                    salary_type?: 'monthly' | 'hourly'
                    salary_amount?: number | null
                    work_start_time?: string | null
                    work_end_time?: string | null
                    avatar_url?: string | null
                    hire_date?: string | null
                    resign_date?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                    onboard_date?: string | null
                    annual_leave_total?: number | null
                    annual_leave_used?: number | null
                    last_reset_date?: string | null
                }
            }
            attendance: {
                Row: {
                    id: number
                    user_id: string
                    work_date: string
                    clock_in_time: string | null
                    clock_out_time: string | null
                    work_hours: number | null
                    status: string
                    ip_address: string | null
                    device_info: string | null
                    is_edited: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    user_id: string
                    work_date: string
                    clock_in_time?: string | null
                    clock_out_time?: string | null
                    work_hours?: number | null
                    status?: string
                    ip_address?: string | null
                    device_info?: string | null
                    is_edited?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    user_id?: string
                    work_date?: string
                    clock_in_time?: string | null
                    clock_out_time?: string | null
                    work_hours?: number | null
                    status?: string
                    ip_address?: string | null
                    device_info?: string | null
                    is_edited?: boolean
                    created_at?: string
                    updated_at?: string
                }
            }
            leaves: {
                Row: {
                    id: number
                    user_id: string
                    leave_type: string
                    start_date: string
                    end_date: string
                    reason: string | null
                    status: 'pending' | 'approved' | 'rejected'
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    user_id: string
                    leave_type: string
                    start_date: string
                    end_date: string
                    reason?: string | null
                    status?: 'pending' | 'approved' | 'rejected'
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    user_id?: string
                    leave_type?: string
                    start_date?: string
                    end_date?: string
                    reason?: string | null
                    status?: 'pending' | 'approved' | 'rejected'
                    created_at?: string
                    updated_at?: string
                }
            }
            salary_records: {
                Row: {
                    id: number
                    user_id: string
                    year_month: string
                    base_salary: number | null
                    bonus: number | null
                    deduction: number | null
                    total_salary: number | null
                    work_hours: number | null
                    is_paid: boolean
                    paid_at: string | null
                    settled_data: Json | null
                    notes: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    user_id: string
                    year_month: string
                    base_salary?: number | null
                    bonus?: number | null
                    deduction?: number | null
                    total_salary?: number | null
                    work_hours?: number | null
                    is_paid?: boolean
                    paid_at?: string | null
                    settled_data?: Json | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    user_id?: string
                    year_month?: string
                    base_salary?: number | null
                    bonus?: number | null
                    deduction?: number | null
                    total_salary?: number | null
                    work_hours?: number | null
                    is_paid?: boolean
                    paid_at?: string | null
                    settled_data?: Json | null
                    notes?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            leave_balances: {
                Row: {
                    id: string
                    user_id: string
                    year: number
                    total_days: number
                    used_days: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    year: number
                    total_days?: number
                    used_days?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    year?: number
                    total_days?: number
                    used_days?: number
                    created_at?: string
                    updated_at?: string
                }
            }
            attendance_edit_logs: {
                Row: {
                    id: number
                    attendance_id: number
                    editor_id: string
                    old_clock_in_time: string | null
                    new_clock_in_time: string | null
                    old_clock_out_time: string | null
                    new_clock_out_time: string | null
                    edit_reason: string
                    created_at: string
                }
                Insert: {
                    id?: number
                    attendance_id: number
                    editor_id: string
                    old_clock_in_time?: string | null
                    new_clock_in_time?: string | null
                    old_clock_out_time?: string | null
                    new_clock_out_time?: string | null
                    edit_reason: string
                    created_at?: string
                }
                Update: {
                    id?: number
                    attendance_id?: number
                    editor_id?: string
                    old_clock_in_time?: string | null
                    new_clock_in_time?: string | null
                    old_clock_out_time?: string | null
                    new_clock_out_time?: string | null
                    edit_reason?: string
                    created_at?: string
                }
            }
            annual_leave_logs: {
                Row: {
                    id: string
                    user_id: string
                    year: number
                    action: string
                    days_change: number
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    year: number
                    action: string
                    days_change: number
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    year?: number
                    action?: string
                    days_change?: number
                    description?: string | null
                    created_at?: string
                }
            }
        }
    }
}
