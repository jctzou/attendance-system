import { createClient } from '@/utils/supabase/server'
import ClockPanel from '@/components/ClockPanel'

export default async function Home() {
  const supabase = await createClient()

  // 獲取目前登入使用者
  const { data: { user } } = await supabase.auth.getUser()

  // 獲取使用者詳細資料 (Role, Settings)
  // 改為正確查詢：用 user.id
  let userProfile: any = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    if (data) userProfile = data
  }

  // 獲取今日打卡紀錄
  let todayRecord = null
  if (user) {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', user.id)
      .eq('work_date', today)
      .single()
    todayRecord = data
  }

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
                <div className="text-right hidden sm:block">
                  <div className="font-bold">{userProfile.display_name}</div>
                  <div className="text-xs text-gray-500">{userProfile.email}</div>
                </div>
                <form action="/auth/signout" method="post">
                  <button className="py-2 px-4 rounded-md text-gray-600 hover:bg-gray-100 text-sm font-medium">
                    登出
                  </button>
                </form>
              </>
            ) : (
              <span>載入中...</span>
            )}
          </div>
        </div>
      </nav>

      <div className="flex-1 flex flex-col gap-10 max-w-4xl px-3 w-full animate-in fade-in zoom-in duration-500 pt-10">

        {userProfile && (
          <div className="flex justify-center">
            <ClockPanel
              userId={user!.id}
              userName={userProfile.display_name}
              userSettings={{
                work_start_time: userProfile.work_start_time || '09:00:00',
                work_end_time: userProfile.work_end_time || '18:00:00'
              }}
              todayRecord={todayRecord}
            />
          </div>
        )}

      </div>
    </div>
  )
}
