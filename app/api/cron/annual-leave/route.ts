import { NextResponse } from 'next/server'
import { checkAndGrantLeave } from '@/utils/annual_leave'

export async function GET(request: Request) {
    try {
        // Security Check: You might want to check for a Bearer token or Admin Session here.
        // For simplicity in this demo, we'll allow it but log the access.

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')

        console.log(`[Cron Job] Starting Annual Leave Check... ${userId ? `(Target: ${userId})` : '(All Users)'}`)

        const result = await checkAndGrantLeave(userId || undefined)

        return NextResponse.json({
            success: true,
            data: result
        })
    } catch (error: any) {
        console.error('[Cron Job] Error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
