'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { ActionResult, ErrorCodes } from '@/types/actions'
import { requireUserProfile, requireUserRole, withErrorHandling } from '@/utils/actions_common'
import { calculateSalary } from '@/utils/salary-engine'
import { z } from 'zod'

// 支援前端查詢使用
export async function getMySalaryRecords(): Promise<ActionResult<any[]>> {
    return withErrorHandling(async () => {
        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('salary_records')
            .select(`
                *,
                user:users ( display_name, email, salary_type )
            `)
            .eq('user_id', profile.id)
            .eq('is_paid', true)
            .order('year_month', { ascending: false })

        if (error) throw new Error(error.message)
        return data || []
    })
}

/**
 * 預覽特定員工某月份薪資 (線上即時算或拿 snapshot)
 * Managers only
 */
export async function previewEmployeeSalary(employeeId: string, yearMonth: string): Promise<ActionResult<any>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        // 1. 是否已有結算快照？
        const { data: snapshot } = await supabase
            .from('salary_records')
            .select('*')
            .eq('user_id', employeeId)
            .eq('year_month', yearMonth)
            .single()

        if (snapshot) {
            return {
                isSettled: true,
                record: snapshot
            }
        }

        // 2. 若尚未結算，執行線上實時計算
        const { data: emp, error: userErr } = await supabase
            .from('users')
            .select('*')
            .eq('id', employeeId)
            .single()

        if (userErr || !emp) throw { code: ErrorCodes.NOT_FOUND, message: '找不到員工資料' }

        const startDate = `${yearMonth}-01`
        const [year, month] = yearMonth.split('-').map(Number)
        const lastDay = new Date(year, month, 0).getDate()
        const endDate = `${yearMonth}-${String(lastDay).padStart(2, '0')}`

        const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('user_id', employeeId)
            .gte('work_date', startDate)
            .lte('work_date', endDate)

        const { data: leaves } = await supabase
            .from('leaves')
            .select('*')
            .eq('user_id', employeeId)
            .eq('status', 'approved')
            .gte('start_date', startDate)
            .lte('end_date', endDate)

        const calculation = calculateSalary({
            userId: employeeId,
            salaryType: emp.salary_type as any,
            baseSalary: emp.salary_type === 'monthly' ? (Number(emp.salary_amount) || 0) : 0,
            hourlyRate: emp.salary_type === 'hourly' ? (Number(emp.salary_amount) || 0) : 0,
            attendanceRecords: attendance || [],
            leaveRecords: leaves || [],
            bonuses: 0,   // TODO: 從 bonus 資料表或傳參取
            deductions: 0
        })

        return {
            isSettled: false,
            preview: calculation,
            employee: emp
        }
    })
}

const SettleSalarySchema = z.object({
    employeeId: z.string().uuid(),
    yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
    bonuses: z.number().nonnegative().optional().default(0),
    deductions: z.number().nonnegative().optional().default(0),
    note: z.string().optional()
})

/**
 * 執行結算並產生 Snapshot
 */
export async function settleSalary(formData: FormData): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const payload = {
            employeeId: formData.get('employeeId'),
            yearMonth: formData.get('yearMonth'),
            bonuses: Number(formData.get('bonuses')) || 0,
            deductions: Number(formData.get('deductions')) || 0,
            note: formData.get('note') || ''
        }
        const input = SettleSalarySchema.parse(payload)
        const currentUser = await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        // 必須重新即時計算最終結果
        const previewResult = await previewEmployeeSalary(input.employeeId, input.yearMonth)
        if (!previewResult.success) throw new Error(previewResult.error.message);

        if (previewResult.data.isSettled) {
            throw { code: ErrorCodes.BUSINESS_CONFLICT, message: '該月份已結算' }
        }

        const calc = previewResult.data.preview;
        const emp = previewResult.data.employee;

        // 加總自訂獎金扣款
        const finalTotal = calc.basicSalaryAmount + input.bonuses - input.deductions;

        const { error: insertError } = await supabase.from('salary_records').insert({
            user_id: input.employeeId,
            year_month: input.yearMonth,
            basic_salary: calc.basicSalaryAmount,
            bonuses: input.bonuses,
            deductions: input.deductions,
            total_amount: finalTotal,
            is_paid: true, // Assuming settled means available/paid or to be paid
            calculation_snapshot: {
                ...calc,
                customBonuses: input.bonuses,
                customDeductions: input.deductions,
                baseSalaryRate: emp.salary_type === 'monthly' ? emp.salary_amount : 0,
                hourlyWageRate: emp.salary_type === 'hourly' ? emp.salary_amount : 0
            },
            notes: input.note
        })

        if (insertError) throw new Error(insertError.message)

        revalidatePath('/salary')
        revalidatePath('/admin/salary')
    })
}

/**
 * 取消結算 (刪除 snapshot)
 */
export async function cancelSettlement(recordId: number): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        await requireUserRole(['manager', 'super_admin'])
        const supabase = await createClient()

        const { error } = await supabase.from('salary_records').delete().eq('id', recordId)
        if (error) throw new Error(error.message)

        revalidatePath('/salary')
        revalidatePath('/admin/salary')
    })
}
