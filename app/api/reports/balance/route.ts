import { renderToBuffer } from '@react-pdf/renderer'
import { BalanceReportDocument } from '@/components/reports/BalanceReportDocument'
import { createClient } from '@/lib/supabase/server'
import type { AccountRow } from '@/components/reports/BalanceReportDocument'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      year: number
      month: number
      accounts: AccountRow[]
      verificationNote: string
    }

    const { year, month, accounts, verificationNote } = body

    if (!year || !month || month < 1 || month > 12) {
      return new Response('연도와 월을 올바르게 입력해 주세요.', { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return new Response('로그인이 필요합니다.', { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('apartment_complex_id, full_name')
      .eq('id', user.id)
      .single()

    if (!profile?.apartment_complex_id) {
      return new Response('아파트 단지가 설정되지 않았습니다.', { status: 400 })
    }

    const { data: apartment } = await supabase
      .from('apartment_complexes')
      .select('name')
      .eq('id', profile.apartment_complex_id)
      .single()

    const element = BalanceReportDocument({
      data: {
        year,
        month,
        apartmentName: apartment?.name ?? '아파트',
        auditorName: profile.full_name ?? '',
        generatedAt: new Date().toISOString(),
        accounts: accounts ?? [],
        verificationNote: verificationNote ?? '이상 없음',
      },
    })
    const buffer = await renderToBuffer(element)

    const filename = `예금잔액대조_${year}년${month}월.pdf`

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : '알 수 없는 오류'
    if (message === 'Unauthorized') {
      return new Response('로그인이 필요합니다.', { status: 401 })
    }
    console.error('[balance report]', err)
    return new Response(`보고서 생성 실패: ${message}`, { status: 500 })
  }
}
