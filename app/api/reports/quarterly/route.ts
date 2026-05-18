import { renderToBuffer } from '@react-pdf/renderer'
import { QuarterlyReportDocument } from '@/components/reports/QuarterlyReportDocument'
import { fetchQuarterlyReportData } from '@/lib/actions/quarterly-report-data'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') ?? ''
  const to = searchParams.get('to') ?? ''
  const target = searchParams.get('target') ?? ''
  const supervisee = searchParams.get('supervisee') ?? ''
  const reportTitle = searchParams.get('title') ?? '분기 감사결과 보고서'

  if (!from || !to) {
    return new Response('기간을 입력해 주세요.', { status: 400 })
  }

  try {
    const data = await fetchQuarterlyReportData(from, to, target, supervisee, reportTitle)
    const element = QuarterlyReportDocument({ data })
    const buffer = await renderToBuffer(element)

    const filename = `분기감사결과_${from}_${to}.pdf`

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
    console.error('[quarterly report]', err)
    return new Response(`보고서 생성 실패: ${message}`, { status: 500 })
  }
}
