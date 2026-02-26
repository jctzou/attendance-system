'use client'

import { useEffect, useState, useRef } from 'react'
import { getUnreadCount, getMyNotifications, markAsRead, markAllAsRead, deleteAllNotifications } from '@/app/notifications/actions'
import { useRouter } from 'next/navigation'
import { AlertDialog } from './ui/ActionDialogs'

export default function NotificationBell() {
    const router = useRouter()
    const [unreadCount, setUnreadCount] = useState(0)
    const [notifications, setNotifications] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isMounted, setIsMounted] = useState(false)
    const [alertMessage, setAlertMessage] = useState<string>('')

    // Add reference for outside click detection
    const dropdownRef = useRef<HTMLDivElement>(null)

    const fetchUnreadCount = async () => {
        const res = await getUnreadCount()
        setUnreadCount(res.count || 0)
    }

    const fetchNotifications = async () => {
        setLoading(true)
        const res = await getMyNotifications()
        if (res.data) {
            setNotifications(res.data)
        }
        setLoading(false)
    }

    useEffect(() => {
        setIsMounted(true)
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchUnreadCount()
        // Poll every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000)
        return () => clearInterval(interval)
    }, [])

    // Outside click listener
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    const handleToggle = () => {
        if (!isOpen) {
            fetchNotifications()
        }
        setIsOpen(!isOpen)
    }

    const handleNotificationClick = async (notification: any) => {
        // 先標記為已讀並等待完成
        if (!notification.is_read) {
            await markAsRead(notification.id)
            // 稍微延遲確保資料庫更新完成
            await new Promise(resolve => setTimeout(resolve, 200))
        }

        setIsOpen(false)

        // 使用 window.location 強制完整頁面重新載入
        // 避免 Client Component 快取問題
        if (notification.link) {
            window.location.assign(notification.link)
        }
    }

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'leave_approved': return '✅'
            case 'leave_rejected': return '❌'
            case 'new_leave_request': return '📋'
            default: return '🔔'
        }
    }

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={handleToggle}
                className="relative p-2 text-slate-500 hover:text-slate-800 dark:text-neutral-400 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-800 rounded-full transition-colors focus:outline-none"
            >
                <span className="material-symbols-outlined text-[24px]">notifications</span>
                {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex items-center justify-center min-w-[18px] h-[18px] text-[10px] font-bold text-white transform translate-x-1/4 -translate-y-1/4 bg-red-600 border-2 border-white dark:border-background-dark rounded-full shadow-sm">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-neutral-700 z-50 max-h-[85vh] flex flex-col transform origin-top-right transition-all animate-in fade-in zoom-in-95 duration-200">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-neutral-700/80 bg-slate-50/50 dark:bg-neutral-800/50 flex justify-between items-center rounded-t-2xl">
                        <h3 className="font-bold text-slate-900 dark:text-neutral-100 flex items-center gap-2">
                            系統通知
                            {unreadCount > 0 && (
                                <span className="bg-primary/10 text-primary dark:bg-primary/20 text-xs px-2 py-0.5 rounded-full font-semibold">
                                    {unreadCount} 未讀
                                </span>
                            )}
                        </h3>
                    </div>

                    <div className="overflow-y-auto flex-1 overscroll-contain">
                        {loading ? (
                            <div className="p-10 text-center text-slate-500 dark:text-neutral-400 flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-3xl opacity-50">progress_activity</span>
                                <span className="text-sm">稍候片刻...</span>
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-10 text-center text-slate-500 dark:text-neutral-400 flex flex-col items-center gap-3">
                                <div className="w-16 h-16 bg-slate-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-1">
                                    <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-neutral-600">notifications_off</span>
                                </div>
                                <span className="font-medium">目前沒有任何通知</span>
                            </div>
                        ) : (
                            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`group px-5 py-4 cursor-pointer transition-all duration-200 hover:bg-slate-50 dark:hover:bg-neutral-700/50 ${!notif.is_read
                                            ? 'bg-blue-50/30 dark:bg-blue-900/10'
                                            : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-4">
                                            <div className="text-2xl mt-0.5 drop-shadow-sm group-hover:scale-110 transition-transform">{getNotificationIcon(notif.type)}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <p className={`text-sm pr-2 ${!notif.is_read ? 'font-bold text-slate-900 dark:text-neutral-50' : 'font-medium text-slate-700 dark:text-neutral-300'}`}>
                                                        {notif.title}
                                                    </p>
                                                    {!notif.is_read && (
                                                        <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0 shadow-sm shadow-primary/30"></span>
                                                    )}
                                                </div>
                                                {notif.message && (
                                                    <p className={`text-sm mt-0.5 line-clamp-2 ${!notif.is_read ? 'text-slate-700 dark:text-neutral-300' : 'text-slate-500 dark:text-neutral-400'}`}>
                                                        {notif.message}
                                                    </p>
                                                )}
                                                <p className="text-xs text-slate-400 dark:text-neutral-500 mt-2 font-mono flex items-center gap-1">
                                                    <span className="material-symbols-outlined text-[12px]">schedule</span>
                                                    {isMounted ? new Date(notif.created_at).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* 清除所有通知按鈕 */}
                    {notifications.length > 0 && (
                        <div className="border-t border-slate-100 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 rounded-b-2xl">
                            <button
                                onClick={async () => {
                                    try {
                                        const res = await deleteAllNotifications();
                                        if (res.error) {
                                            setAlertMessage("清除通知失敗: " + res.error);
                                            return;
                                        }
                                        // Optimistic UI (直接前端清空畫面)
                                        setNotifications([]);
                                        setUnreadCount(0);
                                        setIsOpen(false);
                                    } catch (err: any) {
                                        console.error('Exception during clear:', err);
                                        setAlertMessage("系統發生錯誤: " + (err.message || ''));
                                    }
                                }}
                                className="w-full px-4 py-2.5 text-sm text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 hover:bg-slate-100 dark:hover:bg-neutral-700 rounded-xl transition-all font-medium flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[18px]">clear_all</span>
                                全部清除
                            </button>
                        </div>
                    )}
                </div>
            )}

            <AlertDialog
                isOpen={alertMessage !== ''}
                title="通知清理發生錯誤"
                message={alertMessage}
                onConfirm={() => setAlertMessage('')}
            />
        </div>
    )
}
