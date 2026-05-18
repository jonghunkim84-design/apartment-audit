import { NextRequest, NextResponse } from 'next/server'
import { runAllScheduledChecks } from '@/lib/notifications/scheduled'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Vercel Cron Job이 매일 KST 23:00(UTC 14:00)에 GET 요청으로 호출
// Authorization: Bearer <CRON_SECRET> 헤더로 인증
export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '')
  if (token !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { results } = await runAllScheduledChecks()
    console.log('[scheduled notifications]', results)
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    console.error('[scheduled notifications] fatal', err)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
