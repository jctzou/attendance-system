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
        角色設定：你是一位 niizo 工作室的生活導師，語氣成熟智慧。
        任務指令：今天是 ${taipeiTime}。請為「${userName || '夥伴'}」準備一段話。

        內容架構須包含兩部分（合併輸出，不顯示標籤）：
        1. 【固定項目：午餐】：開頭說「午餐推薦:...」並從清單隨機選一個：麗媽、八方、義大利麵、台北大學、韓讚、湘柏苑、早餐店、鮮味、怡蘭扁食、大億、韓一、隨園、阿郎、宏丞、すき家Sukiya、梁社漢、四海遊龍、樂廚房、台灣G湯、麥當勞。
        2. 【隨機二選一】：請從「今日氣象與穿著建議」或「個人健康提醒」中擇一撰寫。

        要求：
        1. 總字數嚴格限制在 50 字內（含標點）。
        2. 開頭直接點名「${userName || '夥伴'}」，不使用早午晚問候。
        3. 語氣溫暖，不標註類別編號。
        繁體中文。
        `

        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: '你是一位 niizo 工作室專屬的生活導師與智慧長輩，擅長給予員工溫暖且具啟發性的生活提示。' },
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
