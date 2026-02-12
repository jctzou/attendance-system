'use client'

import { useEffect, useState } from 'react'
import { getUnreadCount, getMyNotifications, markAsRead, markAllAsRead } from '@/app/notifications/actions'
import { useRouter } from 'next/navigation'

export default function NotificationBell() {
    const router = useRouter()
    const [unreadCount, setUnreadCount] = useState(0)
    const [notifications, setNotifications] = useState<any[]>([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)

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
        fetchUnreadCount()
        // Poll every 30 seconds
        const interval = setInterval(fetchUnreadCount, 30000)
        return () => clearInterval(interval)
    }, [])

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
            window.location.href = notification.link
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
        <div className="relative">
            <button
                onClick={handleToggle}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border z-20 max-h-96 overflow-hidden flex flex-col">
                        <div className="px-4 py-3 border-b bg-gray-50">
                            <h3 className="font-bold text-gray-900">通知</h3>
                        </div>

                        <div className="overflow-y-auto flex-1">
                            {loading ? (
                                <div className="p-4 text-center text-gray-500">載入中...</div>
                            ) : notifications.length === 0 ? (
                                <div className="p-4 text-center text-gray-500">沒有通知</div>
                            ) : (
                                notifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        onClick={() => handleNotificationClick(notif)}
                                        className={`px-4 py-3 border-b hover:bg-gray-50 cursor-pointer transition-colors ${!notif.is_read ? 'bg-blue-50' : ''
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <span className="text-2xl">{getNotificationIcon(notif.type)}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium text-gray-900 ${!notif.is_read ? 'font-bold' : ''}`}>
                                                    {notif.title}
                                                </p>
                                                {notif.message && (
                                                    <p className="text-sm text-gray-600 mt-1">{notif.message}</p>
                                                )}
                                                <p className="text-xs text-gray-400 mt-1">
                                                    {new Date(notif.created_at).toLocaleString('zh-TW')}
                                                </p>
                                            </div>
                                            {!notif.is_read && (
                                                <span className="w-2 h-2 bg-blue-600 rounded-full mt-1"></span>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* 清除所有通知按鈕 */}
                        {notifications.length > 0 && (
                            <div className="border-t bg-gray-50 p-3">
                                <button
                                    onClick={async () => {
                                        await markAllAsRead()
                                        await fetchNotifications()
                                        await fetchUnreadCount()
                                    }}
                                    className="w-full px-4 py-2 text-sm text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors font-medium"
                                >
                                    清除所有通知
                                </button>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}
