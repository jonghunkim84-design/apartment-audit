'use client'

import { useState } from 'react'
import { updateActionStatus, escalateAction, respondToEscalation } from '@/lib/actions/council'
import type { ComplexMember } from '@/lib/actions/council'
import { CheckCircle2, AlertTriangle, Clock, CircleDot, X, Info, ArrowUpCircle, MessageSquare } from 'lucide-react'
import type { CouncilAction, ActionStatus } from '@/lib/council-types'
import { ACTION_STATUS_LABEL } from '@/lib/council-types'

const COLUMNS: { status: ActionStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { status: 'pending',     label: '대기',    color: 'border-t-slate-400',  icon: <CircleDot className="h-4 w-4 text-slate-400" /> },
  { status: 'in_progress', label: '진행 중', color: 'border-t-blue-400',   icon: <Clock className="h-4 w-4 text-blue-400" /> },
  { status: 'completed',   label: '완료',    color: 'border-t-green-400',  icon: <CheckCircle2 className="h-4 w-4 text-green-400" /> },
  { status: 'overdue',     label: '지연',    color: 'border-t-red-400',    icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
]

export function ActionsClient({
  initialActions,
  members,
  currentUserId,
}: {
  initialActions: CouncilAction[]
  members: ComplexMember[]
  currentUserId: string
}) {
  const [actions, setActions] = useState<CouncilAction[]>(initialActions)
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'all' | 'escalated'>('all')
  const [selectedAction, setSelectedAction] = useState<CouncilAction | null>(null)

  const today = new Date().toISOString().split('T')[0]

  function patchAction(id: string, patch: Partial<CouncilAction>) {
    setActions(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a))
    setSelectedAction(prev => prev?.id === id ? { ...prev, ...patch } : prev)
  }

  async function handleStatusChange(id: string, newStatus: ActionStatus) {
    patchAction(id, { status: newStatus })
    await updateActionStatus(id, newStatus)
  }

  async function handleEscalate(id: string, toUserId?: string, reason?: string) {
    const now = new Date().toISOString()
    patchAction(id, {
      escalated: true,
      escalated_at: now,
      escalated_to: toUserId ?? null,
      escalated_by: currentUserId,
      escalation_reason: reason ?? null,
    })
    await escalateAction(id, toUserId, reason)
  }

  async function handleRespond(id: string, response: string) {
    const now = new Date().toISOString()
    patchAction(id, { escalation_response: response, escalation_responded_at: now })
    await respondToEscalation(id, response)
  }

  async function handleResolveEscalation(id: string, note: string) {
    const now = new Date().toISOString()
    patchAction(id, { status: 'completed', completed_at: now, completion_note: note || null })
    await updateActionStatus(id, 'completed', note || undefined)
  }

  const filtered =
    filterStatus === 'all'       ? actions :
    filterStatus === 'escalated' ? actions.filter(a => a.escalated) :
                                   actions.filter(a => a.status === filterStatus)

  const escalatedCount = actions.filter(a => a.escalated).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">액션 현황</h1>
        <div className="text-sm text-slate-500">
          총 {actions.length}건 · 완료 {actions.filter(a => a.status === 'completed').length}건
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {([
          ['all',        '전체'],
          ['pending',    '대기'],
          ['in_progress','진행 중'],
          ['overdue',    '지연'],
          ['completed',  '완료'],
        ] as const).map(([v, l]) => (
          <button
            key={v}
            onClick={() => setFilterStatus(v)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === v
                ? 'bg-[#8BADD9] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {l} ({v === 'all' ? actions.length : actions.filter(a => a.status === v).length})
          </button>
        ))}
        {escalatedCount > 0 && (
          <button
            onClick={() => setFilterStatus('escalated')}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterStatus === 'escalated'
                ? 'bg-orange-500 text-white'
                : 'bg-orange-50 text-orange-600 border border-orange-200 hover:border-orange-300'
            }`}
          >
            <ArrowUpCircle className="h-3 w-3" />
            에스컬레이션 ({escalatedCount})
          </button>
        )}
      </div>

      {/* 데스크톱 칸반 — 전체 보기일 때만 */}
      {filterStatus === 'all' && (
        <div className="hidden md:grid grid-cols-4 gap-4">
          {COLUMNS.map(col => {
            const colActions = actions.filter(a => a.status === col.status)
            return (
              <div key={col.status} className={`bg-white rounded-2xl shadow-sm border-t-4 ${col.color} border border-slate-100 p-4`}>
                <div className="flex items-center gap-2 mb-3">
                  {col.icon}
                  <span className="text-sm font-semibold text-slate-700">{col.label}</span>
                  <span className="ml-auto text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{colActions.length}</span>
                </div>
                <div className="space-y-2">
                  {colActions.map(a => (
                    <ActionCard
                      key={a.id}
                      action={a}
                      today={today}
                      onStatusChange={handleStatusChange}
                      onClick={() => setSelectedAction(a)}
                    />
                  ))}
                  {colActions.length === 0 && (
                    <p className="text-xs text-slate-400 text-center py-4">없음</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 필터 적용 시 목록 뷰 */}
      {filterStatus !== 'all' && (
        <div className="space-y-3">
          {filtered.map(a => (
            <FilteredCard
              key={a.id}
              action={a}
              currentUserId={currentUserId}
              onClick={() => setSelectedAction(a)}
              onStatusChange={handleStatusChange}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">해당 액션이 없습니다.</div>
          )}
        </div>
      )}

      {/* 모바일 전체 목록 */}
      {filterStatus === 'all' && (
        <div className="md:hidden space-y-3">
          {actions.map(a => (
            <FilteredCard
              key={a.id}
              action={a}
              currentUserId={currentUserId}
              onClick={() => setSelectedAction(a)}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}

      {selectedAction && (
        <ActionDetailModal
          action={selectedAction}
          members={members}
          currentUserId={currentUserId}
          onClose={() => setSelectedAction(null)}
          onStatusChange={handleStatusChange}
          onEscalate={handleEscalate}
          onRespond={handleRespond}
          onResolveEscalation={handleResolveEscalation}
        />
      )}
    </div>
  )
}

// ── ActionCard (칸반용) ───────────────────────────────────────

function ActionCard({ action: a, today, onStatusChange, onClick }: {
  action: CouncilAction
  today: string
  onStatusChange: (id: string, s: ActionStatus) => void
  onClick: () => void
}) {
  const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-3 text-xs border cursor-pointer hover:shadow-md transition-shadow ${
        a.status === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'
      }`}
    >
      <div className="flex items-start gap-1 mb-1">
        {a.escalated && <ArrowUpCircle className="h-3 w-3 text-orange-500 mt-0.5 shrink-0" />}
        {a.escalated && a.escalation_response && <MessageSquare className="h-3 w-3 text-green-500 mt-0.5 shrink-0" />}
        <p className="font-medium text-slate-800 leading-snug">{a.title}</p>
      </div>
      <p className="text-slate-500">{a.assignee_name ?? '미지정'}</p>
      <div className="flex items-center justify-between mt-2">
        <span className={`${daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft <= 3 ? 'text-yellow-600 font-bold' : 'text-slate-400'}`}>
          {daysLeft < 0 ? `D+${Math.abs(daysLeft)} 지연` : `D-${daysLeft}`}
        </span>
        <select
          value={a.status}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onStatusChange(a.id, e.target.value as ActionStatus) }}
          className="text-xs border border-slate-200 rounded-lg px-1.5 py-0.5 focus:outline-none bg-white"
        >
          {Object.entries(ACTION_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── FilteredCard (목록용) ────────────────────────────────────

function FilteredCard({ action: a, currentUserId, onClick, onStatusChange }: {
  action: CouncilAction
  currentUserId: string
  onClick: () => void
  onStatusChange: (id: string, s: ActionStatus) => void
}) {
  const isRecipient = a.escalated && a.escalated_to === currentUserId && !a.escalation_response
  return (
    <div
      className={`bg-white rounded-2xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition-shadow ${
        isRecipient ? 'border-orange-200' : 'border-slate-100'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <p className="text-sm font-medium text-slate-800">{a.title}</p>
            {a.escalated && <ArrowUpCircle className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
            {a.escalation_response && <MessageSquare className="h-3.5 w-3.5 text-green-500 shrink-0" />}
          </div>
          <p className="text-xs text-slate-400">
            {a.assignee_name ?? '담당자 미지정'} · {a.due_date} · {ACTION_STATUS_LABEL[a.status]}
          </p>
          {isRecipient && (
            <p className="text-xs text-orange-600 font-medium mt-1">조치 내용 입력 필요</p>
          )}
        </div>
        <select
          value={a.status}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onStatusChange(a.id, e.target.value as ActionStatus) }}
          className="shrink-0 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
        >
          {Object.entries(ACTION_STATUS_LABEL).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

// ── ActionDetailModal ─────────────────────────────────────────

function ActionDetailModal({
  action: a,
  members,
  currentUserId,
  onClose,
  onStatusChange,
  onEscalate,
  onRespond,
  onResolveEscalation,
}: {
  action: CouncilAction
  members: ComplexMember[]
  currentUserId: string
  onClose: () => void
  onStatusChange: (id: string, s: ActionStatus) => void
  onEscalate: (id: string, toUserId?: string, reason?: string) => Promise<void>
  onRespond: (id: string, response: string) => Promise<void>
  onResolveEscalation: (id: string, note: string) => Promise<void>
}) {
  const [showEscalateForm, setShowEscalateForm] = useState(false)
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [escalationReason, setEscalationReason] = useState('')
  const [escalating, setEscalating] = useState(false)

  const [responseText, setResponseText] = useState(a.escalation_response ?? '')
  const [responding, setResponding] = useState(false)

  const [resolutionNote, setResolutionNote] = useState('')
  const [resolving, setResolving] = useState(false)

  const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
  const escalatedMember = members.find(m => m.id === a.escalated_to)

  // 역할 판별
  const isEscalator  = a.escalated && a.escalated_by === currentUserId
  const isRecipient  = a.escalated && a.escalated_to === currentUserId

  async function handleEscalateConfirm() {
    setEscalating(true)
    try {
      await onEscalate(a.id, selectedMemberId || undefined, escalationReason || undefined)
      setShowEscalateForm(false)
    } finally {
      setEscalating(false)
    }
  }

  async function handleRespondSave() {
    setResponding(true)
    try {
      await onRespond(a.id, responseText)
    } finally {
      setResponding(false)
    }
  }

  async function handleResolveClick() {
    setResolving(true)
    try {
      await onResolveEscalation(a.id, resolutionNote)
    } finally {
      setResolving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-[#8BADD9]" />
            <h2 className="font-semibold text-slate-800">액션 상세</h2>
            {a.escalated && (
              <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-medium">
                에스컬레이션
              </span>
            )}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 기본 정보 */}
        <div className="space-y-3">
          <p className="text-base font-semibold text-slate-900 leading-snug">{a.title}</p>

          {a.description && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">설명</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-500 mb-0.5">담당자</p>
              <p className="text-slate-800">{a.assignee_name ?? '미지정'}</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-500 mb-0.5">기한</p>
              <p className={`font-medium ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 3 ? 'text-yellow-600' : 'text-slate-800'}`}>
                {a.due_date}
                <span className="ml-1 text-xs">
                  ({daysLeft < 0 ? `D+${Math.abs(daysLeft)} 지연` : `D-${daysLeft}`})
                </span>
              </p>
            </div>
          </div>

          {a.verification_method && (
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">검증 방법</p>
              <p className="text-sm text-slate-700">{a.verification_method}</p>
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 pt-4 space-y-4">

          {/* ── 에스컬레이션 발신자 뷰 ── */}
          {isEscalator && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">에스컬레이션 현황</p>

              <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-orange-700">에스컬레이션 대상</p>
                  <p className="text-xs text-slate-400">{a.escalated_at?.split('T')[0]}</p>
                </div>
                <p className="text-sm text-slate-800 font-medium">
                  {escalatedMember ? (escalatedMember.full_name || escalatedMember.email) : '미지정'}
                </p>
                {a.escalation_reason && (
                  <div className="mt-2 pt-2 border-t border-orange-100">
                    <p className="text-xs font-medium text-orange-700 mb-1">에스컬레이션 사유</p>
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.escalation_reason}</p>
                  </div>
                )}
              </div>

              {/* 조치 내용 확인 */}
              {a.escalation_response ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5 text-green-600" />
                    <p className="text-xs font-medium text-green-700">조치 내용 (수신자 답변)</p>
                  </div>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.escalation_response}</p>
                  {a.escalation_responded_at && (
                    <p className="text-xs text-slate-400">{a.escalation_responded_at.split('T')[0]}</p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">아직 조치 내용이 없습니다.</p>
              )}

              {/* 처리 완료 종결 */}
              {a.status !== 'completed' && a.escalation_response && (
                <div className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-slate-600">조치 확인 후 종결</p>
                  <textarea
                    value={resolutionNote}
                    onChange={e => setResolutionNote(e.target.value)}
                    placeholder="종결 메모 (선택)"
                    rows={2}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-slate-300 resize-none"
                  />
                  <button
                    onClick={handleResolveClick}
                    disabled={resolving}
                    className="w-full py-2 bg-slate-700 text-white rounded-lg text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
                  >
                    {resolving ? '처리 중…' : '처리 완료로 종결'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 에스컬레이션 수신자 뷰 ── */}
          {isRecipient && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">에스컬레이션 수신</p>

              {a.escalation_reason && (
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
                  <p className="text-xs font-medium text-orange-700 mb-1">에스컬레이션 사유</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.escalation_reason}</p>
                  <p className="text-xs text-slate-400 mt-1.5">— {a.assignee_name ?? '담당자'} · {a.escalated_at?.split('T')[0]}</p>
                </div>
              )}

              {a.escalation_response ? (
                <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                  <p className="text-xs font-medium text-green-700 mb-1">저장된 조치 내용</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.escalation_response}</p>
                  <p className="text-xs text-slate-400 mt-1">{a.escalation_responded_at?.split('T')[0]}</p>
                </div>
              ) : (
                <div className="border border-orange-200 rounded-xl p-3 space-y-2">
                  <p className="text-xs font-medium text-orange-700">조치 내용 입력</p>
                  <textarea
                    value={responseText}
                    onChange={e => setResponseText(e.target.value)}
                    placeholder="어떤 조치를 취할 예정인지 입력하세요"
                    rows={3}
                    className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
                  />
                  <button
                    onClick={handleRespondSave}
                    disabled={responding || !responseText.trim()}
                    className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                  >
                    {responding ? '저장 중…' : '조치 내용 저장'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── 제3자 읽기 전용 뷰 (에스컬레이션 O, 발신자도 수신자도 아님) ── */}
          {a.escalated && !isEscalator && !isRecipient && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-medium text-orange-700">에스컬레이션 정보</p>
              {escalatedMember && (
                <p className="text-sm text-slate-700">
                  대상: {escalatedMember.full_name || escalatedMember.email}
                </p>
              )}
              {a.escalation_reason && (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">사유: {a.escalation_reason}</p>
              )}
              {a.escalation_response && (
                <p className="text-sm text-slate-600 whitespace-pre-wrap">조치: {a.escalation_response}</p>
              )}
              <p className="text-xs text-slate-400">{a.escalated_at?.split('T')[0]}</p>
            </div>
          )}

          {/* 완료 메모 */}
          {a.status === 'completed' && a.completion_note && (
            <div className="bg-green-50 border border-green-100 rounded-xl p-3">
              <p className="text-xs font-medium text-green-600 mb-1">완료 메모</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{a.completion_note}</p>
              {a.completed_at && <p className="text-xs text-slate-400 mt-1">{a.completed_at.split('T')[0]}</p>}
            </div>
          )}
        </div>

        {/* 하단 액션 */}
        <div className="pt-2 border-t border-slate-100 space-y-3">
          {/* 에스컬레이션 발신 폼 */}
          {!a.escalated && showEscalateForm && (
            <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-orange-700">에스컬레이션 정보 입력</p>
              <select
                value={selectedMemberId}
                onChange={e => setSelectedMemberId(e.target.value)}
                className="w-full text-sm border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                <option value="">에스컬레이션 대상 선택</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.full_name || m.email}
                  </option>
                ))}
              </select>
              <textarea
                value={escalationReason}
                onChange={e => setEscalationReason(e.target.value)}
                placeholder="에스컬레이션 사유를 입력하세요"
                rows={3}
                className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-orange-300 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleEscalateConfirm}
                  disabled={escalating || !selectedMemberId || !escalationReason.trim()}
                  className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                >
                  {escalating ? '처리 중…' : '에스컬레이션 저장'}
                </button>
                <button
                  onClick={() => setShowEscalateForm(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm hover:bg-slate-200"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">상태 변경</span>
              <select
                value={a.status}
                onChange={e => onStatusChange(a.id, e.target.value as ActionStatus)}
                className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none"
              >
                {Object.entries(ACTION_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              {!a.escalated && !showEscalateForm && (
                <button
                  onClick={() => setShowEscalateForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl text-sm hover:bg-orange-100"
                >
                  <ArrowUpCircle className="h-4 w-4" />
                  에스컬레이션
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm hover:bg-slate-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
