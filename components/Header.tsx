'use client'

import React from 'react'
import { Database } from '@/types/supabase'
import NotificationBell from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'

type UserRow = Database['public']['Tables']['users']['Row']

interface HeaderProps {
    onMenuClick: () => void
    userProfile: UserRow | null
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, userProfile }) => {
    return (
        <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 md:pl-[280px] transition-all duration-300">
            <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <button
                        onClick={onMenuClick}
                        className="p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <div className="flex items-center space-x-2">
                        <div className="bg-primary/10 p-1.5 rounded-lg hidden sm:block">
                            <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
                        </div>
                        <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
                            niizo上工啦
                        </h1>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    <ThemeToggle />
                    <NotificationBell />

                    {userProfile && (
                        <div className="flex items-center border-l border-slate-200 dark:border-slate-700 ml-2 pl-2">
                            <button className="p-0.5 rounded-full overflow-hidden border-2 border-slate-100 dark:border-slate-800 hover:border-primary transition-colors">
                                <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold">
                                    {userProfile.display_name?.[0] || 'U'}
                                </div>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    )
}

export default Header
