'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'

export async function getDailyFortune(userName: string | null) {
    const apiKey = process.env.GOOGLE_AI_API_KEY
    if (!apiKey) {
        throw new Error('Missing GOOGLE_AI_API_KEY')
    }

    console.log('[Fortune] Environment API KEY check:', !!process.env.GOOGLE_AI_API_KEY)

    try {
        const genAI = new GoogleGenerativeAI(apiKey)
        // 使用您指定的 Gemini 2.5 模型
        const model = genAI.getGenerativeModel(
            { model: 'gemini-2.5-flash' },
            { apiVersion: 'v1beta' }
        )

        const date = new Date().toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })

        const prompt = `
        你是一位幽默正能量的職場導師。
        任務： 根據今天日期 ${date} 與 ${userName}，生成 35 字內今日運勢。
        要求： 
        1. 自動偵測： 請 AI 自行判斷今日的「星期、天氣、農曆節氣」。
        2. 工作場景: 布包品牌、出貨縫紉製作工作室。
        3. 內容： 結合上述資訊給予一句運勢分析 + 一個辦公室幸運物。
        4. 風格： 拒絕死板，使用職場梗，直接輸出繁體中文。
        `

        console.log('[Fortune] Sending request to Gemini (v1)...')
        const result = await model.generateContent(prompt)
        const response = await result.response
        const text = response.text().trim()

        console.log('[Fortune] Success! Result:', text)
        return text
    } catch (error: any) {
        console.error('[Fortune] Gemini API Error Details:', {
            message: error.message,
            status: error.status,
            name: error.name,
            reason: error.reason || 'Unknown reason'
        })
        return '今天也是充滿希望的一天，加油！'
    }
}
