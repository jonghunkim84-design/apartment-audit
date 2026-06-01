'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, X } from 'lucide-react'
import { updateActionStatus } from '@/lib/actions/council'
import type { CouncilAction } from '@/lib/council-types'

interface Props {
  action: CouncilAction
  onClose: () => void
  onComplete: (id: string) => void
}

export function CompleteActionModal({ action, onClose, onComplete }: Props) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleComplete() {
    setSaving(true)
    try {
      await updateActionStatus(action.id, 'completed', note)
      onComplete(action.id)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <h2 className="font-semibold text-slate-800">액션 완료 처리</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-800">{action.title}</p>
          <p className="text-xs text-slate-500 mt-1">
            {action.assignee_name ?? '담당자 미지정'} · 기한 {action.due_date}
          </p>
          {action.verification_method && (
            <p className="text-xs text-slate-400 mt-1">검증 방법: {action.verification_method}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            완료 메모 <span className="text-slate-400 font-normal">(선택)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={4}
            placeholder="완료 내용, 결과, 특이사항을 기록하세요."
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={handleComplete}
            disabled={saving}
            className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            완료 처리
          </button>
        </div>
      </div>
    </div>
  )
}
