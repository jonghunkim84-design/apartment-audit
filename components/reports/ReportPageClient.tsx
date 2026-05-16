'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { FileDown, Loader2, AlertCircle, FileText } from 'lucide-react'

function thisYear() {
  const y = new Date().getFullYear()
  return { from: `${y}-01-01`, to: `${y}-12-31` }
}

export function ReportPageClient() {
  const defaults = thisYear()
  const [from, setFrom] = useState(defaults.from)
  const [to, setTo] = useState(defaults.to)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDownload() {
    if (!from || !to) {
      setError('기간을 모두 입력해 주세요.')
      return
    }
    if (from > to) {
      setError('시작일이 종료일보다 늦을 수 없습니다.')
      return
    }

    setError(null)
    setLoading(true)

    try {
      const url = `/api/reports/generate?from=${from}&to=${to}`
      const res = await fetch(url)

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = `감사보고서_${from}_${to}.pdf`
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

  const previewItems = [
    '제1장  감사 결과 요약 (KPI 통계표)',
    '제2장  영수증 이상 건 상세 목록 (수동검수 · 반려 + flags)',
    '제3장  감사 지적사항 (audit_findings)',
    '제4장  재심의 요청 내역 및 처리 결과',
    '제5장  잡수입 유형별 현황',
    '제6장  장기수선충당금 이행 현황',
    '표지 · 감사인 서명란 (공동주택관리법 제26조 형식)',
  ]

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF 보고서 생성
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Date range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="from" className="text-sm font-medium">감사 시작일</label>
              <Input
                id="from"
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                max={to}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="to" className="text-sm font-medium">감사 종료일</label>
              <Input
                id="to"
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from}
              />
            </div>
          </div>

          {/* Preview of contents */}
          <div className="rounded-md border bg-muted/30 p-4 space-y-1">
            <p className="text-xs font-semibold text-muted-foreground mb-2">보고서 포함 내용</p>
            {previewItems.map((item) => (
              <p key={item} className="text-xs text-muted-foreground flex gap-1.5">
                <span className="text-primary">·</span>
                {item}
              </p>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button
            onClick={handleDownload}
            disabled={loading}
            className="w-full"
            size="lg"
          >
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
            공동주택관리법 제26조 보고 형식 · A4 PDF · 한글 지원
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
