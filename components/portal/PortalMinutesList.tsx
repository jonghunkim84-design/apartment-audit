'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, BookOpen, FileText } from 'lucide-react'

const MEETING_TYPE_LABEL: Record<string, string> = {
  regular:      '정기 전체대표회의',
  subcommittee: '소위원회',
  emergency:    '긴급회의',
  ops:          '운영위원회',
  one_on_one:   '관리소장 1:1',
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  manager_only:       '관리소장 자율',
  president_approval: '대표회장 승인',
  full_council:       '전체대표회의 의결',
  legal_procedure:    '법정 절차',
}

type AgendaItem = { index: number; type: string; title: string }
type DiscussionItem = {
  agenda_index: number
  summary: string
  key_opinions: { role: string; opinion: string }[]
}
type Decision = {
  id: string
  title: string
  d2_definition: string | null
  d3_criteria: string | null
  d4_execution: string | null
  d5_feedback: string | null
  legal_type: string | null
  order_index: number
}

export type PublishedMeeting = {
  id: string
  title: string
  meeting_type: string
  held_at: string
  minutes: {
    id: string
    published_at: string
    agenda_summary: AgendaItem[] | null
    discussion_summary: DiscussionItem[] | null
    pdf_url: string | null
  }
  decisions: Decision[]
}

export function PortalMinutesList({ meetings }: { meetings: PublishedMeeting[] }) {
  const [openId, setOpenId] = useState<string | null>(meetings[0]?.id ?? null)

  if (meetings.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100">
        <BookOpen className="h-4 w-4 text-[#8BADD9]" />
        <h2 className="font-semibold text-slate-800">대표회의 회의록</h2>
        <span className="ml-auto text-xs text-slate-400">{meetings.length}건 공개</span>
      </div>

      <div className="divide-y divide-slate-50">
        {meetings.map(m => {
          const isOpen = openId === m.id
          const decisions = [...m.decisions].sort((a, b) => a.order_index - b.order_index)
          const agendaItems = m.minutes.agenda_summary ?? []
          const discussionItems = m.minutes.discussion_summary ?? []

          return (
            <div key={m.id}>
              <button
                onClick={() => setOpenId(isOpen ? null : m.id)}
                className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="shrink-0 text-xs font-medium text-[#8BADD9] bg-blue-50 px-2 py-0.5 rounded-full">
                      {MEETING_TYPE_LABEL[m.meeting_type] ?? m.meeting_type}
                    </span>
                    <span className="text-sm font-medium text-slate-800 truncate">{m.title}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {new Date(m.held_at).toLocaleDateString('ko-KR', {
                      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
                    })}
                    {' · 공개 '}
                    {new Date(m.minutes.published_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                {isOpen
                  ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
                  : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                }
              </button>

              {isOpen && (
                <div className="px-6 pb-6 space-y-5 border-t border-slate-50">

                  {/* 안건 목록 */}
                  {agendaItems.length > 0 && (
                    <div className="pt-4">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">안건 목록</p>
                      <div className="space-y-1.5">
                        {agendaItems.map((a, i) => (
                          <div key={i} className="flex items-center gap-2.5">
                            <span className="text-xs text-slate-400 w-5 shrink-0">{a.index}.</span>
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-xs font-medium ${
                              a.type === 'decision'   ? 'bg-blue-100 text-blue-700' :
                              a.type === 'review'     ? 'bg-yellow-100 text-yellow-700' :
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

                  {/* 결정사항 */}
                  {decisions.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">결정사항</p>
                      <div className="space-y-3">
                        {decisions.map((d, i) => (
                          <div key={d.id} className="border border-slate-100 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="font-medium text-slate-800 text-sm">{i + 1}. {d.title}</p>
                              {d.legal_type && (
                                <span className="shrink-0 text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                                  {LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}
                                </span>
                              )}
                            </div>
                            <div className="space-y-1 text-xs text-slate-600">
                              {d.d2_definition && <p><span className="font-medium text-slate-500">① 결정:</span> {d.d2_definition}</p>}
                              {d.d3_criteria   && <p><span className="font-medium text-slate-500">② 기준:</span> {d.d3_criteria}</p>}
                              {d.d4_execution  && <p><span className="font-medium text-slate-500">③ 실행:</span> {d.d4_execution}</p>}
                              {d.d5_feedback   && <p><span className="font-medium text-slate-500">④ 피드백:</span> {d.d5_feedback}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 논의 요약 */}
                  {discussionItems.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">논의 요약</p>
                      <div className="space-y-3">
                        {discussionItems.map((d, i) => (
                          <div key={i} className="bg-slate-50 rounded-xl px-4 py-3">
                            <p className="text-xs text-slate-500 font-medium mb-1">안건 {d.agenda_index}</p>
                            <p className="text-sm text-slate-700 leading-relaxed">{d.summary}</p>
                            {d.key_opinions?.length > 0 && (
                              <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
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
                    </div>
                  )}

                  {/* PDF 다운로드 */}
                  {m.minutes.pdf_url && (
                    <a
                      href={m.minutes.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <FileText className="h-4 w-4" />
                      회의록 PDF 다운로드
                    </a>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
