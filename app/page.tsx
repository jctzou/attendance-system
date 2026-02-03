import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()

  // 獲取目前登入使用者
  const { data: { user } } = await supabase.auth.getUser()

  // 獲取使用者詳細資料 (從 users table)
  // 為了安全與正確顯示，我們應該用 user.id 去查 users table
  // 但目前只有 user.email 是確定的。
  // 這裡我們假設 user 存在 (middleware 已保護)

  let userProfile: any = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()
    userProfile = data
  }

  return (
    <div className="flex-1 w-full flex flex-col gap-20 items-center">
      <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
        <div className="w-full max-w-4xl flex justify-between items-center p-3 text-sm">
          <div className="font-bold text-lg">員工打卡系統</div>
          <div className="flex items-center gap-4">
            {userProfile ? (
              <>
                <span>你好，{userProfile.display_name || user?.email} ({userProfile.employee_id})</span>
                <form action="/auth/signout" method="post">
                  <button className="py-2 px-4 rounded-md no-underline bg-btn-background hover:bg-btn-background-hover">
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

      <div className="flex-1 flex flex-col gap-20 max-w-4xl px-3 w-full animate-in fade-in zoom-in duration-500">
        <div className="flex flex-col gap-6 p-8 rounded-lg bg-gray-50 border shadow-sm">
          <h2 className="text-2xl font-bold mb-4">今日打卡</h2>
          <div className="text-center py-10 text-gray-500">
            (打卡功能即將推出...)
          </div>
        </div>
      </div>
    </div>
  )
}
