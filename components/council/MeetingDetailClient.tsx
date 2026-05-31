'use client'

import { useState } from 'react'
import { publishMinutes, updateActionStatus } from '@/lib/actions/council'
import { CheckCircle2, Clock, AlertTriangle, FileText, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import type { CouncilMeeting, CouncilAction, ActionStatus } from '@/lib/council-types'
import { MEETING_TYPE_LABEL, ACTION_STATUS_LABEL, LEGAL_TYPE_LABEL } from '@/lib/council-types'

const ACTION_STATUS_COLOR: Record<ActionStatus, string> = {
  pending:     'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
  cancelled:   'bg-slate-100 text-slate-400',
}

export function MeetingDetailClient({ meeting }: { meeting: CouncilMeeting }) {
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(!!meeting.minutes?.published_at)
  const [expandDiscussion, setExpandDiscussion] = useState(false)
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>(
    () => Object.fromEntries(
      (meeting.actions ?? []).map(a => [a.id, a.status])
    )
  )

  async function handlePublish() {
    setPublishing(true)
    try {
      await publishMinutes(meeting.id)
      setPublished(true)
    } finally {
      setPublishing(false)
    }
  }

  async function handleActionStatus(id: string, status: ActionStatus) {
    setActionStatuses(prev => ({ ...prev, [id]: status }))
    await updateActionStatus(id, status)
  }

  const allActions: CouncilAction[] = meeting.actions ?? []

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-medium text-[#8BADD9] bg-blue-50 px-2 py-0.5 rounded-full">
                {MEETING_TYPE_LABEL[meeting.meeting_type]}
              </span>
              {meeting.quorum_met !== null && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  meeting.quorum_met ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  정족수 {meeting.quorum_met ? '충족' : '미달'}
                  {meeting.quorum_required && meeting.quorum_present
                    ? ` (${meeting.quorum_present}/${meeting.quorum_required})`
                    : ''}
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-900">{meeting.title}</h1>
            <p className="text-sm text-slate-400 mt-1">
              {new Date(meeting.held_at).toLocaleDateString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric',
                weekday: 'long', hour: '2-digit', minute: '2-digit'
              })}
              {meeting.location && ` · ${meeting.location}`}
            </p>
          </div>
          {meeting.minutes && !published && (
            <button
              onClick={handlePublish}
              disabled={publishing}
              className="shrink-0 bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
              📋 회의록 공개
            </button>
          )}
          {published && (
            <span className="shrink-0 flex items-center gap-1.5 text-green-600 text-sm font-medium">
              <CheckCircle2 className="h-4 w-4" /> 공개 완료
            </span>
          )}
        </div>
      </div>

      {/* 회의록 없음 */}
      {!meeting.minutes && (
        <div className="bg-yellow-50 rounded-2xl border border-yellow-100 p-6 text-center">
          <FileText className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
          <p className="text-sm text-slate-600 font-medium">아직 회의록이 생성되지 않았습니다.</p>
          <p className="text-xs text-slate-400 mt-1">전사 텍스트가 있다면 회의 편집에서 AI 생성을 진행하세요.</p>
        </div>
      )}

      {/* 1단 안건 */}
      {meeting.minutes?.agenda_summary && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase mb-3">1단 — 안건</h2>
          <div className="space-y-2">
            {(meeting.minutes.agenda_summary as { index: number; type: string; title: string }[]).map((a, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs text-slate-400 w-5">{a.index}.</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  a.type === 'decision' ? 'bg-blue-100 text-blue-700' :
                  a.type === 'review' ? 'bg-yellow-100 text-yellow-700' :
                  a.type === 'discussion' ? 'bg-purple-100 text-purple-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {a.type === 'decision' ? '결정' : a.type === 'review' ? '점검' : a.type === 'discussion' ? '논의' : '정보'}
                </span>
                <span className="text-sm text-slate-700">{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2단 논의 (접기/펼치기) */}
      {meeting.minutes?.discussion_summary && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={() => setExpandDiscussion(v => !v)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50"
          >
            <h2 className="text-sm font-bold text-slate-500 uppercase">2단 — 논의 요약</h2>
            {expandDiscussion ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          {expandDiscussion && (
            <div className="px-6 pb-5 space-y-4 border-t border-slate-50">
              {(meeting.minutes.discussion_summary as { agenda_index: number; summary: string; key_opinions: { role: string; opinion: string }[] }[]).map((d, i) => (
                <div key={i}>
                  <p className="text-xs text-slate-500 font-medium mb-1">안건 {d.agenda_index}</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{d.summary}</p>
                  {d.key_opinions?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {d.key_opinions.map((o, j) => (
                        <p key={j} className="text-xs text-slate-500">
                          <span className="font-medium text-slate-600">{o.role}:</span> {o.opinion}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 3단 결정사항 */}
      {meeting.decisions && meeting.decisions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase mb-4">3단 — 결정사항</h2>
          <div className="space-y-4">
            {meeting.decisions.map((d, i) => (
              <div key={d.id} className="border border-slate-100 rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <p className="font-medium text-slate-800">{i + 1}. {d.title}</p>
                  <span className="shrink-0 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                    {d.legal_type ? LEGAL_TYPE_LABEL[d.legal_type] : '분류 없음'}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-1 text-xs text-slate-600">
                  {d.d2_definition && <p><span className="font-medium text-slate-500">① 정의:</span> {d.d2_definition}</p>}
                  {d.d3_criteria   && <p><span className="font-medium text-slate-500">② 기준:</span> {d.d3_criteria}</p>}
                  {d.d4_execution  && <p><span className="font-medium text-slate-500">③ 실행:</span> {d.d4_execution}</p>}
                  {d.d5_feedback   && <p><span className="font-medium text-slate-500">④ 피드백:</span> {d.d5_feedback}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4단 액션 */}
      {allActions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-sm font-bold text-slate-500 uppercase mb-4">4단 — 액션 ({allActions.length}건)</h2>
          <div className="space-y-3">
            {allActions.map(a => {
              const status = actionStatuses[a.id] ?? a.status
              const today = new Date().toISOString().split('T')[0]
              const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
              return (
                <div key={a.id} className="flex items-start gap-3 border border-slate-100 rounded-xl p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{a.title}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {a.assignee_name ?? '담당자 미지정'} · 기한 {a.due_date}
                      {daysLeft < 0 && <span className="text-red-500 ml-1 font-medium">(D+{Math.abs(daysLeft)} 지연)</span>}
                      {daysLeft >= 0 && daysLeft <= 3 && <span className="text-yellow-600 ml-1 font-medium">(D-{daysLeft})</span>}
                    </p>
                    {a.verification_method && (
                      <p className="text-xs text-slate-400 mt-0.5">검증: {a.verification_method}</p>
                    )}
                  </div>
                  <select
                    value={status}
                    onChange={e => handleActionStatus(a.id, e.target.value as ActionStatus)}
                    className={`shrink-0 text-xs px-2 py-1 rounded-full border-0 font-medium focus:outline-none cursor-pointer ${ACTION_STATUS_COLOR[status]}`}
                  >
                    {Object.entries(ACTION_STATUS_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
