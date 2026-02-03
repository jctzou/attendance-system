import { createClient } from '@/utils/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: users, error } = await supabase.from('users').select('*')
  const userList = users as any[] | null

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm lg:flex">
        <h1 className="text-4xl font-bold mb-8">員工打卡系統 - 連線測試</h1>

        <div className="w-full p-6 bg-white rounded-lg shadow-md text-slate-800">
          <h2 className="text-2xl font-bold mb-4">資料庫連線狀態</h2>

          {error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded">
              ❌ 連線失敗: {error.message}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-green-100 text-green-700 rounded">
                ✅ 連線成功！
              </div>

              <h3 className="text-xl font-bold mt-4">用戶列表 ({userList?.length || 0})</h3>
              <ul className="list-disc pl-5">
                {userList?.map((user) => (
                  <li key={user.id}>
                    {user.name} ({user.employee_id}) - {user.role}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
