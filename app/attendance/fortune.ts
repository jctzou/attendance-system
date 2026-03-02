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
        角色設定：你是一位 niizo 工作室的生活導師，語氣成熟、穩定且充滿智慧。
        任務指令：今天是 ${taipeiTime}。請為「${userName || '夥伴'}」準備一段話。
        請從以下「三類」主題中隨機挑選一類進行寫作，不要混雜：
        1. 【生活與心境】：一段有深度的生活提醒（關於工作、家人、心境或待人處事）。
        2. 【健康習慣】：一段現代人最需要的健康提醒（如用眼、呼吸、運動、姿勢、水分等）。
        3. 【時節節奏】：根據今天的週幾（如：週一需收心，週五要放鬆），或是接下來的台灣國定假日，給予相關的貼心建議。

        要求：
        1. 內容簡潔有力，總字數嚴格限制在 50 字內。
        2. 開頭請直接點名「${userName || '夥伴'}」，不要使用早午晚（如早安）等暫存後會失效的時間性問候語。
        3. 每次請求只需隨機給出其中「一個主題」的內容即可。
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
