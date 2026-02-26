'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { ActionResult, ErrorCodes } from '@/types/actions'
import { requireUserProfile, withErrorHandling } from '@/utils/actions_common'

const profileSchema = z.object({
    displayName: z.string().min(2, "名稱至少 2 個字").max(50, "名稱太長"),
})

const passwordSchema = z.object({
    password: z.string().min(6, "密碼至少 6 碼"),
    confirmPassword: z.string().min(6, "密碼至少 6 碼"),
}).refine(data => data.password === data.confirmPassword, {
    message: "兩次密碼輸入不一致",
    path: ["confirmPassword"],
})

/**
 * 更新個人基本資料
 */
export async function updateProfile(formData: FormData): Promise<ActionResult<string>> {
    return withErrorHandling(async () => {
        const displayName = formData.get('displayName') as string
        const validated = profileSchema.parse({ displayName })

        const profile = await requireUserProfile()
        const supabase = await createClient()

        const { error } = await supabase.from('users')
            .update({ display_name: validated.displayName })
            .eq('id', profile.id)

        if (error) throw new Error(error.message)

        revalidatePath('/account')
        revalidatePath('/')
        return '資料更新成功'
    })
}

/**
 * 更新個人頭像
 */
export async function updateAvatar(formData: FormData): Promise<ActionResult<string>> {
    return withErrorHandling(async () => {
        const file = formData.get('avatar') as File

        if (!file || file.size === 0) {
            throw { code: ErrorCodes.VALIDATION_FAILED, message: '請選擇圖片' }
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB
            throw { code: ErrorCodes.VALIDATION_FAILED, message: '圖片大小不能超過 2MB' }
        }

        const profile = await requireUserProfile()
        const supabase = await createClient()

        // Upload to Storage
        const fileExt = file.name.split('.').pop()
        const fileName = `${profile.id}-${Date.now()}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file)

        if (uploadError) {
            throw new Error(`圖片上傳失敗: ${uploadError.message}`)
        }

        // Get Public URL
        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath)

        // Add timestamp to bust cache
        const finalUrl = `${publicUrl}?t=${Date.now()}`

        // Update User Profile
        const { error: updateError, count } = await supabase.from('users')
            .update({ avatar_url: finalUrl }, { count: 'exact' })
            .eq('id', profile.id)

        if (updateError || count === 0) {
            throw new Error(updateError?.message || '更新失敗：無法寫入資料庫 (RLS)')
        }

        // Delete old avatar if exists
        if (profile.avatar_url) {
            try {
                const oldUrl = profile.avatar_url.split('?')[0] // Remove cache busting query
                const oldPath = oldUrl.split('/avatars/').pop()

                if (oldPath && oldPath !== 'null') {
                    await supabase.storage.from('avatars').remove([oldPath])
                }
            } catch (e) {
                console.error('Error parsing old avatar URL:', e)
            }
        }

        revalidatePath('/account')
        revalidatePath('/')
        return finalUrl
    })
}

/**
 * 重設密碼
 */
export async function updatePassword(formData: FormData): Promise<ActionResult<string>> {
    return withErrorHandling(async () => {
        const password = formData.get('password') as string
        const confirmPassword = formData.get('confirmPassword') as string

        const validated = passwordSchema.parse({ password, confirmPassword })

        await requireUserProfile() // 確保已登入
        const supabase = await createClient()

        const { error } = await supabase.auth.updateUser({
            password: validated.password
        })

        if (error) throw new Error(error.message)

        return '密碼修改成功'
    })
}
