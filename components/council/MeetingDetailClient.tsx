'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { publishMinutes, updateActionStatus, deferDecision } from '@/lib/actions/council'
import {
  CheckCircle2, Clock, AlertTriangle, FileText, ChevronDown, ChevronUp,
  Loader2, PlayCircle, Pause, X,
} from 'lucide-react'
import type { CouncilMeeting, CouncilAction, ActionStatus, CouncilDecision } from '@/lib/council-types'
import { MEETING_TYPE_LABEL, ACTION_STATUS_LABEL, LEGAL_TYPE_LABEL } from '@/lib/council-types'
import { CompleteMeetingFlow } from './CompleteMeetingFlow'

const ACTION_STATUS_COLOR: Record<ActionStatus, string> = {
  pending:     'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed:   'bg-green-100 text-green-700',
  overdue:     'bg-red-100 text-red-700',
  cancelled:   'bg-slate-100 text-slate-400',
}

interface DeferInfo {
  reason: string
  nextMeetingAt?: string
}

export function MeetingDetailClient({ meeting }: { meeting: CouncilMeeting }) {
  const router = useRouter()
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(!!meeting.minutes?.published_at)
  const [expandDiscussion, setExpandDiscussion] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [actionStatuses, setActionStatuses] = useState<Record<string, ActionStatus>>(
    () => Object.fromEntries(
      (meeting.actions ?? []).map(a => [a.id, a.status])
    )
  )

  // 보류 상태 (서버에서 이미 보류된 것 + 이번 세션에서 보류 처리한 것)
  const [deferredMap, setDeferredMap] = useState<Record<string, DeferInfo>>(() => {
    const map: Record<string, DeferInfo> = {}
    for (const d of meeting.decisions ?? []) {
      if (d.agenda_type === 'deferred') {
        map[d.id] = {
          reason: d.deferred_reason ?? '',
          nextMeetingAt: d.deferred_next_meeting_at ?? undefined,
        }
      }
    }
    return map
  })
  const [deferModalDecision, setDeferModalDecision] = useState<CouncilDecision | null>(null)
  const [deferring, setDeferring] = useState(false)
  const [deferReason, setDeferReason] = useState('')
  const [deferNextMeetingAt, setDeferNextMeetingAt] = useState('')

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

  function openDeferModal(d: CouncilDecision) {
    setDeferModalDecision(d)
    setDeferReason('')
    setDeferNextMeetingAt('')
  }

  async function handleDefer() {
    if (!deferModalDecision || !deferReason.trim()) return
    setDeferring(true)
    try {
      await deferDecision(
        deferModalDecision.id,
        deferReason.trim(),
        deferNextMeetingAt || undefined
      )
      setDeferredMap(prev => ({
        ...prev,
        [deferModalDecision.id]: {
          reason: deferReason.trim(),
          nextMeetingAt: deferNextMeetingAt || undefined,
        },
      }))
      setDeferModalDecision(null)
      router.refresh()
    } finally {
      setDeferring(false)
    }
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
          <div className="flex items-center gap-2 shrink-0">
            {meeting.status === 'scheduled' && !meeting.minutes && !completing && (
              <button
                onClick={() => setCompleting(true)}
                className="flex items-center gap-1.5 bg-[#8BADD9] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
              >
                <PlayCircle className="h-4 w-4" />
                회의 완료 처리
              </button>
            )}
            {meeting.minutes && !published && (
              <button
                onClick={handlePublish}
                disabled={publishing}
                className="bg-green-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-green-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {publishing && <Loader2 className="h-4 w-4 animate-spin" />}
                📋 회의록 공개
              </button>
            )}
            {published && (
              <span className="flex items-center gap-1.5 text-green-600 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" /> 공개 완료
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 회의록 없음 / 완료 처리 흐름 */}
      {!meeting.minutes && (
        completing ? (
          <CompleteMeetingFlow
            meeting={meeting}
            onCancel={() => setCompleting(false)}
          />
        ) : (
          <div className="bg-yellow-50 rounded-2xl border border-yellow-100 p-6 text-center">
            <FileText className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 font-medium">아직 회의록이 생성되지 않았습니다.</p>
            {meeting.status === 'scheduled' ? (
              <p className="text-xs text-slate-400 mt-1">
                위의 <span className="font-medium text-[#8BADD9]">회의 완료 처리</span> 버튼을 눌러 전사 텍스트를 입력하고 회의록을 생성하세요.
              </p>
            ) : (
              <p className="text-xs text-slate-400 mt-1">전사 텍스트가 있다면 회의 완료 처리에서 AI 생성을 진행하세요.</p>
            )}
          </div>
        )
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
                  a.type === 'decision'  ? 'bg-blue-100 text-blue-700' :
                  a.type === 'review'    ? 'bg-yellow-100 text-yellow-700' :
                  a.type === 'discussion'? 'bg-purple-100 text-purple-700' :
                  a.type === 'deferred' ? 'bg-orange-100 text-orange-700' :
                  'bg-slate-100 text-slate-500'
                }`}>
                  {a.type === 'decision' ? '결정' : a.type === 'review' ? '점검' : a.type === 'discussion' ? '논의' : a.type === 'deferred' ? '보류' : '정보'}
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
            {meeting.decisions.map((d, i) => {
              const isDeferred = deferredMap[d.id] !== undefined
              const deferInfo = deferredMap[d.id]
              return (
                <div key={d.id} className={`border rounded-xl p-4 ${isDeferred ? 'border-yellow-200 bg-yellow-50/50' : 'border-slate-100'}`}>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-800">{i + 1}. {d.title}</p>
                      {isDeferred && (
                        <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                          <Pause className="h-3 w-3" /> 보류
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                        {d.legal_type ? LEGAL_TYPE_LABEL[d.legal_type] : '분류 없음'}
                      </span>
                      {!isDeferred && (
                        <button
                          onClick={() => openDeferModal(d)}
                          className="flex items-center gap-1 text-xs text-yellow-600 hover:text-yellow-700 font-medium border border-yellow-200 bg-yellow-50 hover:bg-yellow-100 px-2 py-0.5 rounded-full transition-colors"
                        >
                          <Pause className="h-3 w-3" />
                          보류
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-1 text-xs text-slate-600">
                    {d.d2_definition && <p><span className="font-medium text-slate-500">① 정의:</span> {d.d2_definition}</p>}
                    {d.d3_criteria   && <p><span className="font-medium text-slate-500">② 기준:</span> {d.d3_criteria}</p>}
                    {d.d4_execution  && <p><span className="font-medium text-slate-500">③ 실행:</span> {d.d4_execution}</p>}
                    {d.d5_feedback   && <p><span className="font-medium text-slate-500">④ 피드백:</span> {d.d5_feedback}</p>}
                  </div>
                  {isDeferred && deferInfo && (
                    <div className="mt-3 p-3 bg-yellow-100 rounded-lg text-xs text-yellow-900 space-y-1">
                      <p><span className="font-semibold">보류 사유:</span> {deferInfo.reason}</p>
                      {deferInfo.nextMeetingAt && (
                        <p><span className="font-semibold">재협의 예정일:</span> {deferInfo.nextMeetingAt}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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
              const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
              const isDeferred = a.title.startsWith('[보류 재논의]')
              return (
                <div key={a.id} className={`flex items-start gap-3 border rounded-xl p-4 ${isDeferred ? 'border-yellow-100 bg-yellow-50/40' : 'border-slate-100'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">
                      {isDeferred && <span className="text-yellow-600 mr-1">[보류 재논의]</span>}
                      {isDeferred ? a.title.replace('[보류 재논의] ', '') : a.title}
                    </p>
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

      {/* 보류 처리 모달 */}
      {deferModalDecision && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Pause className="h-5 w-5 text-yellow-500" />
                <h3 className="font-bold text-slate-900">보류 처리</h3>
              </div>
              <button
                onClick={() => setDeferModalDecision(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              <span className="font-medium text-slate-800">{deferModalDecision.title}</span> 안건을
              보류 처리합니다. 재논의 액션이 자동으로 생성됩니다.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  보류 사유 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={deferReason}
                  onChange={e => setDeferReason(e.target.value)}
                  placeholder="예: 추가 자료 검토 필요, 법적 검토 요청 예정..."
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-600 block mb-1.5">
                  재협의 예정일 <span className="text-slate-400 font-normal">(선택)</span>
                </label>
                <input
                  type="date"
                  value={deferNextMeetingAt}
                  onChange={e => setDeferNextMeetingAt(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-200"
                />
                <p className="text-xs text-slate-400 mt-1">미입력 시 30일 후를 기한으로 재논의 액션이 생성됩니다.</p>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                onClick={() => setDeferModalDecision(null)}
                className="flex-1 border border-slate-200 text-slate-600 px-4 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDefer}
                disabled={!deferReason.trim() || deferring}
                className="flex-1 bg-yellow-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-yellow-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {deferring && <Loader2 className="h-4 w-4 animate-spin" />}
                보류 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
