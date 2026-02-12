'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Database } from '@/types/supabase'

type UserRow = Database['public']['Tables']['users']['Row']

interface SidebarProps {
    isOpen: boolean
    onClose: () => void
    userProfile: UserRow | null
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, userProfile }) => {
    const pathname = usePathname()

    const menuItems = [
        { href: '/', label: '打卡', icon: 'schedule' },
        { href: '/attendance', label: '打卡記錄', icon: 'history' },
        { href: '/leaves', label: '請假', icon: 'event_busy' },
        { href: '/salary', label: '我的薪資', icon: 'payments' },
    ]

    // 管理員額外選單
    if (userProfile && ['manager', 'super_admin'].includes(userProfile.role)) {
        menuItems.push(
            { href: '/admin/leaves', label: '審核中心', icon: 'verified' },
            { href: '/admin/salary', label: '薪資管理', icon: 'account_balance_wallet' }
        )
    }

    return (
        <>
            {/* Overlay for mobile */}
            <div
                className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
                    }`}
                onClick={onClose}
            />

            <aside
                className={`fixed top-0 left-0 h-full w-[280px] bg-white dark:bg-slate-900 z-[70] shadow-2xl flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
            >
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <div className="bg-primary/10 p-2 rounded-lg">
                            <span className="material-symbols-outlined text-primary text-2xl">calendar_month</span>
                        </div>
                        <h2 className="text-lg font-bold">選單</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors md:hidden"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {menuItems.map((item) => {
                        const isActive = pathname === item.href
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => onClose()}
                                className={`flex items-center space-x-3 p-4 rounded-xl transition-all ${isActive
                                    ? 'bg-primary/10 text-primary font-bold shadow-sm'
                                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium'
                                    }`}
                            >
                                <span className="material-symbols-outlined">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>

                {userProfile && (
                    <div className="p-6 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300 shadow-inner">
                                {userProfile.display_name?.[0] || 'User'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{userProfile.display_name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{userProfile.email}</p>
                            </div>
                        </div>
                        <form action="/auth/signout" method="post" className="mt-4">
                            <button className="w-full text-xs text-slate-500 hover:text-red-500 flex items-center justify-center gap-1 py-2">
                                <span className="material-symbols-outlined text-sm">logout</span>
                                登出系統
                            </button>
                        </form>
                    </div>
                )}
            </aside>
        </>
    )
}

export default Sidebar
