import { renderToBuffer } from '@react-pdf/renderer'
import { AuditReportDocument } from '@/components/reports/AuditReportDocument'
import { fetchReportData } from '@/lib/actions/report-data'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!from || !to) {
    return new Response('from 및 to 파라미터가 필요합니다.', { status: 400 })
  }

  // YYYY-MM-DD 형식 검증
  const dateRe = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRe.test(from) || !dateRe.test(to)) {
    return new Response('날짜는 YYYY-MM-DD 형식이어야 합니다.', { status: 400 })
  }

  try {
    const data = await fetchReportData(from, to)

    // Call as function to get ReactElement<DocumentProps> directly
    const element = AuditReportDocument({ data })
    const buffer = await renderToBuffer(element)

    const filename = `audit-report-${from}-${to}.pdf`

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
    console.error('[report/generate] error:', err)
    return new Response(`보고서 생성 실패: ${message}`, { status: 500 })
  }
}
