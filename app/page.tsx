import { createClient } from '@/utils/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import { Database } from '@/types/supabase'
import { SupabaseClient } from '@supabase/supabase-js'
import ModernClockPanel from '@/components/ModernClockPanel'
import { getCurrentWorkingEmployees } from '@/app/attendance/actions'
import WorkingEmployeesList from '@/components/WorkingEmployeesList'

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
    const userProfilePromise = supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    // 使用台北時區的日期
    const now = new Date()
    const today = now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Taipei' }) // YYYY-MM-DD
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

  // 取得今日打卡上班中員工
  const workingRes = await getCurrentWorkingEmployees()
  const workingEmployees = workingRes.success ? workingRes.data : []

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] py-4 md:py-8">
      <div className="w-full max-w-[480px] flex flex-col gap-[11px] md:gap-[22px] px-2 md:px-4">
        {userProfile && user ? (
          <ModernClockPanel
            userId={user.id}
            userName={userProfile.display_name}
            salaryType={userProfile.salary_type}
            userSettings={{
              work_start_time: userProfile.work_start_time || '09:00:00',
              work_end_time: userProfile.work_end_time || '18:00:00',
              break_hours: userProfile.break_hours
            }}
            todayRecord={todayRecord}
          />
        ) : (
          <div className="text-center text-slate-500 bg-white dark:bg-neutral-800 p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-neutral-700">
            {user ? '找不到使用者資料' : '請先登入系統'}
          </div>
        )}

        {/* 即時上下班員工 Avatar 列 (Client Component) */}
        <WorkingEmployeesList initialEmployees={workingEmployees} />
      </div>
    </div>
  )
}

