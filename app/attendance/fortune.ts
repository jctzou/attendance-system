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

        const date = new Date().toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        })

        const prompt = `
        角色設定：
        你是一位布包品牌 niizo 工作室聘請的命理師，目標是提升員工的運勢與健康。
        任務指令：
        請分析 ${date} 的運勢，請隨機選擇一個依據（天氣、八字命學、紫微斗數、生命靈數、農民曆或西洋占星），結合時事、工作與生活資訊。
        開頭請依據目前時間給予 ${userName || '夥伴'} 問候（如：早安、午安、晚安）。
        內容要求：
        1. 總字數限制在 50 字內。
        2. 包含一句溫暖的提示（說明依據、籤詞）。
        3. 包含一個幸運物或幸運色。
        直接輸出繁體中文，不需要標題。
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
