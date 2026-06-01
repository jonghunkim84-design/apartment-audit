'use client'

import { useState, useTransition } from 'react'
import { generateQuarterlyReport } from '@/lib/actions/council-reports'
import type { QuarterlyReport } from '@/lib/actions/council-reports'
import {
  BarChart2, CheckCircle2, XCircle, AlertTriangle, Loader2, RefreshCw, Bot, ChevronDown, ChevronUp,
} from 'lucide-react'

// ── 컴플 레이블 ─────────────────────────────────────────────

const COMP_LABEL: Record<string, string> = {
  minutes_retention:    '회의록 5년 보관',
  recording_consent:    '녹음 동의 멘트',
  privacy_masking:      '개인정보 마스킹',
  long_term_repair:     '장기수선충당금 집행 적정',
  large_work_approval:  '500만 원 초과 공사 의결',
  public_disclosure:    '의결사항 24시간 공개',
}

const COMP_STATUS: Record<string, { icon: React.ReactNode; cls: string; label: string }> = {
  pass:    { icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, cls: 'text-green-700 bg-green-50',  label: '정상' },
  partial: { icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />, cls: 'text-yellow-700 bg-yellow-50', label: '부분 시정' },
  fail:    { icon: <XCircle className="h-4 w-4 text-red-500" />, cls: 'text-red-700 bg-red-50', label: '즉시 시정' },
}

// ── 현재 분기 계산 ───────────────────────────────────────────

function getCurrentQuarter() {
  const now = new Date()
  return { year: now.getFullYear(), quarter: Math.ceil((now.getMonth() + 1) / 3) }
}

// ── KPI 게이지 ───────────────────────────────────────────────

function KpiGauge({ label, value, unit = '%', target, invert = false }: {
  label: string; value: number | null; unit?: string; target?: number; invert?: boolean
}) {
  const v = value ?? 0
  const good = invert ? v <= (target ?? 5) : v >= (target ?? 80)
  const color = good ? 'bg-green-400' : v >= (target ?? 80) * 0.7 ? 'bg-yellow-400' : 'bg-red-400'
  const pct = invert ? Math.max(0, 100 - Math.min(v * 5, 100)) : Math.min(v, 100)

  return (
    <div className="bg-slate-50 rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${good ? 'text-green-700' : 'text-red-600'}`}>
        {v}{unit}
      </p>
      {target !== undefined && (
        <p className="text-xs text-slate-400">목표: {invert ? `${target}${unit} 이하` : `${target}${unit} 이상`}</p>
      )}
      <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export function QuarterlyReportClient({ reports: initialReports }: { reports: QuarterlyReport[] }) {
  const [reports, setReports] = useState<QuarterlyReport[]>(initialReports)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(reports[0]?.id ?? null)

  const { year: curYear, quarter: curQuarter } = getCurrentQuarter()
  const [genYear, setGenYear] = useState(curYear)
  const [genQuarter, setGenQuarter] = useState(curQuarter)

  function handleGenerate() {
    setError('')
    startTransition(async () => {
      try {
        const report = await generateQuarterlyReport(genYear, genQuarter)
        setReports(prev => {
          const filtered = prev.filter(r => !(r.year === genYear && r.quarter === genQuarter))
          return [report, ...filtered].sort((a, b) => b.year - a.year || b.quarter - a.quarter)
        })
        setExpandedId(report.id)
      } catch (e) {
        setError(String(e))
      }
    })
  }

  const compKeys = ['minutes_retention', 'recording_consent', 'privacy_masking', 'long_term_repair', 'large_work_approval', 'public_disclosure'] as const

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">분기 운영 보고서</h1>
          <p className="text-sm text-slate-500 mt-0.5">KPI 4종 + 컴플라이언스 6항목 자동 분석</p>
        </div>

        {/* 생성 컨트롤 */}
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={genYear}
            onChange={e => setGenYear(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            {[curYear, curYear - 1].map(y => <option key={y} value={y}>{y}년</option>)}
          </select>
          <select
            value={genQuarter}
            onChange={e => setGenQuarter(Number(e.target.value))}
            className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
          >
            {[1, 2, 3, 4].map(q => <option key={q} value={q}>Q{q}</option>)}
          </select>
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="flex items-center gap-2 bg-[#8BADD9] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isPending ? 'AI 분석 중...' : '분기 보고서 생성'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {reports.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-16 text-center">
          <BarChart2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">분기 보고서가 없습니다.</p>
          <p className="text-slate-300 text-xs mt-1">위에서 분기를 선택하고 생성하세요.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => {
            const isExpanded = expandedId === report.id
            const compData = {
              minutes_retention:   report.comp_minutes_retention,
              recording_consent:   report.comp_recording_consent,
              privacy_masking:     report.comp_privacy_masking,
              long_term_repair:    report.comp_long_term_repair,
              large_work_approval: report.comp_large_work_approval,
              public_disclosure:   report.comp_public_disclosure,
            }
            const failCount    = Object.values(compData).filter(v => v === 'fail').length
            const partialCount = Object.values(compData).filter(v => v === 'partial').length

            return (
              <div key={report.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* 헤더 */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : report.id)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="font-bold text-slate-800">{report.year}년 {report.quarter}분기</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {new Date(report.generated_at).toLocaleDateString('ko-KR')} 생성 ·
                        회의 {report.meeting_count}회 · 액션 {report.total_actions}건
                      </p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {failCount > 0 && (
                        <span className="text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                          즉시 시정 {failCount}건
                        </span>
                      )}
                      {partialCount > 0 && (
                        <span className="text-xs font-medium text-yellow-700 bg-yellow-50 px-2 py-0.5 rounded-full">
                          부분 시정 {partialCount}건
                        </span>
                      )}
                      {failCount === 0 && partialCount === 0 && (
                        <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          컴플 전항목 정상
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </button>

                {/* 상세 */}
                {isExpanded && (
                  <div className="px-6 pb-6 space-y-6 border-t border-slate-50">
                    {/* KPI 4종 */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mt-4 mb-3">KPI 현황</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <KpiGauge
                          label="회의록 공개율"
                          value={report.kpi_minutes_published_rate}
                          target={80}
                        />
                        <KpiGauge
                          label="액션 완료율"
                          value={report.kpi_action_completion_rate}
                          target={70}
                        />
                        <KpiGauge
                          label="지연 액션"
                          value={report.kpi_overdue_count}
                          unit="건"
                          target={3}
                          invert
                        />
                        <KpiGauge
                          label="에스컬레이션"
                          value={report.kpi_escalation_count}
                          unit="건"
                          target={2}
                          invert
                        />
                      </div>
                    </div>

                    {/* 컴플라이언스 6항목 */}
                    <div>
                      <p className="text-xs font-bold text-slate-500 uppercase mb-3">컴플라이언스 점검 (법규 6항목)</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {compKeys.map(key => {
                          const status = COMP_STATUS[compData[key] ?? 'pass']
                          return (
                            <div key={key} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${status.cls}`}>
                              {status.icon}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium">{COMP_LABEL[key]}</p>
                              </div>
                              <span className="shrink-0 text-xs font-bold">{status.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* AI 분석 */}
                    {(report.ai_strengths || report.ai_improvements || report.ai_recommendations) && (
                      <div className="bg-blue-50 rounded-xl p-5 space-y-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Bot className="h-4 w-4 text-[#8BADD9]" />
                          <p className="text-xs font-bold text-slate-600 uppercase">AI 분기 분석</p>
                        </div>

                        {report.ai_strengths && (
                          <div>
                            <p className="text-xs font-semibold text-green-700 mb-1.5">✅ 강점</p>
                            <ul className="space-y-1">
                              {(report.ai_strengths as string[]).map((s, i) => (
                                <li key={i} className="text-sm text-slate-700">• {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {report.ai_improvements && (
                          <div>
                            <p className="text-xs font-semibold text-yellow-700 mb-1.5">🔧 보강 필요</p>
                            <ul className="space-y-1">
                              {(report.ai_improvements as string[]).map((s, i) => (
                                <li key={i} className="text-sm text-slate-700">• {s}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {report.ai_recommendations && (
                          <div>
                            <p className="text-xs font-semibold text-blue-700 mb-1.5">📋 차분기 권고</p>
                            <ol className="space-y-1">
                              {(report.ai_recommendations as string[]).map((s, i) => (
                                <li key={i} className="text-sm text-slate-700">{i + 1}. {s}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 1줄 카드 */}
                    <div className="bg-slate-800 rounded-xl p-4 text-white text-sm">
                      <p className="text-xs text-slate-400 mb-1">📢 입주민 공지 문구 (복사 후 게시판에 붙여넣기)</p>
                      <p className="leading-relaxed">
                        [{report.year}년 {report.quarter}분기 대표회의 운영] 전체 회의 {report.meeting_count}회 개최,
                        회의록 공개율 {report.kpi_minutes_published_rate}%,
                        액션 완료율 {report.kpi_action_completion_rate}%,
                        컴플라이언스 6항목 점검 — 즉시 시정 {failCount}건, 부분 시정 {partialCount}건.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
