'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Types ---
export interface EmployeeData {
    id: string
    display_name: string | null
    email: string | null
    employee_id: string | null
    role: string
    onboard_date: string | null
    annual_leave_total: number
    annual_leave_used: number
}

// --- Schemas ---
const UpdateEmployeeSchema = z.object({
    userId: z.string().uuid(),
    displayName: z.string().min(1, '姓名不能為空'),
    employeeId: z.string().optional().nullable(),
    role: z.enum(['employee', 'manager', 'super_admin']),
    onboardDate: z.string().nullable().optional(), // ISO Date String YYYY-MM-DD
    annualLeaveTotal: z.number().min(0).default(0),
})

export type ValidationResult = {
    success: boolean
    error?: string
}

// --- Actions ---

/**
 * Get all employees for admin management
 */
export async function getEmployees() {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Check permissions
    const { data: adminUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!adminUser || !['manager', 'super_admin'].includes(adminUser.role)) {
        return { error: 'Permission denied' }
    }

    const { data, error } = await supabase
        .from('users')
        .select('id, display_name, email, employee_id, role, onboard_date, annual_leave_total, annual_leave_used')
        .order('created_at', { ascending: false })

    if (error) return { error: error.message }
    return { data: data as EmployeeData[] }
}

/**
 * Update employee profile
 */
export async function updateEmployee(prevState: any, formData: FormData): Promise<ValidationResult> {
    const supabase = await createClient() as any
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { success: false, error: 'Unauthorized' }

    // Check permissions
    const { data: adminUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!adminUser || !['manager', 'super_admin'].includes(adminUser.role)) {
        return { success: false, error: 'Permission denied' }
    }

    // Parse Data
    const rawData = {
        userId: formData.get('userId'),
        displayName: formData.get('displayName'),
        employeeId: formData.get('employeeId'),
        role: formData.get('role'),
        onboardDate: formData.get('onboardDate') || null,
        annualLeaveTotal: Number(formData.get('annualLeaveTotal') || 0)
    }

    const validated = UpdateEmployeeSchema.safeParse(rawData)

    if (!validated.success) {
        return { success: false, error: validated.error.issues[0].message }
    }

    const { userId, displayName, employeeId, role, onboardDate, annualLeaveTotal } = validated.data

    // Update DB
    const { error } = await supabase
        .from('users')
        .update({
            display_name: displayName,
            employee_id: employeeId || null,
            role: role,
            onboard_date: onboardDate,
            annual_leave_total: annualLeaveTotal,
            updated_at: new Date().toISOString()
        })
        .eq('id', userId)

    if (error) return { success: false, error: error.message }

    revalidatePath('/admin/employees')
    return { success: true }
}
