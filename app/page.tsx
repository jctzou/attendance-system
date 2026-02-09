import { createClient } from '@/utils/supabase/server'
import ClockPanel from '@/components/ClockPanel'
import { Database } from '@/types/supabase'
import { SupabaseClient } from '@supabase/supabase-js'

type UserRow = Database['public']['Tables']['users']['Row']
type AttendanceRow = Database['public']['Tables']['attendance']['Row']

export default async function Home() {
  const supabase: SupabaseClient<Database> = await createClient()

  // 獲取目前登入使用者
  const { data: { user } } = await supabase.auth.getUser()

  let userProfile: UserRow | null = null
  let todayRecord: AttendanceRow | null = null

  if (user) {
    // 獲取使用者詳細資料
    // We use Promise.all to fetch distinct data in parallel for performance
    const userProfilePromise = supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    const today = new Date().toISOString().split('T')[0]
    const todayRecordPromise = supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('work_date', today)
      .single()

    const [userProfileRes, todayRecordRes] = await Promise.all([
      userProfilePromise,
      todayRecordPromise
    ]) as any

    if (userProfileRes.data) userProfile = userProfileRes.data
    if (todayRecordRes.data) todayRecord = todayRecordRes.data
  }

  // Handle case where user is logged in auth but has no profile (edge case)
  // If user is not logged in, userProfile is null.

  return (
    <div className="flex-1 w-full flex flex-col gap-20 items-center bg-gray-50 min-h-screen">
      <nav className="w-full flex justify-center bg-white border-b border-gray-200 h-16 shadow-sm">
        <div className="w-full max-w-4xl flex justify-between items-center p-3 text-sm">
          <div className="font-bold text-lg text-blue-600 flex items-center gap-2">
            <span>📅</span> 員工打卡系統
          </div>
          <div className="flex items-center gap-4">
            {userProfile ? (
              <>
                <div className="hidden sm:flex items-center gap-4 mr-4">
                  <a href="/attendance" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                    打卡記錄
                  </a>
                  <a href="/leaves" className="text-gray-600 hover:text-blue-600 font-medium transition-colors">
                    請假管理
                  </a>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="font-bold">{userProfile.display_name}</div>
                  <div className="text-xs text-gray-500">{userProfile.email}</div>
                </div>
                <form action="/auth/signout" method="post">
                  <button className="py-2 px-4 rounded-md text-gray-600 hover:bg-gray-100 text-sm font-medium btn-pointer">
                    登出
                  </button>
                </form>
              </>
            ) : (
              <span>...</span>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col gap-10 max-w-4xl px-3 w-full animate-in fade-in zoom-in duration-500 pt-10">
        {userProfile && user ? (
          <div className="flex flex-col items-center gap-6">
            <ClockPanel
              userId={user.id}
              userName={userProfile.display_name}
              userSettings={{
                work_start_time: userProfile.work_start_time,
                work_end_time: userProfile.work_end_time
              }}
              todayRecord={todayRecord}
            />

            <div className="flex gap-6 text-sm font-medium">
              <a
                href="/attendance"
                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                📋 打卡與修改記錄 &rarr;
              </a>
              <a
                href="/leaves"
                className="text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
              >
                🏖️ 請假管理 &rarr;
              </a>
            </div>

            {userProfile.role === 'manager' || userProfile.role === 'super_admin' ? (
              <div className="mt-4 pt-6 border-t w-full flex justify-center">
                <Link
                  href="/admin/leaves"
                  className="px-6 py-3 bg-gray-800 text-white rounded-lg hover:bg-black font-bold shadow-md transition-all flex items-center gap-2"
                >
                  👮‍♂️ 管理員審核中心
                </Link>
              </div>
            ) : null}
          </div>
        ) : (
          /* Show nothing or loading state if checked session but no profile */
          <div className="text-center text-gray-500 mt-10">
            {user ? '找不到使用者資料' : '請先登入'}
          </div>
        )}
      </div>
    </div>
  )
}
