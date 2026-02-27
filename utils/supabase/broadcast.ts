import { createClient } from '@/utils/supabase/server'

/**
 * 於伺服器端 (Server Action) 穩當地發送 Supabase Broadcast。
 *
 * 【問題背景】
 * 在 Serverless 環境（如 Next.js Server Actions）下，呼叫 supabase.channel().send()
 * 時，底層的 WebSocket 常常還未連線完成，原本的程式碼就已經繼續往下走並結束行程了，
 * 導致訊息被丟棄或無法成功送出。
 *
 * 【解決方案】
 * 此工具函式會封裝一個 Promise，明確訂閱（subscribe）頻道，並等待狀態成為
 * 'SUBSCRIBED' 後，才真正調用 send()。最後清理連線資源。給予最高 2 秒逾時彈性。
 */
export async function sendServerBroadcast(channelName: string, eventName: string, payload: any): Promise<boolean> {
    const supabase = await createClient()
    const channel = supabase.channel(channelName)

    return new Promise((resolve) => {
        let isResolved = false

        // Timeout 防護網 (避免卡死 Server Action)
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true
                console.warn(`[ServerBroadcast] Timeout connecting to ${channelName}`)
                supabase.removeChannel(channel)
                resolve(false)
            }
        }, 2000)

        // 等待 Socket 確實連上
        channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                try {
                    await channel.send({
                        type: 'broadcast',
                        event: eventName,
                        payload: payload
                    })
                } catch (e) {
                    console.error('[ServerBroadcast] Send error:', e)
                } finally {
                    if (!isResolved) {
                        isResolved = true
                        clearTimeout(timeout)
                        supabase.removeChannel(channel)
                        resolve(true)
                    }
                }
            } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
                if (!isResolved) {
                    isResolved = true
                    clearTimeout(timeout)
                    supabase.removeChannel(channel)
                    resolve(false)
                }
            }
        })
    })
}
