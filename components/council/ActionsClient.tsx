'use client'

import { useState } from 'react'
import { updateActionStatus } from '@/lib/actions/council'
import { CheckCircle2, AlertTriangle, Clock, XCircle, CircleDot } from 'lucide-react'
import type { CouncilAction, ActionStatus } from '@/lib/council-types'
import { ACTION_STATUS_LABEL } from '@/lib/council-types'

const COLUMNS: { status: ActionStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { status: 'pending',     label: '대기',    color: 'border-t-slate-400',  icon: <CircleDot className="h-4 w-4 text-slate-400" /> },
  { status: 'in_progress', label: '진행 중', color: 'border-t-blue-400',   icon: <Clock className="h-4 w-4 text-blue-400" /> },
  { status: 'completed',   label: '완료',    color: 'border-t-green-400',  icon: <CheckCircle2 className="h-4 w-4 text-green-400" /> },
  { status: 'overdue',     label: '지연',    color: 'border-t-red-400',    icon: <AlertTriangle className="h-4 w-4 text-red-400" /> },
]

export function ActionsClient({ initialActions }: { initialActions: CouncilAction[] }) {
  const [actions, setActions] = useState<CouncilAction[]>(initialActions)
  const [filterStatus, setFilterStatus] = useState<ActionStatus | 'all'>('all')

  const today = new Date().toISOString().split('T')[0]

  async function handleStatusChange(id: string, newStatus: ActionStatus) {
    setActions(prev =>
      prev.map(a => a.id === id ? { ...a, status: newStatus } : a)
    )
    await updateActionStatus(id, newStatus)
  }

  const filtered = filterStatus === 'all'
    ? actions
    : actions.filter(a => a.status === filterStatus)

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
          ['all', '전체'],
          ['pending', '대기'],
          ['in_progress', '진행 중'],
          ['overdue', '지연'],
          ['completed', '완료'],
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
      </div>

      {/* 칸반 (모바일에서는 목록) */}
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
                {colActions.map(a => <ActionCard key={a.id} action={a} today={today} onStatusChange={handleStatusChange} />)}
                {colActions.length === 0 && (
                  <p className="text-xs text-slate-400 text-center py-4">없음</p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 모바일 목록 */}
      <div className="md:hidden space-y-3">
        {filtered.map(a => (
          <div key={a.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800">{a.title}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {a.assignee_name ?? '담당자 미지정'} · {a.due_date}
                </p>
              </div>
              <select
                value={a.status}
                onChange={e => handleStatusChange(a.id, e.target.value as ActionStatus)}
                className="shrink-0 text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none"
              >
                {Object.entries(ACTION_STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400 text-sm">해당 액션이 없습니다.</div>
        )}
      </div>
    </div>
  )
}

function ActionCard({ action: a, today, onStatusChange }: {
  action: CouncilAction
  today: string
  onStatusChange: (id: string, s: ActionStatus) => void
}) {
  const daysLeft = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
  return (
    <div className={`rounded-xl p-3 text-xs border ${a.status === 'overdue' ? 'bg-red-50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
      <p className="font-medium text-slate-800 mb-1 leading-snug">{a.title}</p>
      <p className="text-slate-500">{a.assignee_name ?? '미지정'}</p>
      <div className="flex items-center justify-between mt-2">
        <span className={`${daysLeft < 0 ? 'text-red-600 font-bold' : daysLeft <= 3 ? 'text-yellow-600 font-bold' : 'text-slate-400'}`}>
          {daysLeft < 0 ? `D+${Math.abs(daysLeft)} 지연` : `D-${daysLeft}`}
        </span>
        <select
          value={a.status}
          onChange={e => onStatusChange(a.id, e.target.value as ActionStatus)}
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
