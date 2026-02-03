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
                    id: number
                    employee_id: string
                    name: string
                    email: string
                    role: string
                    created_at: string
                }
                Insert: {
                    id?: number
                    employee_id: string
                    name: string
                    email: string
                    role?: string
                    created_at?: string
                }
                Update: {
                    id?: number
                    employee_id?: string
                    name?: string
                    email?: string
                    role?: string
                    created_at?: string
                }
            }
        }
    }
}
