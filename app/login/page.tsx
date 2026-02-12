'use client'

import { useState, useTransition } from 'react'
import { login } from './actions'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [isPending, startTransition] = useTransition()

    const handleLogin = async () => {
        setError('')
        if (!email || !password) {
            setError('請輸入 Email 與密碼')
            return
        }

        startTransition(async () => {
            const res = await login(email, password)
            if (res?.error) {
                setError(res.error)
            }
        })
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleLogin()
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
            <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-slate-200 dark:border-slate-800 p-8 sm:p-10">

                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2">
                        員工系統登入
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        請輸入您的員工帳號以繼續
                    </p>
                </div>

                <div className="space-y-5">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            Email
                        </label>
                        <input
                            className="w-full rounded-lg px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="user@example.com"
                            type="email"
                            disabled={isPending}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            密碼
                        </label>
                        <input
                            className="w-full rounded-lg px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="••••••••"
                            disabled={isPending}
                        />
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-sm text-red-600 dark:text-red-400 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0Z" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleLogin}
                        disabled={isPending}
                        className="w-full bg-primary hover:bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {isPending ? (
                            <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            '登入系統'
                        )}
                    </button>
                </div>


            </div>
        </div>
    )
}
