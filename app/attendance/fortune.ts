'use server'

import OpenAI from 'openai'

export async function getDailyFortune(userName: string | null) {
    const apiKey = process.env.niizo_staff_ai_key
    if (!apiKey) {
        throw new Error('Missing niizo_staff_ai_key')
    }

    console.log('[Fortune] Environment API KEY check:', !!process.env.niizo_staff_ai_key)

    try {
        const openai = new OpenAI({
            apiKey: apiKey,
        })

        const date = new Date().toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })

        const prompt = `
        角色設定：
        你是一位布包品牌niizo工作室聘請的命理師,目的是提升員工的運勢與健康。
        任務指令：
        請分析 ${date} 的運勢，請隨機選擇以下其中一個(天氣、八字命學、紫微斗數、生命靈數、農民曆或西洋占星)作為分析的依據，結合時事、工作與生活的綜合資訊，
        開頭先依時間給予問候 ${userName},(例如：早安、午安、晚安)
        接著給一句[60]字內的提示,說明依據、籤詞 + 幸運物或幸運色。
        `

        console.log('[Fortune] Sending request to OpenAI...')
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'user', content: prompt }
            ],
            max_tokens: 150,
            temperature: 0.7,
        })

        const text = response.choices[0].message.content?.trim() || '今天也是充滿希望的一天，加油！'

        console.log('[Fortune] Success! Result:', text)
        return text
    } catch (error: any) {
        console.error('[Fortune] OpenAI API Error Details:', {
            message: error.message,
            status: error.status,
            name: error.name,
        })
        return '今天也是充滿希望的一天，加油！'
    }
}
