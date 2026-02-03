import { login } from './actions'

export default function LoginPage({
    searchParams,
}: {
    searchParams: { message: string }
}) {
    return (
        <div className="flex-1 flex flex-col w-full px-8 sm:max-w-md justify-center gap-2 mx-auto min-h-screen">
            <form className="animate-in flex-1 flex flex-col w-full justify-center gap-2 text-foreground">
                <h1 className="text-2xl mb-4 text-center font-bold">員工系統登入</h1>

                <label className="text-md" htmlFor="email">
                    Email 請輸入員工信箱
                </label>
                <input
                    className="rounded-md px-4 py-2 bg-inherit border mb-6"
                    name="email"
                    placeholder="you@example.com"
                    required
                />

                <label className="text-md" htmlFor="password">
                    密碼
                </label>
                <input
                    className="rounded-md px-4 py-2 bg-inherit border mb-6"
                    type="password"
                    name="password"
                    placeholder="••••••••"
                    required
                />

                <button
                    formAction={login}
                    className="bg-green-700 rounded-md px-4 py-2 text-white mb-2 font-bold hover:bg-green-600 transition-colors"
                >
                    登入
                </button>

                {searchParams?.message && (
                    <p className="mt-4 p-4 bg-red-100 text-red-900 border border-red-200 text-center rounded-md">
                        {searchParams.message}
                    </p>
                )}
            </form>

            <div className="text-center text-sm text-gray-500 mt-4">
                <p>測試帳號: wang@example.com</p>
                <p>測試密碼: 123456</p>
            </div>
        </div>
    )
}
