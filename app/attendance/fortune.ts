'use server'

import OpenAI from 'openai'

/**
 * 取得今日運勢 AI 回覆
 * 使用 OpenAI GPT-4o-mini 模型
 */
export async function getDailyFortune(userName: string | null) {
    const apiKey = process.env.niizo_staff_ai_key
    if (!apiKey) {
        console.error('[Fortune] API Key is missing. Please set niizo_staff_ai_key in environment variables.')
        return '今天也是充滿希望的一天，加油！'
    }

    try {
        const openai = new OpenAI({
            apiKey: apiKey,
        })

        const now = new Date()
        const taipeiTime = new Intl.DateTimeFormat('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Taipei'
        }).format(now)

        const prompt = `
        角色設定：
        你是一位布包品牌 niizo 工作室聘請的命理師，目標是提升員工的運勢與健康。
        任務指令：
        現在日期是 ${taipeiTime.split(' ')[0]}。請分析今日運勢，請隨機選擇一個依據（天氣、八字命學、紫微斗數、生命靈數、農民曆或西洋占星），結合時事、工作與生活資訊。
        提示：
        1. 開頭請直接點名「${userName || '夥伴'}」。
        2. 總字數嚴格限制在 50 字內。
        3. 內容包含一句的運勢提示（說明依據、籤詞）。
        直接輸出繁體中文。
        `

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: '你是一位專業且幽默的命理師，專門為 niizo 工作室的員工提供每日運勢。' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 150,
            temperature: 0.8,
        })

        const text = response.choices[0].message.content?.trim() || '今天也是充滿希望的一天，加油！'
        return text
    } catch (error: any) {
        console.error('[Fortune] OpenAI API Error:', error.message)
        return '今天也是充滿希望的一天，加油！'
    }
}
