'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, RefreshCw, ChevronDown } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { updateFindingStatus, type FindingRow } from '@/lib/actions/findings'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function parseAcfe(description: string | null): string {
  return description?.match(/ACFE:\s*([^\]]+)/)?.[1]?.trim() ?? '기타'
}

function fmtDate(s: string | null) {
  if (!s) return '-'
  return new Date(s).toLocaleDateString('ko-KR', { year: '2-digit', month: '2-digit', day: '2-digit' })
}

// ── 스타일 상수 ────────────────────────────────────────────────────────────────

const SEVERITY_CLS: Record<string, string> = {
  critical: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950/30',
  high:     'border-orange-300 bg-orange-50 text-orange-700 dark:bg-orange-950/30',
  medium:   'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950/30',
  low:      'border-gray-200 bg-gray-50 text-gray-600',
}

const SEVERITY_LABEL: Record<string, string> = {
  critical: '위험', high: '높음', medium: '중간', low: '낮음',
}

const STATUS_CLS: Record<string, string> = {
  open:          'border-blue-300 bg-blue-50 text-blue-700',
  investigating: 'border-yellow-300 bg-yellow-50 text-yellow-700',
  resolved:      'border-green-300 bg-green-50 text-green-700',
}

const STATUS_LABEL: Record<string, string> = {
  open: '미해결', investigating: '조사중', resolved: '해결완료',
}

const selectCls = 'h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring cursor-pointer'

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

interface AnalysisSummary {
  totalReceipts: number
  findingsCount: number
  findingsCreated: number
}

export function FindingsClient({ initialRows }: { initialRows: FindingRow[] }) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [severityFilter, setSeverityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [analysisResult, setAnalysisResult] = useState<AnalysisSummary | null>(null)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isPending, startTransition] = useTransition()

  // P4 분석 실행
  async function runAnalysis() {
    setIsAnalyzing(true)
    setAnalysisResult(null)
    setAnalysisError(null)
    try {
      const res = await fetch('/api/pattern-analysis', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '분석 실패')
      setAnalysisResult(json.summary as AnalysisSummary)
      router.refresh()
    } catch (e) {
      setAnalysisError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // 상태 변경
  function handleStatusChange(id: string, status: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, status } : r))
    startTransition(() => updateFindingStatus(id, status))
  }

  // 필터
  const filtered = rows.filter(r => {
    if (severityFilter !== 'all' && r.severity !== severityFilter) return false
    if (statusFilter !== 'all' && r.status !== statusFilter) return false
    return true
  })

  const openCount = rows.filter(r => r.status === 'open').length
  const criticalHighCount = rows.filter(r => r.severity === 'critical' || r.severity === 'high').length
  const resolvedCount = rows.filter(r => r.status === 'resolved').length

  return (
    <div className="space-y-6">

      {/* P4 분석 실행 카드 */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="flex-1">
              <p className="text-sm font-semibold">P4 누적 패턴 분석</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Benford's Law + ACFE 6종 탐지 실행 — 새 지적사항이 자동으로 등록됩니다
              </p>
            </div>
            <Button
              size="sm"
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="shrink-0"
            >
              {isAnalyzing
                ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />분석 중…</>
                : <><Play className="h-3.5 w-3.5 mr-1.5" />분석 실행</>
              }
            </Button>
          </div>

          {analysisResult && (
            <div className="mt-3 rounded-md border border-green-300 bg-green-50 px-3 py-2 text-xs text-green-800">
              분석 완료 — 영수증 {analysisResult.totalReceipts}건 중 {analysisResult.findingsCount}개 패턴 탐지,{' '}
              {analysisResult.findingsCreated}건 신규 지적사항 등록됨
            </div>
          )}
          {analysisError && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              오류: {analysisError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체 지적사항</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{rows.length}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
          </CardContent>
        </Card>
        <Card className={openCount > 0 ? 'border-blue-300 bg-blue-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">미해결</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', openCount > 0 && 'text-blue-600')}>
              {openCount}<span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
          </CardContent>
        </Card>
        <Card className={criticalHighCount > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">위험·높음</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', criticalHighCount > 0 && 'text-red-600')}>
              {criticalHighCount}<span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
          </CardContent>
        </Card>
        <Card className={resolvedCount > 0 ? 'border-green-300 bg-green-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">해결완료</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', resolvedCount > 0 && 'text-green-600')}>
              {resolvedCount}<span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base">지적사항 목록</CardTitle>
            <div className="flex gap-2">
              <select
                className={selectCls}
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value)}
              >
                <option value="all">전체 심각도</option>
                <option value="critical">위험</option>
                <option value="high">높음</option>
                <option value="medium">중간</option>
                <option value="low">낮음</option>
              </select>
              <select
                className={selectCls}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">전체 상태</option>
                <option value="open">미해결</option>
                <option value="investigating">조사중</option>
                <option value="resolved">해결완료</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12">
              {rows.length === 0 ? 'P4 분석을 실행하면 지적사항이 여기에 표시됩니다.' : '필터 조건에 맞는 항목이 없습니다.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground w-[40%]">지적사항</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">심각도</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">ACFE 분류</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">상태</th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">등록일</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr
                      key={row.id}
                      className={cn('border-b last:border-0 hover:bg-muted/20 transition-colors', isPending && 'opacity-60')}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium leading-snug">{row.title}</p>
                        {row.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                            {row.description.replace(/^\[P4 자동탐지 · ACFE: .*?\] /, '')}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <Badge
                          variant="outline"
                          className={cn('text-xs', SEVERITY_CLS[row.severity] ?? SEVERITY_CLS.low)}
                        >
                          {SEVERITY_LABEL[row.severity] ?? row.severity}
                        </Badge>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {parseAcfe(row.description)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="relative">
                          <select
                            className={cn(
                              selectCls,
                              'pr-6 appearance-none',
                              STATUS_CLS[row.status] ?? '',
                            )}
                            value={row.status}
                            onChange={e => handleStatusChange(row.id, e.target.value)}
                          >
                            <option value="open">미해결</option>
                            <option value="investigating">조사중</option>
                            <option value="resolved">해결완료</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-current opacity-60" />
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(row.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
