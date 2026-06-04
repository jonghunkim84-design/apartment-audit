// ============================================================
// 입주자대표회의 운영 관리 시스템 — 타입 정의
// ============================================================

export type MeetingType = 'regular' | 'subcommittee' | 'emergency' | 'ops' | 'one_on_one'
export type MeetingStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
export type AgendaType = 'info' | 'discussion' | 'decision' | 'review'
export type D1Classification = 'general' | 'exception' | 'crisis'
export type LegalType = 'manager_only' | 'president_approval' | 'full_council' | 'legal_procedure'
export type ActionStatus = 'pending' | 'in_progress' | 'completed' | 'overdue' | 'cancelled'
export type TermStatus = 'active' | 'closed'

export const MEETING_TYPE_LABEL: Record<MeetingType, string> = {
  regular:      '정기 전체대표회의',
  subcommittee: '소위원회',
  emergency:    '긴급회의',
  ops:          '운영위원회',
  one_on_one:   '관리소장 1:1',
}

export const AGENDA_TYPE_LABEL: Record<AgendaType, string> = {
  info:       '정보공유',
  discussion: '논의',
  decision:   '결정',
  review:     '실행점검',
}

export const LEGAL_TYPE_LABEL: Record<LegalType, string> = {
  manager_only:       '관리소장 자율',
  president_approval: '대표회장 승인',
  full_council:       '전체대표회의 의결',
  legal_procedure:    '법정 절차',
}

export const ACTION_STATUS_LABEL: Record<ActionStatus, string> = {
  pending:     '대기',
  in_progress: '진행 중',
  completed:   '완료',
  overdue:     '지연',
  cancelled:   '취소',
}

// ── DB Row 타입 ───────────────────────────────────────────────

export interface CouncilTerm {
  id: string
  apartment_complex_id: string
  term_number: number
  start_date: string
  end_date: string
  status: TermStatus
  created_at: string
}

export interface CouncilMeeting {
  id: string
  apartment_complex_id: string
  term_id: string | null
  title: string
  meeting_type: MeetingType
  held_at: string
  location: string | null
  quorum_required: number | null
  quorum_present: number | null
  quorum_met: boolean | null
  recording_consent_confirmed: boolean
  status: MeetingStatus
  raw_transcript: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // 조인
  minutes?: CouncilMeetingMinutes | null
  decisions?: CouncilDecision[]
  actions?: CouncilAction[]
}

export interface CouncilMeetingMinutes {
  id: string
  meeting_id: string
  agenda_summary: AgendaItem[] | null
  discussion_summary: DiscussionItem[] | null
  ai_generated_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  published_at: string | null
  pdf_url: string | null
  created_at: string
  updated_at: string
}

export interface AgendaItem {
  index: number
  type: AgendaType
  title: string
  time_pct?: number          // 시간 비중 %
}

export interface DiscussionItem {
  agenda_index: number
  summary: string            // 3~5줄 핵심
  key_opinions: { role: string; opinion: string }[]
}

export interface CouncilDecision {
  id: string
  meeting_id: string
  agenda_type: AgendaType | null
  title: string
  d1_classification: D1Classification | null
  d2_definition: string | null
  d3_criteria: string | null
  d4_execution: string | null
  d5_feedback: string | null
  legal_type: LegalType | null
  order_index: number
  created_at: string
  // 조인
  actions?: CouncilAction[]
}

export interface CouncilAction {
  id: string
  apartment_complex_id: string
  meeting_id: string | null
  decision_id: string | null
  title: string
  description: string | null
  assignee_id: string | null
  assignee_name: string | null
  due_date: string
  verification_method: string | null
  status: ActionStatus
  escalated: boolean
  escalated_at: string | null
  escalated_to: string | null
  escalated_by: string | null
  escalation_reason: string | null
  escalation_response: string | null
  escalation_responded_at: string | null
  completed_at: string | null
  completed_by: string | null
  completion_note: string | null
  carried_over_from: string | null
  created_at: string
  updated_at: string
}

// ── AI 생성 응답 타입 ──────────────────────────────────────────

export interface AIMinutesResult {
  agenda_summary: AgendaItem[]
  discussion_summary: DiscussionItem[]
  decisions: AIDecision[]
}

export interface AIDecision {
  title: string
  agenda_type: AgendaType
  d1_classification: D1Classification
  d2_definition: string
  d3_criteria: string
  d4_execution: string
  d5_feedback: string
  legal_type: LegalType
  actions: AIAction[]
}

export interface AIAction {
  title: string
  assignee_hint: string
  due_date_hint: string        // YYYY-MM-DD
  verification_method: string
}
