'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/utils/supabase/client'
import { getCurrentWorkingEmployees } from '@/app/attendance/actions'
import { motion, AnimatePresence } from 'framer-motion'

export type WorkingEmployee = {
    user: {
        id: string
        display_name: string
        avatar_url: string | null
    }
}

interface Props {
    initialEmployees: WorkingEmployee[]
}

export default function WorkingEmployeesList({ initialEmployees }: Props) {
    const [workingEmployees, setWorkingEmployees] = useState<WorkingEmployee[]>(initialEmployees)
    const supabase = createClient()
    const router = useRouter()

    const fetchLatestEmployees = async () => {
        try {
            const res = await getCurrentWorkingEmployees()
            if (res.success && res.data) {
                setWorkingEmployees(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch latest working employees:', error)
        }
    }

    // 當父元件透過 server-side rendering 傳入新的名單時，同步更新 local state
    useEffect(() => {
        setWorkingEmployees(initialEmployees)
    }, [initialEmployees])

    useEffect(() => {
        // 設定 Supabase 即時訂閱 (Realtime)
        // 改為監聽由 Server Action (`createAdminClient` 或一般 `supabase`) 主動發送的不受 RLS 限制的 Broadcast
        const channel = supabase
            .channel('public:attendance_sync')
            .on(
                'broadcast',
                { event: 'sync' },
                (payload) => {
                    console.log('Realtime broadcast received! Action:', payload.payload?.action)
                    // 收到任何變更，重新向伺服器拉取最新的上班中名單
                    // 同時呼叫 router.refresh() 強制清除 Next.js Server Component 快取
                    fetchLatestEmployees()
                    router.refresh()
                }
            )
            .subscribe((status) => {
                console.log('Supabase Realtime Status:', status)
            })

        // Cleanup: 元件卸載時解除訂閱
        return () => {
            supabase.removeChannel(channel)
        }
    }, [supabase, router])

    if (workingEmployees.length === 0) {
        return null
    }

    return (
        <div className="flex flex-col items-center gap-3 mt-4">
            <p className="text-xs font-bold text-slate-400 dark:text-neutral-500 tracking-wider">
                目前正在上班中 ({workingEmployees.length})
            </p>
            <div className="flex flex-wrap justify-center items-center px-4">
                <AnimatePresence>
                    {workingEmployees.map((record, idx) => (
                        <motion.div
                            key={record.user.id}
                            layout
                            initial={{ opacity: 0, scale: 0.5, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{
                                opacity: 0,
                                scale: 0.5,
                                y: -40,
                                transition: { duration: 0.8, ease: "easeInOut" }
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 25,
                                mass: 0.8
                            }}
                            className={`relative group ${idx > 0 ? '-ml-3' : ''} transition-transform hover:-translate-y-1 hover:z-10 z-0`}
                        >
                            {/* Tooltip 姓名提示 (懸停或按壓時浮現) */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-lg z-20">
                                {record.user.display_name}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-tx-4 border-solid border-transparent border-t-slate-800"></div>
                            </div>

                            {record.user.avatar_url ? (
                                <img
                                    src={record.user.avatar_url}
                                    alt={record.user.display_name}
                                    className="w-12 h-12 rounded-full object-cover border-2 border-[var(--color-bg)] dark:border-[var(--color-bg)] shadow-sm bg-slate-100 dark:bg-neutral-800 cursor-pointer"
                                />
                            ) : (
                                <div className="w-12 h-12 rounded-full border-2 border-[var(--color-bg)] dark:border-[var(--color-bg)] shadow-sm bg-gradient-to-br from-[var(--color-primary)] to-orange-400 flex items-center justify-center text-white text-base font-bold cursor-pointer">
                                    {record.user.display_name.charAt(0)}
                                </div>
                            )}
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </div>
    )
}
