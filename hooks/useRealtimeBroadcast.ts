'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'

/**
 * 共用即時廣播 Hooks (Supabase Realtime Broadcast)
 */
export function useRealtimeBroadcast(
    channelName: string,
    eventName: string,
    onReceive: (payload: any) => void,
    enabled: boolean = true
) {
    // 使用 Ref 記住最新的 callback，避免此 Hook 因為父元件 render 而重新訂閱
    const callbackRef = useRef(onReceive)
    callbackRef.current = onReceive

    useEffect(() => {
        if (!enabled) return;

        const supabase = createClient()

        const channel = supabase
            .channel(channelName)
            .on(
                'broadcast',
                { event: eventName },
                (payload) => {
                    callbackRef.current(payload.payload)
                }
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [channelName, eventName, enabled]) // 移除 onReceive 依賴，改用 Ref
}
