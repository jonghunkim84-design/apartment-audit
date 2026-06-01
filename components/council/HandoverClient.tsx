'use client'

import { useState, useTransition } from 'react'
import {
  Package, Users, CheckCircle2, Circle, Save, Loader2,
  ChevronRight, ClipboardList, AlertTriangle, Search,
} from 'lucide-react'
import Link from 'next/link'
import {
  saveHandover, completeHandover,
  DEFAULT_CHECKLIST,
} from '@/lib/actions/council-handover'
import type { Handover, ChecklistItem } from '@/lib/actions/council-handover'

const SECTION_LABEL: Record<string, string> = {
  A: 'A. 단지 현황',
  B: 'B. 시스템 접근 권한',
  C: 'C. 문서 인계',
  D: 'D. 미해결 사항',
}

const ONBOARDING_STEPS = [
  { step: 1, label: '현재 진행 중인 액션 확인',    href: '/council/actions',            hint: '액션 현황 메뉴에서 담당자별 진행 상황을 파악하세요.' },
  { step: 2, label: '최근 회의록 검토',            href: '/council/meetings',           hint: '회의 목록에서 최근 3개월 회의록을 확인하세요.' },
  { step: 3, label: '분기 운영 보고서 확인',       href: '/council/reports/quarterly',  hint: '이번 분기 KPI와 컴플라이언스 현황을 파악하세요.' },
  { step: 4, label: '이전 회기 인수인계 메모 확인', href: '/council/handover',           hint: '전임 동대표의 인계 메모와 주요 업체 연락처를 확인하세요.' },
  { step: 5, label: '지식 검색으로 주요 결정 파악', href: '/council/search',             hint: '궁금한 사항은 지식 검색에서 자연어로 찾아보세요.' },
]

// ── 체크리스트 항목 ──────────────────────────────────────────

function ChecklistSection({
  section, items, onToggle,
}: { section: string; items: ChecklistItem[]; onToggle: (id: string) => void }) {
  const sectionItems = items.filter(i => i.section === section)
  const done = sectionItems.filter(i => i.checked).length

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          {SECTION_LABEL[section]}
        </p>
        <span className="text-xs text-slate-400">{done}/{sectionItems.length}</span>
      </div>
      <div className="space-y-1.5">
        {sectionItems.map(item => (
          <button
            key={item.id}
            onClick={() => onToggle(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left border transition-colors ${
              item.checked
                ? 'bg-green-50 border-green-100 text-green-800'
                : 'bg-slate-50 border-transparent text-slate-700 hover:bg-slate-100'
            }`}
          >
            {item.checked
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              : <Circle       className="h-4 w-4 shrink-0 text-slate-300" />}
            <span className="text-sm">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export function HandoverClient({
  handover: initial,
  pendingCount,
}: {
  handover: Handover | null
  pendingCount: number
}) {
  const [tab, setTab] = useState<'handover' | 'onboarding'>('handover')

  // 인계 상태
  const [id, setId] = useState(initial?.id)
  const [checklist, setChecklist] = useState<ChecklistItem[]>(
    initial?.checklist?.length
      ? (initial.checklist as ChecklistItem[])
      : [...DEFAULT_CHECKLIST]
  )
  const [ongoingWorks, setOngoingWorks] = useState(initial?.ongoing_works ?? '')
  const [keyContacts,  setKeyContacts]  = useState(initial?.key_contacts  ?? '')
  const [notes,        setNotes]        = useState(initial?.notes          ?? '')
  const [completed,    setCompleted]    = useState(!!initial?.completed_at)

  const [isPending, startTransition] = useTransition()
  const [savedAt, setSavedAt]        = useState<string | null>(null)
  const [error, setError]            = useState('')

  const checkedCount = checklist.filter(i => i.checked).length
  const allDone      = checkedCount === checklist.length

  function toggleItem(itemId: string) {
    setChecklist(prev =>
      prev.map(i => i.id === itemId ? { ...i, checked: !i.checked } : i)
    )
  }

  function handleSave() {
    setError('')
    startTransition(async () => {
      try {
        const result = await saveHandover({ id, checklist, ongoing_works: ongoingWorks, key_contacts: keyContacts, notes })
        setId(result.id)
        setSavedAt(new Date().toLocaleTimeString('ko-KR'))
      } catch (e) { setError(String(e)) }
    })
  }

  function handleComplete() {
    if (!id) return
    startTransition(async () => {
      try {
        await completeHandover(id)
        setCompleted(true)
      } catch (e) { setError(String(e)) }
    })
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">인수인계</h1>
        <p className="text-sm text-slate-500 mt-0.5">동대표 교체 시 체계적인 업무 인계와 온보딩</p>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([
          { key: 'handover',   label: '인계 준비',    icon: Package },
          { key: 'onboarding', label: '신임 온보딩',  icon: Users },
        ] as { key: typeof tab; label: string; icon: React.FC<{ className?: string }> }[]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── 인계 준비 탭 ────────────────────────────────────── */}
      {tab === 'handover' && (
        <div className="space-y-5">
          {completed && (
            <div className="flex items-center gap-3 bg-green-50 border border-green-100 rounded-2xl px-5 py-3 text-green-800">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">인계가 완료 처리되었습니다.</p>
            </div>
          )}

          {/* 진행률 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold text-slate-700">인계 체크리스트</p>
              <span className={`text-sm font-bold ${allDone ? 'text-green-600' : 'text-slate-500'}`}>
                {checkedCount}/{checklist.length}
              </span>
            </div>
            <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${allDone ? 'bg-green-400' : 'bg-[#8BADD9]'}`}
                style={{ width: `${(checkedCount / checklist.length) * 100}%` }}
              />
            </div>
          </div>

          {/* 체크리스트 섹션 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
            {['A', 'B', 'C', 'D'].map(section => (
              <ChecklistSection
                key={section}
                section={section}
                items={checklist}
                onToggle={toggleItem}
              />
            ))}
          </div>

          {/* 진행 중 공사·계약 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <label className="block text-sm font-bold text-slate-700">진행 중 공사·계약 현황</label>
            <textarea
              value={ongoingWorks}
              onChange={e => setOngoingWorks(e.target.value)}
              rows={4}
              placeholder="예: CCTV 추가 설치 공사 — OO업체, 계약금액 1,200만 원, 2026-02-28 완료 예정&#10;주차장 도색 공사 — 입찰 진행 중"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]/40 resize-none"
            />
          </div>

          {/* 주요 연락처 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <label className="block text-sm font-bold text-slate-700">주요 업체·기관 연락처</label>
            <textarea
              value={keyContacts}
              onChange={e => setKeyContacts(e.target.value)}
              rows={4}
              placeholder="예: 엘리베이터 유지보수 — OO엘리베이터 홍길동 010-0000-0000&#10;소방설비 — OO소방 김철수 010-0000-0000"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]/40 resize-none"
            />
          </div>

          {/* 특이사항 메모 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-3">
            <label className="block text-sm font-bold text-slate-700">특이사항·인계 메모</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={5}
              placeholder="신임 동대표에게 전달할 특이사항, 주의사항, 진행 중 분쟁·민원 등을 자유롭게 작성하세요."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]/40 resize-none"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
              {error}
            </div>
          )}

          {/* 액션 버튼 */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            {savedAt && (
              <p className="text-xs text-slate-400">{savedAt} 저장됨</p>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={handleSave}
                disabled={isPending}
                className="flex items-center gap-2 border border-slate-200 bg-white text-slate-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                임시 저장
              </button>
              {id && !completed && (
                <button
                  onClick={handleComplete}
                  disabled={isPending || !allDone}
                  className="flex items-center gap-2 bg-[#8BADD9] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  인계 완료 처리
                </button>
              )}
            </div>
          </div>

          {id && !completed && !allDone && (
            <p className="text-xs text-slate-400 text-right">
              체크리스트를 모두 완료해야 인계 완료 처리가 가능합니다.
            </p>
          )}
        </div>
      )}

      {/* ── 신임 온보딩 탭 ──────────────────────────────────── */}
      {tab === 'onboarding' && (
        <div className="space-y-5">
          {/* 인사말 */}
          <div className="bg-[#8BADD9] rounded-2xl p-5 text-white">
            <p className="font-bold text-lg">동대표로 선임되신 것을 환영합니다!</p>
            <p className="text-blue-100 text-sm mt-1">
              아래 순서대로 업무를 파악하세요. 모든 과거 결정 이력은 지식 검색에서 찾을 수 있습니다.
            </p>
          </div>

          {/* 현황 요약 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3">
              <div className={`rounded-xl p-2 ${pendingCount > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
                {pendingCount > 0
                  ? <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  : <CheckCircle2 className="h-5 w-5 text-green-500" />}
              </div>
              <div>
                <p className="text-xs text-slate-500">진행 중 액션</p>
                <p className="text-xl font-bold text-slate-800">{pendingCount}건</p>
              </div>
            </div>
            <Link
              href="/council/search"
              className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
            >
              <div className="rounded-xl p-2 bg-blue-50">
                <Search className="h-5 w-5 text-[#8BADD9]" />
              </div>
              <div>
                <p className="text-xs text-slate-500">AI 지식 검색</p>
                <p className="text-sm font-bold text-slate-800">궁금한 것 물어보기 →</p>
              </div>
            </Link>
          </div>

          {/* 단계별 온보딩 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-50">
              <p className="text-sm font-bold text-slate-700">업무 파악 순서</p>
            </div>
            <div className="divide-y divide-slate-50">
              {ONBOARDING_STEPS.map(({ step, label, href, hint }) => (
                <Link
                  key={step}
                  href={href}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-full bg-[#8BADD9] text-white flex items-center justify-center text-sm font-bold shrink-0">
                    {step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{label}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 shrink-0 transition-colors" />
                </Link>
              ))}
            </div>
          </div>

          {/* 인계 메모 확인 */}
          {(initial?.notes || initial?.ongoing_works || initial?.key_contacts) && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-slate-400" />
                <p className="text-sm font-bold text-slate-700">전임 동대표 인계 메모</p>
              </div>
              {initial.ongoing_works && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">진행 중 공사·계약</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl px-4 py-3">
                    {initial.ongoing_works}
                  </p>
                </div>
              )}
              {initial.key_contacts && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">주요 연락처</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl px-4 py-3">
                    {initial.key_contacts}
                  </p>
                </div>
              )}
              {initial.notes && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1">특이사항</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-xl px-4 py-3">
                    {initial.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
