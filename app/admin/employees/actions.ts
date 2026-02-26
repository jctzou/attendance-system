'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// --- Types ---
export interface EmployeeData {
    id: string
    display_name: string | null
    email: string | null
    employee_id: string | null
    role: string
    salary_type: 'monthly' | 'hourly'
    salary_amount: number | null
    work_start_time: string | null
    work_end_time: string | null
    onboard_date: string | null
    resign_date: string | null
    is_active: boolean
    annual_leave_total: number
    annual_leave_used: number
}

export type ValidationResult = {
    success: boolean
    error?: string
}

// --- Schemas ---
const CreateEmployeeSchema = z.object({
    email: z.string().email('Email 格式錯誤'),
    password: z.string().min(6, '密碼至少需 6 碼'),
    displayName: z.string().min(1, '姓名不能為空'),
    employeeId: z.string().optional().nullable(),
    role: z.enum(['employee', 'manager', 'super_admin']),
    salaryType: z.enum(['monthly', 'hourly']),
    salaryAmount: z.number().min(0).default(0),
    workStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '時間格式需為 HH:mm'),
    workEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, '時間格式需為 HH:mm'),
    onboardDate: z.string().optional().nullable(),
})

const UpdateEmployeeSchema = z.object({
    userId: z.string().uuid(),
    email: z.string().email('Email 格式錯誤'),
    displayName: z.string().min(1, '姓名不能為空'),
    employeeId: z.string().optional().nullable(),
    role: z.enum(['employee', 'manager', 'super_admin']),
    salaryType: z.enum(['monthly', 'hourly']),
    salaryAmount: z.number().min(0).default(0),
    workStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, '時間格式需為 HH:mm:ss?'),
    workEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, '時間格式需為 HH:mm:ss?'),
    onboardDate: z.string().nullable().optional(),
    resignDate: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
    annualLeaveTotal: z.number().min(0).default(0),
})

// --- Helpers ---
const ensureAdmin = async () => {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Unauthorized')

    const { data: adminUser } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!adminUser || !['manager', 'super_admin'].includes(adminUser.role)) {
        throw new Error('Permission denied')
    }
    return { supabase, user }
}

// --- Actions ---

/**
 * Get all employees with full details
 */
export async function getEmployees() {
    try {
        const { supabase } = await ensureAdmin()
        const { data, error } = await supabase
            .from('users')
            .select('*') // Select all fields to include new columns
            .order('created_at', { ascending: false })

        if (error) return { error: error.message }
        return { data: data as EmployeeData[] }
    } catch (e: any) {
        return { error: e.message }
    }
}

/**
 * Create new employee (Auth + DB)
 */
export async function createEmployee(prevState: any, formData: FormData): Promise<ValidationResult> {
    try {
        await ensureAdmin()
        const rawData = {
            email: formData.get('email'),
            password: formData.get('password'),
            displayName: formData.get('displayName'),
            employeeId: formData.get('employeeId'),
            role: formData.get('role'),
            salaryType: formData.get('salaryType'),
            salaryAmount: Number(formData.get('salaryAmount') || 0),
            workStartTime: formData.get('workStartTime') as string, // HH:mm
            workEndTime: formData.get('workEndTime') as string,     // HH:mm
            onboardDate: formData.get('onboardDate') || null,
        }

        const validated = CreateEmployeeSchema.safeParse(rawData)
        if (!validated.success) return { success: false, error: validated.error.issues[0].message }
        const { email, password, displayName, employeeId, role, salaryType, salaryAmount, onboardDate, workStartTime, workEndTime } = validated.data

        const supabaseAdmin = createAdminClient()
        if (!supabaseAdmin) {
            return { success: false, error: '系統未設定 SUPABASE_SERVICE_ROLE_KEY，無法建立 Auth 帳號。' }
        }

        // 1. Create Auth User
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { display_name: displayName }
        })

        if (authError || !authUser.user) return { success: false, error: authError?.message || '建立帳號失敗' }

        // 2. Update Public User Record (Trigger might have created it, or we insert/update)
        // Since trigger usually handles insert on auth.users, we should update the record with details
        // Wait a bit or try upsert if trigger is slow?
        // Better: Use upsert on public.users with the returned ID.

        // Format times to HH:mm:ss for DB
        const formatTime = (t: string) => t.length === 5 ? `${t}:00` : t

        const { error: dbError } = await supabaseAdmin
            .from('users')
            .update({
                display_name: displayName,
                employee_id: employeeId || null,
                role: role,
                salary_type: salaryType,
                salary_amount: salaryAmount,
                work_start_time: formatTime(workStartTime),
                work_end_time: formatTime(workEndTime),
                onboard_date: onboardDate,
                is_active: true
            })
            .eq('id', authUser.user.id)

        // Only insert if update failed (trigger didn't run?) - unlikely with standard supabase setup
        // Actually, trigger usually just inserts basic info. We need to update.
        if (dbError) {
            console.error('DB Update Error:', dbError)
            // Clean up auth user if DB fails? 
            // await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
            return { success: false, error: '建立員工資料失敗: ' + dbError.message }
        }

        revalidatePath('/admin/employees')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}


/**
 * Update employee profile
 */
export async function updateEmployee(prevState: any, formData: FormData): Promise<ValidationResult> {
    try {
        const { supabase } = await ensureAdmin() // Check permission first
        const supabaseAdmin = createAdminClient() // Needed for Auth updates

        // Parse Data
        const rawData = {
            userId: formData.get('userId'),
            email: formData.get('email'),
            displayName: formData.get('displayName'),
            employeeId: formData.get('employeeId'),
            role: formData.get('role'),
            salaryType: formData.get('salaryType'),
            salaryAmount: Number(formData.get('salaryAmount') || 0),
            workStartTime: formData.get('workStartTime'), // HH:mm:ss
            workEndTime: formData.get('workEndTime'),     // HH:mm:ss
            onboardDate: formData.get('onboardDate') || null,
            resignDate: formData.get('resignDate') || null,
            isActive: formData.get('isActive') === 'true',
            annualLeaveTotal: Number(formData.get('annualLeaveTotal') || 0)
        }

        const validated = UpdateEmployeeSchema.safeParse(rawData)
        if (!validated.success) return { success: false, error: validated.error.issues[0].message }

        const { userId, email, displayName, employeeId, role, salaryType, salaryAmount, onboardDate, resignDate, isActive, annualLeaveTotal, workStartTime, workEndTime } = validated.data

        // Logic: specific checks
        if (role === 'employee' && userId === (await supabase.auth.getUser()).data.user?.id) {
            // Self-demotion check? Allow for now but warn in UI.
        }

        // Logic: specific checks
        const shouldBan = !!resignDate || isActive === false

        // 1. Sync Auth Email if changed
        const { data: currentUser } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (currentUser.user && currentUser.user.email !== email) {
            const { error: updateEmailError } = await supabaseAdmin.auth.admin.updateUserById(userId, { email })
            if (updateEmailError) return { success: false, error: '更新 Email 失敗: ' + updateEmailError.message }
        }

        // 2. Resignation Logic (Auth Ban)
        if (shouldBan) {
            await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '876600h' }) // Ban for 100 years
        } else {
            await supabaseAdmin.auth.admin.updateUserById(userId, { ban_duration: '0s' }) // Unban
        }

        const finalIsActive = !shouldBan

        // 3. Update DB
        const { error } = await supabase
            .from('users')
            .update({
                display_name: displayName,
                employee_id: employeeId || null,
                role: role,
                salary_type: salaryType,
                salary_amount: salaryAmount,
                work_start_time: workStartTime,
                work_end_time: workEndTime,
                onboard_date: onboardDate,
                resign_date: resignDate,
                is_active: finalIsActive,
                annual_leave_total: annualLeaveTotal,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (error) return { success: false, error: error.message }

        revalidatePath('/admin/employees')
        return { success: true }
    } catch (e: any) {
        return { success: false, error: e.message }
    }
}
