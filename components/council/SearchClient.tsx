'use client'

import { useState, useRef } from 'react'
import { Search, Loader2, Bot, FileText, CheckSquare, ClipboardList, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const MEETING_TYPE_LABEL: Record<string, string> = {
  regular:      '정기 전체대표회의',
  subcommittee: '소위원회',
  emergency:    '긴급회의',
  ops:          '운영위원회',
  one_on_one:   '관리소장 1:1',
}

const ACTION_STATUS_LABEL: Record<string, string> = {
  pending:     '대기',
  in_progress: '진행 중',
  completed:   '완료',
  overdue:     '지연',
  cancelled:   '취소',
}

const LEGAL_TYPE_LABEL: Record<string, string> = {
  manager_only:       '관리소장 자율',
  president_approval: '대표회장 승인',
  full_council:       '전체의결',
  legal_procedure:    '법정 절차',
}

const EXAMPLE_QUERIES = [
  '장기수선충당금 사용 의결 내역',
  '엘리베이터 관련 결정',
  '500만 원 초과 공사 의결',
  '관리소장 업무 위임',
]

interface SearchResult {
  query: string
  aiSummary: string
  meetings: { id: string; title: string; held_at: string; meeting_type: string }[]
  decisions: {
    id: string; title: string; d2_definition?: string; d3_criteria?: string
    d4_execution?: string; legal_type?: string
    council_meetings?: { id: string; title: string; held_at: string }
  }[]
  actions: { id: string; title: string; status: string; due_date: string; assignee_name?: string }[]
  total: number
}

export function SearchClient() {
  const [query, setQuery]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [result, setResult]     = useState<SearchResult | null>(null)
  const [error, setError]       = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSearch(q?: string) {
    const searchQuery = q ?? query
    if (!searchQuery.trim()) return
    if (q) setQuery(q)

    setLoading(true)
    setError('')
    setResult(null)

    try {
      const res = await fetch('/api/council/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '검색 실패')
      setResult(data as SearchResult)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">지식 검색</h1>
        <p className="text-sm text-slate-500 mt-0.5">누적 회의록·결정사항을 자연어로 검색합니다</p>
      </div>

      {/* 검색창 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              placeholder="예: 보일러 교체 결정 배경이 뭐였나요?"
              className="w-full pl-9 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]/40"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            disabled={loading || !query.trim()}
            className="flex items-center gap-2 bg-[#8BADD9] text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            {loading ? '검색 중...' : '검색'}
          </button>
        </div>

        {/* 예시 쿼리 */}
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_QUERIES.map(q => (
            <button
              key={q}
              onClick={() => handleSearch(q)}
              className="text-xs text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* 에러 */}
      {error && (
        <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
          {error}
        </div>
      )}

      {/* 결과 없음 */}
      {result && result.total === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Search className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">"{result.query}" 검색 결과가 없습니다.</p>
          <p className="text-slate-300 text-xs mt-1">다른 키워드로 검색해보세요.</p>
        </div>
      )}

      {/* 검색 결과 */}
      {result && result.total > 0 && (
        <div className="space-y-4">
          {/* AI 요약 */}
          {result.aiSummary && (
            <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
              <div className="flex items-center gap-2 mb-2">
                <Bot className="h-4 w-4 text-[#8BADD9]" />
                <p className="text-xs font-bold text-slate-600 uppercase">AI 요약</p>
                <span className="text-xs text-slate-400">— "{result.query}" 검색 결과</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{result.aiSummary}</p>
            </div>
          )}

          {/* 결정사항 */}
          {result.decisions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50 bg-slate-50">
                <ClipboardList className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">결정사항 {result.decisions.length}건</p>
              </div>
              <div className="divide-y divide-slate-50">
                {result.decisions.map(d => (
                  <div key={d.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 text-sm">{d.title}</p>
                        {d.d2_definition && (
                          <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{d.d2_definition}</p>
                        )}
                        {d.d4_execution && (
                          <p className="text-xs text-blue-600 mt-1">실행: {d.d4_execution}</p>
                        )}
                      </div>
                      {d.legal_type && (
                        <span className="shrink-0 text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {LEGAL_TYPE_LABEL[d.legal_type] ?? d.legal_type}
                        </span>
                      )}
                    </div>
                    {d.council_meetings && (
                      <div className="flex items-center gap-1 mt-2">
                        <ChevronRight className="h-3 w-3 text-slate-300" />
                        <Link
                          href={`/council/meetings/${d.council_meetings.id}`}
                          className="text-xs text-[#8BADD9] hover:text-blue-700"
                        >
                          {d.council_meetings.title} ({d.council_meetings.held_at?.slice(0, 10)})
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 회의 */}
          {result.meetings.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50 bg-slate-50">
                <FileText className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">회의 {result.meetings.length}건</p>
              </div>
              <div className="divide-y divide-slate-50">
                {result.meetings.map(m => (
                  <Link
                    key={m.id}
                    href={`/council/meetings/${m.id}`}
                    className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-800">{m.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {m.held_at?.slice(0, 10)} · {MEETING_TYPE_LABEL[m.meeting_type] ?? m.meeting_type}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 액션 */}
          {result.actions.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-50 bg-slate-50">
                <CheckSquare className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">액션 {result.actions.length}건</p>
              </div>
              <div className="divide-y divide-slate-50">
                {result.actions.map(a => (
                  <div key={a.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{a.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.assignee_name && `${a.assignee_name} · `}기한 {a.due_date}
                      </p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      a.status === 'completed' ? 'text-green-700 bg-green-50' :
                      a.status === 'overdue'   ? 'text-red-700 bg-red-50' :
                      'text-slate-600 bg-slate-100'
                    }`}>
                      {ACTION_STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 초기 상태 */}
      {!result && !loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <Search className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">검색어를 입력하면 회의록·결정사항·액션을 검색합니다.</p>
          <p className="text-slate-300 text-xs mt-1">AI가 결과를 요약해드립니다.</p>
        </div>
      )}
    </div>
  )
}
