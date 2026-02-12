'use client'

import React, { useState } from 'react'
import Header from './Header'
import Sidebar from './Sidebar'
import { Database } from '@/types/supabase'

type UserRow = Database['public']['Tables']['users']['Row']

interface MainLayoutProps {
    children: React.ReactNode
    userProfile: UserRow | null
}

export default function MainLayout({ children, userProfile }: MainLayoutProps) {
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)

    // 如果沒有使用者資料(未登入)，顯示簡化版面或直接渲染children(通常是登入頁)
    if (!userProfile) {
        return <div className="min-h-screen bg-background-light dark:bg-background-dark">{children}</div>
    }

    return (
        <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-800 dark:text-slate-200 transition-colors duration-300 font-display">
            <Sidebar
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
                userProfile={userProfile}
            />

            <Header
                onMenuClick={() => setIsDrawerOpen(true)}
                userProfile={userProfile}
            />

            <main className="md:pl-[280px] transition-all duration-300">
                <div className="max-w-7xl mx-auto p-4 md:p-6 min-h-[calc(100vh-64px)]">
                    {children}
                </div>
                <footer className="pb-6 px-4 w-full text-center">
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-600">
                        © 2026 Enterprise Attendance Management System
                    </p>
                </footer>
            </main>
        </div>
    )
}
