import { createClient } from './supabase/server';
import { AppError, ErrorCodes, ActionResult } from '@/types/actions';
import { Database } from '@/types/supabase';

type UserProfile = Database['public']['Tables']['users']['Row'];

/**
 * 取得目前使用者的身分與資料庫中的完整 Profile。
 * 統一在 Server Action 中呼叫，用於權限與身份檢查。
 *
 * @returns {Promise<UserProfile>} 如果使用者存在且有效，回傳 Profile。
 * @throws {Error} 若未登入或找不到資料，拋出錯誤。後續由 `withErrorHandling` 捕捉並回傳標準格式。
 */
export async function requireUserProfile(): Promise<UserProfile> {
    const supabase = await createClient();

    // 取得當前 Session 使用者
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        throw { code: ErrorCodes.UNAUTHORIZED, message: '請先登入或您的登入已過期' } as AppError;
    }

    // 取得 Users Profile
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        throw { code: ErrorCodes.NOT_FOUND, message: '找不到使用者個人資料' } as AppError;
    }

    if (!profile.is_active) {
        throw { code: ErrorCodes.FORBIDDEN, message: '您的帳號目前尚未啟用或已被停權' } as AppError;
    }

    return profile;
}

/**
 * 檢查使用者是否具備特定的角色權限。
 *
 * @param allowedRoles 允許的角色陣列
 */
export async function requireUserRole(allowedRoles: UserProfile['role'][]): Promise<UserProfile> {
    const profile = await requireUserProfile();

    if (!allowedRoles.includes(profile.role)) {
        throw { code: ErrorCodes.FORBIDDEN, message: '您目前的權限無法執行此操作' } as AppError;
    }

    return profile;
}

/**
 * 高階函式 Wrapper，用於統一捕捉 Server Action 中的錯誤並回傳標準的 `ActionResult` 格式。
 *
 * @param action 實際的非同步業務邏輯函式
 * @returns {Promise<ActionResult<T>>}
 */
export async function withErrorHandling<T>(
    action: () => Promise<T>
): Promise<ActionResult<T>> {
    try {
        const data = await action();
        // action 成功執行，包裝為 success: true 格式
        return { success: true, data };
    } catch (err: any) {
        console.error('Action Failed:', err);

        // 如果是拋出的已知 AppError 結構
        if (err && typeof err === 'object' && 'code' in err && 'message' in err) {
            return {
                success: false,
                error: err as AppError
            };
        }

        // Zod Validation Error (這裡也可以特別處理)
        if (err?.name === 'ZodError') {
            return {
                success: false,
                error: {
                    code: ErrorCodes.VALIDATION_FAILED,
                    message: '輸入資料驗證失敗，請檢查您的表單內容。',
                    details: err.issues
                }
            };
        }

        // 一般未知 Error
        return {
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: err.message || '發生未知的系統錯誤，請稍後再試。',
            }
        };
    }
}
