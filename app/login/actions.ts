'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'
import { z } from 'zod'
import { ActionResult, AppError, ErrorCodes } from '@/types/actions'
import { withErrorHandling } from '@/utils/actions_common'

const LoginSchema = z.object({
    email: z.string().email('請輸入有效的電子郵件格式'),
    password: z.string().min(1, '密碼不能為空'),
})

export async function login(email: string, password: string): Promise<ActionResult<void>> {
    return withErrorHandling(async () => {
        const data = LoginSchema.parse({ email, password })

        const supabase = await createClient()

        const { error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
        })

        if (error) {
            throw { code: ErrorCodes.UNAUTHORIZED, message: '帳號或密碼錯誤，請重試' } as AppError
        }

        revalidatePath('/', 'layout')
    })
}
