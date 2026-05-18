'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileDown, Loader2, AlertCircle, FileText } from 'lucide-react'

type ReportType = 'annual' | 'quarterly' | 'balance'

function thisYear() {
  const y = new Date().getFullYear()
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

function thisQuarter() {
  const now = new Date()
  const y = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3)
  const from = `${y}-${String(q * 3 + 1).padStart(2, '0')}-01`
  const toMonth = q * 3 + 3
  const lastDay = new Date(y, toMonth, 0).getDate()
  const to = `${y}-${String(toMonth).padStart(2, '0')}-${lastDay}`
  return { from, to }
}

export function ReportPageClient() {
  const [reportType, setReportType] = useState<ReportType>('annual')

  // Annual report state
  const annualDefaults = thisYear()
  const [annualFrom, setAnnualFrom] = useState(annualDefaults.from)
  const [annualTo, setAnnualTo] = useState(annualDefaults.to)

  // Quarterly report state
  const qDefaults = thisQuarter()
  const [qFrom, setQFrom] = useState(qDefaults.from)
  const [qTo, setQTo] = useState(qDefaults.to)
  const [qTarget, setQTarget] = useState('')
  const [qSupervisee, setQSupervisee] = useState('')
  const [qTitle, setQTitle] = useState('')

  // Balance report state
  const now = new Date()
  const [balYear, setBalYear] = useState(now.getFullYear())
  const [balMonth, setBalMonth] = useState(now.getMonth() + 1)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    setError(null)
    setLoading(true)

    try {
      let url = ''
      let filename = ''

      if (reportType === 'annual') {
        if (!annualFrom || !annualTo) { setError('기간을 모두 입력해 주세요.'); setLoading(false); return }
        if (annualFrom > annualTo) { setError('시작일이 종료일보다 늦을 수 없습니다.'); setLoading(false); return }
        url = `/api/reports/generate?from=${annualFrom}&to=${annualTo}`
        filename = `감사보고서_${annualFrom}_${annualTo}.pdf`

      } else if (reportType === 'quarterly') {
        if (!qFrom || !qTo) { setError('기간을 모두 입력해 주세요.'); setLoading(false); return }
        if (qFrom > qTo) { setError('시작일이 종료일보다 늦을 수 없습니다.'); setLoading(false); return }
        const params = new URLSearchParams({
          from: qFrom,
          to: qTo,
          target: qTarget,
          supervisee: qSupervisee,
          title: qTitle || '분기 감사결과 보고서',
        })
        url = `/api/reports/quarterly?${params}`
        filename = `분기감사결과_${qFrom}_${qTo}.pdf`

      } else {
        if (!balYear || !balMonth) { setError('연도와 월을 입력해 주세요.'); setLoading(false); return }
        url = `/api/reports/balance?year=${balYear}&month=${balMonth}`
        filename = `예금잔액대조_${balYear}년${balMonth}월.pdf`
      }

      const res = await fetch(url)
      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : '다운로드 실패')
    } finally {
      setLoading(false)
    }
  }

  const annualContents = [
    '표지 · 감사인 서명란 (공동주택관리법 제26조 형식)',
    '제1장  감사 결과 요약 (KPI 통계표)',
    '제2장  영수증 이상 건 상세 목록 (flags 포함)',
    '제3장  감사 지적사항 (audit_findings)',
    '제4장  재심의 요청 내역 및 처리 결과',
    '제5장  잡수입 유형별 현황',
    '제6장  장기수선충당금 이행 현황',
  ]

  const TAB: { type: ReportType; label: string; sub: string }[] = [
    { type: 'annual', label: '종합 감사보고서', sub: '공동주택관리법 제26조 형식' },
    { type: 'quarterly', label: '분기 감사결과 보고서', sub: '별지 제3-1호서식' },
    { type: 'balance', label: '예금잔액 대조 확인', sub: '별지 제3-2호서식' },
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      {/* 서식 선택 탭 */}
      <div className="grid grid-cols-3 gap-2">
        {TAB.map(({ type, label, sub }) => (
          <button
            key={type}
            onClick={() => { setReportType(type); setError(null) }}
            className={[
              'flex flex-col items-center gap-1 rounded-xl border px-3 py-3 text-sm transition-all',
              reportType === type
                ? 'border-primary bg-primary/10 text-primary font-semibold shadow-sm'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
            ].join(' ')}
          >
            <FileText className="h-4 w-4" />
            <span className="leading-snug text-center">{label}</span>
            <span className="text-[10px] opacity-70">{sub}</span>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {reportType === 'annual' && '종합 감사보고서 생성'}
            {reportType === 'quarterly' && '분기 감사결과 보고서 (별지 제3-1호서식)'}
            {reportType === 'balance' && '예금잔액 대조 확인 보고서 (별지 제3-2호서식)'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">

          {/* ── 종합 감사보고서 ── */}
          {reportType === 'annual' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="af" className="text-sm font-medium">감사 시작일</label>
                  <Input id="af" type="date" value={annualFrom} onChange={(e) => setAnnualFrom(e.target.value)} max={annualTo} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="at" className="text-sm font-medium">감사 종료일</label>
                  <Input id="at" type="date" value={annualTo} onChange={(e) => setAnnualTo(e.target.value)} min={annualFrom} />
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-4 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground mb-2">보고서 포함 내용</p>
                {annualContents.map((item) => (
                  <p key={item} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-primary">·</span>{item}
                  </p>
                ))}
              </div>
            </>
          )}

          {/* ── 분기 감사결과 보고서 ── */}
          {reportType === 'quarterly' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="qf" className="text-sm font-medium">감사 시작일</label>
                  <Input id="qf" type="date" value={qFrom} onChange={(e) => setQFrom(e.target.value)} max={qTo} />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="qt" className="text-sm font-medium">감사 종료일</label>
                  <Input id="qt" type="date" value={qTo} onChange={(e) => setQTo(e.target.value)} min={qFrom} />
                </div>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="qtarget" className="text-sm font-medium">감사 대상</label>
                <Input
                  id="qtarget"
                  placeholder="예: 영수증·관리비, 공사계약, 잡수입 등"
                  value={qTarget}
                  onChange={(e) => setQTarget(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="qsup" className="text-sm font-medium">피감사인</label>
                <Input
                  id="qsup"
                  placeholder="예: 관리소장 홍길동"
                  value={qSupervisee}
                  onChange={(e) => setQSupervisee(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="qtitle" className="text-sm font-medium">보고서 제목 (선택)</label>
                <Input
                  id="qtitle"
                  placeholder="분기 감사결과 보고서"
                  value={qTitle}
                  onChange={(e) => setQTitle(e.target.value)}
                />
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  해당 기간에 등록된 감사 지적사항(audit_findings)이 자동으로 포함됩니다.
                  서명란 3개(감사인·관리소장·입주자대표회의 의장)가 포함됩니다.
                </p>
              </div>
            </>
          )}

          {/* ── 예금잔액 대조 확인 ── */}
          {reportType === 'balance' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="by" className="text-sm font-medium">연도</label>
                  <Input
                    id="by"
                    type="number"
                    min={2000}
                    max={2099}
                    value={balYear}
                    onChange={(e) => setBalYear(parseInt(e.target.value, 10))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bm" className="text-sm font-medium">월</label>
                  <Input
                    id="bm"
                    type="number"
                    min={1}
                    max={12}
                    value={balMonth}
                    onChange={(e) => setBalMonth(parseInt(e.target.value, 10))}
                  />
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground mb-1">출력 내용</p>
                <p className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">·</span>8열 대조표 (금융기관·용도·종류·계좌번호·장부금액·확인금액·차이금액·비고)</p>
                <p className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">·</span>10행 빈 기입란 + 합계행</p>
                <p className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">·</span>대조 확인 문구 및 감사인·관리소장 서명란</p>
                <p className="text-xs text-muted-foreground flex gap-1.5"><span className="text-primary">·</span>가로(A4 Landscape) 출력</p>
              </div>
            </>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button onClick={handleDownload} disabled={loading} className="w-full" size="lg">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                PDF 생성 중… (한글 폰트 로딩 포함 30초 내외)
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                PDF 다운로드
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            공동주택관리법 제26조 · A4 PDF · 한글 지원
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
