'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const profileSchema = z.object({
    displayName: z.string().min(2, "名稱至少 2 個字").max(50, "名稱太長"),
})

const passwordSchema = z.object({
    password: z.string().min(6, "密碼至少 6 碼"),
})

/**
 * 更新個人基本資料
 */
export async function updateProfile(prevState: any, formData: FormData) {
    const displayName = formData.get('displayName') as string

    // Validate
    const result = profileSchema.safeParse({ displayName })
    if (!result.success) {
        return { error: result.error.issues[0].message }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Update
    // @ts-ignore
    const { error } = await (supabase.from('users') as any)
        .update({ display_name: displayName })
        .eq('id', user.id)

    if (error) return { error: error.message }

    revalidatePath('/account')
    revalidatePath('/') // 刷新全站 Header
    return { success: true, message: '資料更新成功' }
}

/**
 * 更新個人頭像
 */
export async function updateAvatar(prevState: any, formData: FormData) {
    const file = formData.get('avatar') as File

    if (!file || file.size === 0) {
        return { error: '請選擇圖片' }
    }

    if (file.size > 2 * 1024 * 1024) { // 2MB
        return { error: '圖片大小不能超過 2MB' }
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return { error: 'Unauthorized' }

    // Get old avatar url before update to delete later
    // @ts-ignore
    const { data: oldProfile } = await (supabase.from('users') as any)
        .select('avatar_url')
        .eq('id', user.id)
        .single()

    // Upload to Storage
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `${fileName}`

    const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file)

    if (uploadError) {
        console.error('Upload Error:', uploadError)
        return { error: `圖片上傳失敗: ${uploadError.message}` }
    }

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath)

    // Add timestamp to bust cache
    const finalUrl = `${publicUrl}?t=${Date.now()}`

    // Update User Profile
    // @ts-ignore
    const { error: updateError, count } = await (supabase.from('users') as any)
        .update({ avatar_url: finalUrl }, { count: 'exact' })
        .eq('id', user.id)
        .select()

    if (updateError) {
        console.error('[updateAvatar] Update Error:', updateError)
        return { error: updateError.message }
    }

    if (count === 0) {
        console.error('[updateAvatar] No rows updated. Likely RLS issue.')
        return { error: '更新失敗：無法寫入資料庫 (RLS)' }
    }

    console.log('[updateAvatar] Update Success:', finalUrl)

    // Delete old avatar if exists
    if (oldProfile?.avatar_url) {
        try {
            const oldUrl = oldProfile.avatar_url.split('?')[0] // Remove cache busting query
            const oldPath = oldUrl.split('/avatars/').pop() // Extract path after bucket name

            if (oldPath && oldPath !== 'null') { // check for string 'null' just in case
                const { error: removeError } = await supabase.storage
                    .from('avatars')
                    .remove([oldPath])

                if (removeError) {
                    console.error('Failed to remove old avatar:', removeError)
                } else {
                    console.log('Old avatar removed:', oldPath)
                }
            }
        } catch (e) {
            console.error('Error parsing old avatar URL:', e)
        }
    }

    revalidatePath('/account')
    revalidatePath('/')
    return { success: true, message: '頭像更新成功', avatarUrl: finalUrl }
}

/**
 * 重設密碼
 */
export async function updatePassword(prevState: any, formData: FormData) {
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string

    if (password !== confirmPassword) {
        return { error: '兩次密碼輸入不一致' }
    }

    const result = passwordSchema.safeParse({ password })
    if (!result.success) {
        return { error: result.error.issues[0].message }
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.updateUser({
        password: password
    })

    if (error) return { error: error.message }

    return { success: true, message: '密碼修改成功' }
}
