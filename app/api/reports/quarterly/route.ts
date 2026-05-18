import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { QuarterlyReportDocument } from '@/components/reports/QuarterlyReportDocument'
import { fetchQuarterlyReportData } from '@/lib/actions/quarterly-report-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const target = searchParams.get('target') ?? ''
  const supervisee = searchParams.get('supervisee') ?? ''
  const reportTitle = searchParams.get('title') ?? '분기 감사결과 보고서'

  if (!from || !to) {
    return NextResponse.json({ error: '기간을 입력해 주세요.' }, { status: 400 })
  }

  try {
    const data = await fetchQuarterlyReportData(from, to, target, supervisee, reportTitle)
    const buffer = await renderToBuffer(
      React.createElement(QuarterlyReportDocument, { data }),
    )

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`분기감사결과_${from}_${to}.pdf`)}`,
      },
    })
  } catch (err) {
    console.error('[quarterly report]', err)
    return NextResponse.json({ error: '보고서 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
