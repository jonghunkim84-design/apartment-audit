'use client'

import { useState, useTransition } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import {
  Calendar, CheckCircle2, Clock, AlertTriangle, RotateCcw,
  Copy, Check, Loader2, FileText, ChevronRight,
} from 'lucide-react'
import { executeCarryover } from '@/lib/actions/council-reports'
import type { AnnualData, CarryoverCandidate } from '@/lib/actions/council-reports'

const STATUS_LABEL: Record<string, string> = {
  pending:     '대기',
  in_progress: '진행 중',
  overdue:     '지연',
}

const STATUS_STYLE: Record<string, string> = {
  pending:     'text-slate-600 bg-slate-100',
  in_progress: 'text-blue-700 bg-blue-50',
  overdue:     'text-red-700 bg-red-50',
}

// ── 이월 후보 행 ─────────────────────────────────────────────

function CandidateRow({
  candidate,
  checked,
  onToggle,
}: {
  candidate: CarryoverCandidate
  checked: boolean
  onToggle: () => void
}) {
  const statusStyle = STATUS_STYLE[candidate.status] ?? 'text-slate-600 bg-slate-100'
  const statusLabel = STATUS_LABEL[candidate.status] ?? candidate.status

  return (
    <label
      className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer border transition-colors ${
        checked ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-transparent'
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-0.5 accent-[#8BADD9]"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-slate-800 truncate">{candidate.title}</p>
          <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
          {candidate.assignee_name && <span>{candidate.assignee_name}</span>}
          <span>기한 {candidate.due_date}</span>
          {candidate.meeting_title && (
            <>
              <ChevronRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{candidate.meeting_title}</span>
            </>
          )}
        </div>
      </div>
    </label>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export function AnnualReportClient({ year, data }: { year: number; data: AnnualData }) {
  const {
    reports, totalMeetings, totalActions, completedActions,
    overdueActions, avgPublishRate, avgCompletionRate, candidates,
  } = data

  // 지연 액션을 기본 선택
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(candidates.filter(c => c.status === 'overdue').map(c => c.id))
  )
  const [isPending, startTransition] = useTransition()
  const [carryoverDone, setCarryoverDone] = useState(false)
  const [carryoverCount, setCarryoverCount] = useState(0)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Q1-Q4 차트 데이터 (데이터 있는 분기만)
  const chartData = [1, 2, 3, 4]
    .map(q => {
      const r = reports.find(rr => rr.quarter === q)
      return {
        name: `Q${q}`,
        '회의록 공개율': r?.kpi_minutes_published_rate ?? null,
        '액션 완료율':   r?.kpi_action_completion_rate ?? null,
      }
    })
    .filter(d => d['회의록 공개율'] !== null || d['액션 완료율'] !== null)

  // 컴플라이언스 즉시시정 건수 합산
  const totalFailCount = reports.reduce((sum, r) => {
    const vals = [
      r.comp_minutes_retention, r.comp_recording_consent,
      r.comp_privacy_masking,   r.comp_long_term_repair,
      r.comp_large_work_approval, r.comp_public_disclosure,
    ]
    return sum + vals.filter(v => v === 'fail').length
  }, 0)

  function toggleId(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selectedIds.size === candidates.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(candidates.map(c => c.id)))
  }

  function handleCarryover() {
    setError('')
    startTransition(async () => {
      try {
        const { count } = await executeCarryover(Array.from(selectedIds))
        setCarryoverCount(count)
        setCarryoverDone(true)
      } catch (e) {
        setError(String(e))
      }
    })
  }

  const noticeText = [
    `[${year}년 입주자대표회의 연간 운영 성과]`,
    '',
    `안녕하세요, 입주자대표회의입니다.`,
    `${year}년 대표회의 주요 운영 성과를 알려드립니다.`,
    '',
    `• 전체 회의 개최: ${totalMeetings}회`,
    `• 전체 의결 액션: ${totalActions}건 (완료 ${completedActions}건)`,
    `• 연평균 회의록 24시간 공개율: ${avgPublishRate}%`,
    `• 연평균 액션 완료율: ${avgCompletionRate}%`,
    `• 컴플라이언스 6항목 즉시시정 ${totalFailCount}건 점검 완료`,
    '',
    `내년에도 투명하고 체계적인 운영으로 입주민 여러분의 신뢰에 보답하겠습니다.`,
    '',
    `입주자대표회의 대표회장`,
  ].join('\n')

  function copyNotice() {
    navigator.clipboard.writeText(noticeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">연간 마무리</h1>
          <p className="text-sm text-slate-500 mt-0.5">Q1–Q4 통합 성과 · 미완료 액션 이월 처리</p>
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white px-4 py-2 rounded-xl border border-slate-200 shadow-sm">
          <Calendar className="h-4 w-4 text-[#8BADD9]" />
          {year}년
        </div>
      </div>

      {/* KPI 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: '연간 회의',    value: `${totalMeetings}회`,      icon: <FileText    className="h-5 w-5 text-[#8BADD9]"  />, bg: 'bg-blue-50'   },
          { label: '완료 액션',    value: `${completedActions}건`,   icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, bg: 'bg-green-50'  },
          { label: '미완료 액션',  value: `${candidates.length}건`,  icon: <Clock        className="h-5 w-5 text-yellow-500"/>, bg: 'bg-yellow-50' },
          { label: '지연 액션',    value: `${overdueActions}건`,     icon: <AlertTriangle className="h-5 w-5 text-red-500"  />, bg: 'bg-red-50'    },
        ] as { label: string; value: string; icon: React.ReactNode; bg: string }[]).map(({ label, value, icon, bg }) => (
          <div key={label} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
            <div className={`rounded-xl p-2 ${bg}`}>{icon}</div>
            <div>
              <p className="text-xs text-slate-500">{label}</p>
              <p className="text-xl font-bold text-slate-800">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Q1-Q4 KPI 바 차트 */}
      {chartData.length > 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <p className="text-sm font-bold text-slate-700 mb-4">Q1–Q4 KPI 추세</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 5, right: 16, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} unit="%" />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                formatter={(val) => [`${val}%`]}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey="회의록 공개율" fill="#8BADD9" radius={[4, 4, 0, 0]} />
              <Bar dataKey="액션 완료율"   fill="#6EE7B7" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">연평균 회의록 공개율</p>
              <p className={`text-2xl font-bold mt-0.5 ${avgPublishRate >= 80 ? 'text-green-600' : 'text-red-500'}`}>
                {avgPublishRate}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">목표 80% 이상</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500">연평균 액션 완료율</p>
              <p className={`text-2xl font-bold mt-0.5 ${avgCompletionRate >= 70 ? 'text-green-600' : 'text-red-500'}`}>
                {avgCompletionRate}%
              </p>
              <p className="text-xs text-slate-400 mt-0.5">목표 70% 이상</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <p className="text-slate-400 text-sm">분기 보고서가 없습니다.</p>
          <p className="text-slate-300 text-xs mt-1">먼저 분기 보고서 메뉴에서 Q1–Q4 보고서를 생성하세요.</p>
        </div>
      )}

      {/* 이월 처리 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <div>
            <p className="font-bold text-slate-800">미완료 액션 이월 처리</p>
            <p className="text-xs text-slate-500 mt-0.5">
              선택한 액션을 {year + 1}년 Q1 (3월 31일 기한)으로 이월합니다
            </p>
          </div>
          {!carryoverDone && candidates.length > 0 && (
            <button
              onClick={toggleAll}
              className="text-xs text-[#8BADD9] hover:text-blue-700 font-medium transition-colors"
            >
              {selectedIds.size === candidates.length ? '전체 해제' : '전체 선택'}
            </button>
          )}
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-4 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {carryoverDone ? (
            <div className="flex items-center gap-3 py-6 text-green-700">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="font-medium">
                {carryoverCount}건이 {year + 1}년으로 이월 완료되었습니다.
                액션 현황 메뉴에서 확인하세요.
              </p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <p className="text-slate-500 text-sm font-medium">이월할 미완료 액션이 없습니다.</p>
              <p className="text-slate-300 text-xs mt-1">모든 액션이 완료되었습니다!</p>
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {candidates.map(c => (
                  <CandidateRow
                    key={c.id}
                    candidate={c}
                    checked={selectedIds.has(c.id)}
                    onToggle={() => toggleId(c.id)}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                <p className="text-sm text-slate-500">
                  {selectedIds.size}건 선택 / 전체 {candidates.length}건
                </p>
                <button
                  onClick={handleCarryover}
                  disabled={isPending || selectedIds.size === 0}
                  className="flex items-center gap-2 bg-[#8BADD9] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  {isPending
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <RotateCcw className="h-4 w-4" />}
                  {isPending ? '이월 처리 중...' : `${selectedIds.size}건 이월 실행`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 입주민 공지 문구 */}
      <div className="bg-slate-800 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            입주민 공지 문구 (공개게시판·카카오방용)
          </p>
          <button
            onClick={copyNotice}
            className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white transition-colors"
          >
            {copied
              ? <Check className="h-3.5 w-3.5 text-green-400" />
              : <Copy  className="h-3.5 w-3.5" />}
            {copied ? '복사됨' : '복사'}
          </button>
        </div>
        <pre className="text-sm leading-relaxed text-slate-200 whitespace-pre-wrap font-sans">
          {noticeText}
        </pre>
      </div>
    </div>
  )
}
