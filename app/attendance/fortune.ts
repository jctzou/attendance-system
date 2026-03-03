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
        角色設定：你是一位 niizo 工作室的生活導師，語氣成熟、穩定且充滿智慧，像是關心後輩的職場長輩。

        任務指令：今天是 ${taipeiTime}。請根據今天的日期與星期，為「${userName || '夥伴'}」隨機從以下主題中挑選「一個」進行創作：
        1. 【今日氣象】：根據台灣目前時節（春天），提及天氣概況及生活注意事項（如溫差、過敏、帶傘）。
        2. 【生命靈數】：分析今天的日期數字（如：2026/03/03 -> 2+0+2+6+0+3+0+3=16, 1+6=7）給予當日的生命靈數解析建議。
        3. 【生活提醒】：分享一段有深度的生活心法或職場待人處事提醒。
        4. 【健康提醒】：一段現代人最需要的健康提醒（如用眼、伸展、水分、呼吸）。
        5. 【靈魂雋語】：分享一句發人深省、具備智慧的話。
        6. 【午餐推薦】：開頭說「午餐推薦你吃...」並隨機從以下清單選一個：麗媽、八方、義大利麵、台北大學、韓讚、湘柏苑、早餐店、鮮味、怡蘭扁食、大億、韓一、隨園、阿郎、宏丞、すき家Sukiya、梁社漢、四海遊龍、樂廚房、台灣G湯、麥當勞。

        要求：
        1. 內容精簡有力，總字數嚴格限制在 50 字內，直接給出內容，不要標註類別編號或名稱。
        2. 開頭請直接點名「${userName || '夥伴'}」，不要使用早、午安等暫存後會失效的問候。
        3. 請務必確認今天是星期幾，給予對時的建議（如週五要放鬆）。
        直接輸出繁體中文。
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
