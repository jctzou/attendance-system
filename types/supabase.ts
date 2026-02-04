export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    public: {
        Tables: {
            users: {
                Row: {
                    id: string
                    employee_id: string | null
                    display_name: string | null
                    email: string
                    phone: string | null
                    avatar_url: string | null
                    role: 'employee' | 'manager' | 'super_admin'
                    salary_type: 'hourly' | 'monthly'
                    salary_amount: number
                    work_start_time: string
                    work_end_time: string
                    hire_date: string | null
                    resign_date: string | null
                    is_active: boolean
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id: string
                    employee_id?: string | null
                    display_name?: string | null
                    email: string
                    phone?: string | null
                    avatar_url?: string | null
                    role?: 'employee' | 'manager' | 'super_admin'
                    salary_type?: 'hourly' | 'monthly'
                    salary_amount?: number
                    work_start_time?: string
                    work_end_time?: string
                    hire_date?: string | null
                    resign_date?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    employee_id?: string | null
                    display_name?: string | null
                    email?: string
                    phone?: string | null
                    avatar_url?: string | null
                    role?: 'employee' | 'manager' | 'super_admin'
                    salary_type?: 'hourly' | 'monthly'
                    salary_amount?: number
                    work_start_time?: string
                    work_end_time?: string
                    hire_date?: string | null
                    resign_date?: string | null
                    is_active?: boolean
                    created_at?: string
                    updated_at?: string
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
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
    }
}
