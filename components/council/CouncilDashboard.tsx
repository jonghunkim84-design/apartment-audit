'use client'

import Link from 'next/link'
import { ClipboardList, Calendar, AlertTriangle, CheckCircle2, Clock, PlusCircle } from 'lucide-react'
import type { CouncilMeeting, CouncilAction, CouncilTerm } from '@/lib/council-types'
import { ACTION_STATUS_LABEL } from '@/lib/council-types'

interface Props {
  meetings: CouncilMeeting[]
  actions: CouncilAction[]
  activeTerm: CouncilTerm | null
}

export function CouncilDashboard({ meetings, actions, activeTerm }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const overdue  = actions.filter(a => a.status === 'overdue' || (a.status === 'pending' && a.due_date < today))
  const dueIn3   = actions.filter(a => {
    if (a.status === 'completed' || a.status === 'cancelled') return false
    const diff = Math.ceil((new Date(a.due_date).getTime() - Date.now()) / 86400000)
    return diff >= 0 && diff <= 3
  })
  const inProgress = actions.filter(a => a.status === 'in_progress')
  const completed  = actions.filter(a => a.status === 'completed')

  const nextMeeting = meetings
    .filter(m => m.status === 'scheduled' && m.held_at >= new Date().toISOString())
    .sort((a, b) => a.held_at.localeCompare(b.held_at))[0]

  const recentMeetings = meetings
    .filter(m => m.status === 'completed')
    .slice(0, 3)

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">대표회의 운영</h1>
          {activeTerm && (
            <p className="text-sm text-slate-500 mt-0.5">
              {activeTerm.term_number}기 운영 중 ({activeTerm.start_date} ~ {activeTerm.end_date})
            </p>
          )}
        </div>
        <Link
          href="/council/meetings/new"
          className="flex items-center gap-2 bg-[#8BADD9] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          회의 등록
        </Link>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="진행 중 액션"
          value={`${inProgress.length}건`}
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          bg="bg-blue-50"
        />
        <KpiCard
          label="지연"
          value={`${overdue.length}건`}
          icon={<AlertTriangle className="h-5 w-5 text-red-500" />}
          bg={overdue.length > 0 ? 'bg-red-50' : 'bg-slate-50'}
          highlight={overdue.length > 0}
        />
        <KpiCard
          label="D-3 마감"
          value={`${dueIn3.length}건`}
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
          bg={dueIn3.length > 0 ? 'bg-yellow-50' : 'bg-slate-50'}
        />
        <KpiCard
          label="완료"
          value={`${completed.length}건`}
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          bg="bg-green-50"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 다음 회의 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-[#8BADD9]" />
            <h2 className="font-semibold text-slate-800">다음 회의</h2>
          </div>
          {nextMeeting ? (
            <Link href={`/council/meetings/${nextMeeting.id}`}>
              <div className="bg-blue-50 rounded-xl p-4 hover:bg-blue-100 transition-colors">
                <p className="font-medium text-slate-800">{nextMeeting.title}</p>
                <p className="text-sm text-slate-500 mt-1">
                  {new Date(nextMeeting.held_at).toLocaleDateString('ko-KR', {
                    month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
                {nextMeeting.location && (
                  <p className="text-xs text-slate-400 mt-1">{nextMeeting.location}</p>
                )}
                <p className="text-xs text-blue-600 mt-2 font-medium">
                  D-{Math.ceil((new Date(nextMeeting.held_at).getTime() - Date.now()) / 86400000)}
                </p>
              </div>
            </Link>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              <p>예정된 회의가 없습니다.</p>
              <Link href="/council/meetings/new" className="text-blue-500 hover:underline mt-1 block">
                + 회의 등록
              </Link>
            </div>
          )}
        </div>

        {/* 주요 지연 액션 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="font-semibold text-slate-800">주요 지연 액션</h2>
            </div>
            <Link href="/council/actions" className="text-xs text-blue-500 hover:underline">전체 보기</Link>
          </div>
          {overdue.length > 0 ? (
            <div className="space-y-2">
              {overdue.slice(0, 4).map(a => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-red-50 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{a.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {a.assignee_name ?? '담당자 미지정'} · 기한 {a.due_date}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-red-600 font-bold">
                    D+{Math.ceil((Date.now() - new Date(a.due_date).getTime()) / 86400000)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-400 text-sm">
              <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto mb-2" />
              지연 액션이 없습니다 👍
            </div>
          )}
        </div>
      </div>

      {/* 최근 회의 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#8BADD9]" />
            <h2 className="font-semibold text-slate-800">최근 완료된 회의</h2>
          </div>
          <Link href="/council/meetings" className="text-xs text-blue-500 hover:underline">전체 보기</Link>
        </div>
        {recentMeetings.length > 0 ? (
          <div className="space-y-2">
            {recentMeetings.map(m => (
              <Link key={m.id} href={`/council/meetings/${m.id}`}>
                <div className="flex items-center gap-4 p-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{m.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(m.held_at).toLocaleDateString('ko-KR')}
                    </p>
                  </div>
                  <div className="shrink-0 flex gap-2 text-xs text-slate-400">
                    {m.minutes?.published_at
                      ? <span className="text-green-600 font-medium">공개 완료</span>
                      : m.minutes
                      ? <span className="text-yellow-600 font-medium">검수 대기</span>
                      : <span className="text-slate-400">회의록 없음</span>
                    }
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-center py-8 text-slate-400 text-sm">완료된 회의가 없습니다.</p>
        )}
      </div>
    </div>
  )
}

function KpiCard({ label, value, icon, bg, highlight }: {
  label: string
  value: string
  icon: React.ReactNode
  bg: string
  highlight?: boolean
}) {
  return (
    <div className={`${bg} rounded-2xl px-4 py-3 ${highlight ? 'ring-2 ring-red-200' : ''}`}>
      <div className="flex items-center gap-2 mb-1">{icon}</div>
      <p className="text-lg font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  )
}
