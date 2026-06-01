'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react'

// ── 타입 ─────────────────────────────────────────────────────

interface Step {
  text: string
  tip?: string
}

interface HelpItem {
  id: string
  title: string
  summary: string
  steps: Step[]
  caution?: string
}

interface HelpSection {
  label: string
  color: string
  items: HelpItem[]
}

// ── 도움말 데이터 ─────────────────────────────────────────────

const SECTIONS: HelpSection[] = [
  {
    label: '회의 관리',
    color: 'bg-blue-50 text-blue-700 border-blue-100',
    items: [
      {
        id: 'meeting-create',
        title: '회의를 등록하는 법',
        summary: '3단계 위저드로 회의를 등록하고 참석자와 안건을 기록합니다.',
        steps: [
          { text: '사이드바에서 [회의 목록] 클릭' },
          { text: '오른쪽 상단 [+ 새 회의 등록] 버튼 클릭' },
          { text: '1단계: 회의 제목, 유형(정기/소위원회/긴급 등), 일시, 장소 입력' },
          { text: '2단계: 참석자 정족수 확인 후 [녹음 동의 확인] 체크', tip: '회의 시작 전 반드시 녹음 동의 멘트를 읽어야 합니다.' },
          { text: '3단계: 클로바노트 전사 결과를 붙여넣고 [AI 회의록 자동 생성] 클릭' },
          { text: 'AI가 생성한 회의록을 검토·수정 후 [공개 게시] 클릭' },
        ],
        caution: '전체대표회의는 의결 정족수(과반수) 충족 여부를 반드시 확인하세요.',
      },
      {
        id: 'minutes-ai',
        title: 'AI 회의록을 생성하는 법',
        summary: '클로바노트 전사 텍스트를 붙여넣으면 AI가 4단 표준 회의록을 자동 생성합니다.',
        steps: [
          { text: '회의 등록 3단계에서 클로바노트 앱의 전사 결과를 복사' },
          { text: '전사 텍스트 입력란에 붙여넣기 (Ctrl+V)' },
          { text: '[AI 회의록 자동 생성] 버튼 클릭 (10~30초 소요)' },
          { text: 'AI가 생성한 4단 구조(안건·논의·결정·액션) 확인' },
          { text: '잘못된 내용이 있으면 직접 수정', tip: '발언자는 직책만 표시됩니다. 이름·호수는 개인정보 보호를 위해 자동 제외됩니다.' },
          { text: '간사 검수 완료 후 [공개 게시] 클릭 → 24시간 내 게시 필수' },
        ],
        caution: 'AI 생성 결과는 반드시 간사가 검수해야 합니다. 100% 자동화는 불가합니다.',
      },
    ],
  },
  {
    label: '액션 관리',
    color: 'bg-green-50 text-green-700 border-green-100',
    items: [
      {
        id: 'action-track',
        title: '액션(할 일)을 관리하는 법',
        summary: '회의에서 결정된 할 일을 칸반 보드로 추적하고 완료 처리합니다.',
        steps: [
          { text: '사이드바에서 [액션 현황] 클릭' },
          { text: '칸반 보드에서 내 담당 액션 확인 (대기 / 진행 중 / 완료 / 지연)' },
          { text: '액션 카드를 클릭해 상세 내용 확인' },
          { text: '[진행 중으로 변경] 버튼으로 상태 업데이트' },
          { text: '완료 시 [완료 처리] 클릭 → 완료 메모 작성 후 저장', tip: '검증 방법에 따라 증빙 자료(사진, 문서)를 메모에 기재하세요.' },
        ],
        caution: '기한 초과(D+1) 시 자동으로 "지연" 상태가 되고 대표회장에게 알림이 갑니다.',
      },
      {
        id: 'action-escalate',
        title: '에스컬레이션하는 법',
        summary: '처리가 어려운 액션을 대표회장에게 보고합니다.',
        steps: [
          { text: '액션 현황에서 해당 액션 카드 클릭' },
          { text: '[에스컬레이션] 버튼 클릭' },
          { text: '에스컬레이션 사유 입력 후 확인', tip: '에스컬레이션 후 대표회장에게 자동으로 알림이 발송됩니다.' },
        ],
      },
    ],
  },
  {
    label: '보고서',
    color: 'bg-purple-50 text-purple-700 border-purple-100',
    items: [
      {
        id: 'quarterly-report',
        title: '분기 보고서를 생성하는 법',
        summary: 'KPI 4종과 컴플라이언스 6항목을 AI가 자동 분석하여 보고서를 만듭니다.',
        steps: [
          { text: '사이드바에서 [분기 보고서] 클릭' },
          { text: '오른쪽 상단에서 연도와 분기(Q1~Q4) 선택' },
          { text: '[분기 보고서 생성] 버튼 클릭 (20~40초 소요)' },
          { text: 'KPI 4종 결과 확인: 회의록 공개율 / 액션 완료율 / 지연 액션 / 에스컬레이션' },
          { text: '컴플라이언스 6항목 점검 결과 확인', tip: '즉시 시정(빨간색) 항목은 다음 전체대표회의에 즉시 안건으로 상정하세요.' },
          { text: 'AI 분기 분석 및 차분기 권고 사항 검토' },
          { text: '하단 입주민 공지 문구를 복사해 카카오 단체방에 게시' },
        ],
        caution: '분기 보고서는 분기 종료 후 7일 이내에 생성하는 것을 권장합니다.',
      },
      {
        id: 'annual-report',
        title: '연간 마무리 및 이월 처리하는 법',
        summary: '연간 KPI를 종합하고 미완료 액션을 다음 해로 이월합니다.',
        steps: [
          { text: '사이드바에서 [연간 마무리] 클릭' },
          { text: 'Q1~Q4 KPI 차트로 연간 추세 확인' },
          { text: '미완료 액션 이월 처리 섹션에서 이월할 액션 선택', tip: '지연(빨간색) 액션은 기본으로 선택됩니다. 취소할 액션은 체크 해제하세요.' },
          { text: '[N건 이월 실행] 버튼 클릭 → 다음 해 Q1(3월 31일 기한)으로 자동 이월' },
          { text: '입주민 공지 문구를 복사해 공개게시판과 카카오 단체방에 게시' },
        ],
        caution: '이월된 액션은 [액션 현황]에서 "[이월]" 태그가 붙어 표시됩니다.',
      },
    ],
  },
  {
    label: '인수인계 & 검색',
    color: 'bg-orange-50 text-orange-700 border-orange-100',
    items: [
      {
        id: 'handover',
        title: '인수인계를 작성하는 법',
        summary: '임기 종료 전 체크리스트를 완성하고 신임 동대표에게 인계합니다.',
        steps: [
          { text: '사이드바에서 [인수인계] 클릭' },
          { text: '[인계 준비] 탭에서 체크리스트 항목 하나씩 완료 처리' },
          { text: '진행 중 공사·계약 현황 입력 (업체명, 계약금액, 완료 예정일 등)' },
          { text: '주요 업체·기관 연락처 입력 (엘리베이터, 소방 등)' },
          { text: '특이사항 메모란에 신임 동대표가 알아야 할 내용 작성' },
          { text: '[임시 저장] 버튼으로 중간 저장 가능', tip: '체크리스트를 모두 완료해야 [인계 완료 처리] 버튼이 활성화됩니다.' },
          { text: '신임 동대표는 [신임 온보딩] 탭에서 5단계 안내에 따라 업무 파악' },
        ],
      },
      {
        id: 'search',
        title: '지식 검색을 사용하는 법',
        summary: '과거 회의 결정 이력을 자연어로 검색하고 AI 요약을 받습니다.',
        steps: [
          { text: '사이드바에서 [지식 검색] 클릭' },
          { text: '검색창에 궁금한 내용을 자연어로 입력', tip: '예: "보일러 교체 결정 배경이 뭐였나요?" "장기수선충당금 사용 내역 보여줘"' },
          { text: '[검색] 버튼 클릭 또는 Enter' },
          { text: 'AI 요약을 먼저 확인 후 아래 상세 결과(결정사항·회의·액션) 검토' },
          { text: '결과에서 회의 제목을 클릭하면 해당 회의 전체 회의록으로 이동' },
        ],
      },
    ],
  },
  {
    label: '자주 묻는 질문',
    color: 'bg-slate-50 text-slate-700 border-slate-200',
    items: [
      {
        id: 'faq-notify',
        title: '마감 알림은 언제 오나요?',
        summary: '',
        steps: [
          { text: '매일 오전 9시에 자동으로 확인합니다.' },
          { text: 'D-7: 마감 7일 전 알림' },
          { text: 'D-3: 마감 3일 전 알림' },
          { text: 'D-0: 마감 당일 알림' },
          { text: 'D+1 이후: 자동으로 "지연" 상태 변경 + 대표회장 알림' },
        ],
      },
      {
        id: 'faq-publish',
        title: '회의록은 언제까지 공개해야 하나요?',
        summary: '',
        steps: [
          { text: '공동주택관리법 §14에 따라 회의 후 24시간 이내 공개가 의무입니다.' },
          { text: '시스템에서 [공개 게시] 버튼을 누르면 자동으로 공개 처리됩니다.' },
          { text: '분기 보고서의 "의결사항 24시간 공개" 항목에서 준수율을 확인할 수 있습니다.' },
        ],
      },
      {
        id: 'faq-privacy',
        title: '회의록에 이름을 넣으면 안 되나요?',
        summary: '',
        steps: [
          { text: 'AI 회의록은 자동으로 발언자를 직책으로만 표시합니다 (예: "대표회장", "102동 동대표").' },
          { text: '공개게시판에 올리는 공개본에는 성명·호수를 넣으면 안 됩니다.' },
          { text: '성명이 포함된 원본은 관리사무소 내부에만 보관합니다.' },
        ],
      },
      {
        id: 'faq-500',
        title: '500만 원 이상 공사는 어떻게 처리하나요?',
        summary: '',
        steps: [
          { text: '500만 원 초과 공사는 반드시 전체대표회의 의결이 필요합니다.' },
          { text: '소위원회 검토 → 전체대표회의 안건 상정 → 의결 순서로 진행하세요.' },
          { text: '의결 없이 집행 시 분기 보고서 컴플라이언스 항목에 "즉시 시정"으로 표시됩니다.' },
        ],
        caution: '의결 없는 500만 원 초과 집행은 법적 책임이 발생할 수 있습니다.',
      },
    ],
  },
]

// ── 아코디언 아이템 ────────────────────────────────────────────

function AccordionItem({ item, sectionColor }: { item: HelpItem; sectionColor: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-slate-100 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <span className="font-medium text-slate-800 text-sm">{item.title}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>

      {open && (
        <div className="px-5 pb-5 bg-white border-t border-slate-50 space-y-4">
          {item.summary && (
            <p className="text-sm text-slate-500 pt-3">{item.summary}</p>
          )}

          <ol className="space-y-2.5 pt-1">
            {item.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border ${sectionColor}`}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700">{step.text}</p>
                  {step.tip && (
                    <p className="text-xs text-[#8BADD9] mt-0.5">💡 {step.tip}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {item.caution && (
            <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
              <span className="text-amber-500 text-sm shrink-0">⚠️</span>
              <p className="text-xs text-amber-700">{item.caution}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────

export function HelpClient() {
  const [openSection, setOpenSection] = useState<string>(SECTIONS[0].label)

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">사용 안내</h1>
        <p className="text-sm text-slate-500 mt-0.5">대표회의 운영 시스템 기능별 사용 방법</p>
      </div>

      {/* 빠른 안내 */}
      <div className="bg-[#8BADD9] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle className="h-4 w-4" />
          <p className="font-bold text-sm">처음 사용하신다면</p>
        </div>
        <ol className="text-sm text-blue-100 space-y-1">
          <li>1. 회의 등록 → AI 회의록 생성 → 공개 게시</li>
          <li>2. 생성된 액션 확인 → 담당자 배정 → 완료 처리</li>
          <li>3. 분기 종료 후 분기 보고서 생성 → 공지 문구 게시</li>
        </ol>
      </div>

      {/* 섹션별 아코디언 */}
      {SECTIONS.map(section => (
        <div key={section.label} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <button
            onClick={() => setOpenSection(prev => prev === section.label ? '' : section.label)}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
          >
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${section.color}`}>
              {section.label}
            </span>
            {openSection === section.label
              ? <ChevronUp className="h-4 w-4 text-slate-400" />
              : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>

          {openSection === section.label && (
            <div className="px-4 pb-4 space-y-2 border-t border-slate-50 pt-3">
              {section.items.map(item => (
                <AccordionItem key={item.id} item={item} sectionColor={section.color} />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* 문의 */}
      <div className="text-center py-4">
        <p className="text-xs text-slate-400">
          추가 문의는 관리사무소 또는 시스템 관리자에게 연락하세요.
        </p>
      </div>
    </div>
  )
}
