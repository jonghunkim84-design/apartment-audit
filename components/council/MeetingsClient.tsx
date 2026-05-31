'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PlusCircle, FileText, CheckCircle2, Clock, XCircle } from 'lucide-react'
import type { CouncilMeeting, MeetingType } from '@/lib/council-types'
import { MEETING_TYPE_LABEL } from '@/lib/council-types'

const STATUS_CHIP: Record<string, { label: string; cls: string }> = {
  scheduled:   { label: '예정',    cls: 'bg-blue-100 text-blue-700' },
  in_progress: { label: '진행 중', cls: 'bg-yellow-100 text-yellow-700' },
  completed:   { label: '완료',    cls: 'bg-green-100 text-green-700' },
  cancelled:   { label: '취소',    cls: 'bg-slate-100 text-slate-500' },
}

export function MeetingsClient({ meetings }: { meetings: CouncilMeeting[] }) {
  const [filterType, setFilterType] = useState<MeetingType | 'all'>('all')

  const filtered = filterType === 'all'
    ? meetings
    : meetings.filter(m => m.meeting_type === filterType)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">회의 목록</h1>
        <Link
          href="/council/meetings/new"
          className="flex items-center gap-2 bg-[#8BADD9] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          새 회의
        </Link>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'regular', 'subcommittee', 'emergency', 'ops', 'one_on_one'] as const).map(t => (
          <button
            key={t}
            onClick={() => setFilterType(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === t
                ? 'bg-[#8BADD9] text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {t === 'all' ? '전체' : MEETING_TYPE_LABEL[t]}
          </button>
        ))}
      </div>

      {/* 목록 */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-100">
            <FileText className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">등록된 회의가 없습니다.</p>
          </div>
        ) : filtered.map(m => {
          const st = STATUS_CHIP[m.status]
          const actionCount = m.actions?.length ?? 0
          const decisionCount = m.decisions?.length ?? 0

          return (
            <Link key={m.id} href={`/council/meetings/${m.id}`}>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 hover:border-[#8BADD9] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[#8BADD9] bg-blue-50 px-2 py-0.5 rounded-full">
                        {MEETING_TYPE_LABEL[m.meeting_type]}
                      </span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${st.cls}`}>
                        {st.label}
                      </span>
                      {m.minutes?.published_at && (
                        <span className="text-xs text-green-600 font-medium">📋 회의록 공개</span>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-800 mt-2 truncate">{m.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {new Date(m.held_at).toLocaleDateString('ko-KR', {
                        year: 'numeric', month: 'long', day: 'numeric',
                        weekday: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                      {m.location && ` · ${m.location}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-slate-400 space-y-1">
                    {m.quorum_required && m.quorum_present && (
                      <p>{m.quorum_present}/{m.quorum_required}명 참석
                        {m.quorum_met
                          ? <span className="text-green-600 ml-1">✓</span>
                          : <span className="text-red-500 ml-1">✗</span>
                        }
                      </p>
                    )}
                    {decisionCount > 0 && <p>결정 {decisionCount}건</p>}
                    {actionCount > 0 && <p>액션 {actionCount}건</p>}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
