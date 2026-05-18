import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { BalanceReportDocument } from '@/components/reports/BalanceReportDocument'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const year = parseInt(searchParams.get('year') ?? '0', 10)
  const month = parseInt(searchParams.get('month') ?? '0', 10)

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: '연도와 월을 올바르게 입력해 주세요.' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('apartment_complex_id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.apartment_complex_id) {
      return NextResponse.json({ error: 'No apartment complex' }, { status: 400 })
    }

    const { data: apartment } = await supabase
      .from('apartment_complexes')
      .select('name')
      .eq('id', profile.apartment_complex_id)
      .single()

    const buffer = await renderToBuffer(
      React.createElement(BalanceReportDocument, {
        data: {
          year,
          month,
          apartmentName: apartment?.name ?? '아파트',
          auditorName: profile.full_name ?? '',
          generatedAt: new Date().toISOString(),
        },
      }),
    )

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(`예금잔액대조_${year}년${month}월.pdf`)}`,
      },
    })
  } catch (err) {
    console.error('[balance report]', err)
    return NextResponse.json({ error: '보고서 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
