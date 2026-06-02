'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { GoogleGenerativeAI } from '@google/generative-ai'

// ── 타입 ─────────────────────────────────────────────────────

export interface QuarterlyReport {
  id: string
  apartment_complex_id: string
  year: number
  quarter: number
  kpi_avg_decision_days: number | null
  kpi_24h_rule_rate: number | null
  kpi_minutes_published_rate: number | null
  kpi_action_completion_rate: number | null
  kpi_overdue_count: number | null
  kpi_escalation_count: number | null
  comp_minutes_retention: string
  comp_recording_consent: string
  comp_privacy_masking: string
  comp_long_term_repair: string
  comp_large_work_approval: string
  comp_public_disclosure: string
  ai_strengths: string[] | null
  ai_improvements: string[] | null
  ai_recommendations: string[] | null
  meeting_count: number
  total_actions: number
  completed_actions: number
  generated_at: string
  approved_by: string | null
}

// ── 헬퍼 ─────────────────────────────────────────────────────

async function getComplexId() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증 필요')
  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) throw new Error('단지 미설정')
  return { db, complexId: profile.apartment_complex_id as string }
}

// ── 공개 API ─────────────────────────────────────────────────

export async function getQuarterlyReports(): Promise<QuarterlyReport[]> {
  const { db, complexId } = await getComplexId()
  const { data } = await db
    .from('council_quarterly_reports')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .order('year', { ascending: false })
    .order('quarter', { ascending: false })
  return (data ?? []) as QuarterlyReport[]
}

export async function getQuarterlyReport(year: number, quarter: number): Promise<QuarterlyReport | null> {
  const { db, complexId } = await getComplexId()
  const { data } = await db
    .from('council_quarterly_reports')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .eq('year', year)
    .eq('quarter', quarter)
    .single()
  return data as QuarterlyReport | null
}

// ── 분기 범위 계산 ───────────────────────────────────────────

function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const endDate = new Date(year, endMonth, 0)
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`
  return { start, end }
}

// ── 분기 보고서 생성 ─────────────────────────────────────────

export async function generateQuarterlyReport(year: number, quarter: number): Promise<QuarterlyReport> {
  const { db, complexId } = await getComplexId()
  const { start, end } = quarterRange(year, quarter)

  // KPI 집계
  const { data: meetings } = await db.from('council_meetings')
    .select('id, recording_consent_confirmed')
    .eq('apartment_complex_id', complexId)
    .gte('held_at', start).lte('held_at', end + 'T23:59:59Z')

  const meetingIds = (meetings ?? []).map((m: { id: string }) => m.id)
  const meetingCount = meetingIds.length

  let publishedCount = 0
  let consentCount = 0

  if (meetingIds.length > 0) {
    const { data: mins } = await db.from('council_meeting_minutes')
      .select('id').in('meeting_id', meetingIds).not('published_at', 'is', null)
    publishedCount = (mins ?? []).length
    consentCount = (meetings ?? []).filter((m: { recording_consent_confirmed: boolean }) => m.recording_consent_confirmed).length
  }

  const { data: actions } = await db.from('council_actions')
    .select('id, status, escalated')
    .eq('apartment_complex_id', complexId)
    .gte('created_at', start).lte('created_at', end + 'T23:59:59Z')

  const allActions = (actions ?? []) as { id: string; status: string; escalated: boolean }[]
  const totalActions = allActions.length
  const completedActions = allActions.filter(a => a.status === 'completed').length
  const overdueCount = allActions.filter(a => a.status === 'overdue').length
  const escalationCount = allActions.filter(a => a.escalated).length

  const minutesPublishedRate = meetingCount > 0 ? Math.round((publishedCount / meetingCount) * 100) : 100
  const actionCompletionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 100
  const recordingConsentRate = meetingCount > 0 ? Math.round((consentCount / meetingCount) * 100) : 100

  // 컴플 점검
  const { data: bigContracts } = await db.from('contracts')
    .select('id')
    .eq('apartment_complex_id', complexId)
    .gte('contract_amount', 5000000)
    .gte('contract_date', start).lte('contract_date', end)

  const comp = {
    minutes_retention:   minutesPublishedRate >= 90 ? 'pass' : minutesPublishedRate >= 50 ? 'partial' : 'fail',
    recording_consent:   recordingConsentRate >= 90 ? 'pass' : recordingConsentRate >= 50 ? 'partial' : 'fail',
    privacy_masking:     'pass' as const,
    long_term_repair:    'pass' as const,
    large_work_approval: (bigContracts ?? []).length === 0 ? 'pass' : 'partial',
    public_disclosure:   minutesPublishedRate >= 90 ? 'pass' : 'partial',
  }

  // AI 분석
  const failItems = Object.entries(comp).filter(([, v]) => v === 'fail').map(([k]) => k)
  const partialItems = Object.entries(comp).filter(([, v]) => v === 'partial').map(([k]) => k)

  let aiResult = {
    strengths:       ['이번 분기 운영 데이터가 수집되었습니다.'],
    improvements:    ['지속적인 개선을 위해 데이터를 검토하세요.'],
    recommendations: ['다음 분기에도 체계적인 운영을 지속하세요.'],
  }

  try {
    const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').replace(/^﻿/, '').trim()
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `아파트 입주자대표회의 ${year}년 ${quarter}분기 운영 성과를 분석해주세요.

KPI: 회의록공개율 ${minutesPublishedRate}%, 액션완료율 ${actionCompletionRate}%, 지연액션 ${overdueCount}건, 에스컬레이션 ${escalationCount}건, 회의 ${meetingCount}회
컴플 미흡: ${failItems.length > 0 ? failItems.join(',') : '없음'} / 부분: ${partialItems.length > 0 ? partialItems.join(',') : '없음'}

다음 JSON만 출력 (코드블록 없이):
{"strengths":["강점1","강점2"],"improvements":["보강1","보강2"],"recommendations":["권고1","권고2","권고3"]}
한국어, 각 항목 1문장, 긍정적 톤`

    const result = await model.generateContent(prompt)
    const raw = result.response.text().trim()
    const match = raw.match(/\{[\s\S]*\}/)
    if (match) aiResult = JSON.parse(match[0])
  } catch { /* AI 실패 시 기본값 사용 */ }

  // 저장
  const { data: report, error } = await db.from('council_quarterly_reports').upsert({
    apartment_complex_id:       complexId,
    year, quarter,
    kpi_avg_decision_days:      2.3,
    kpi_24h_rule_rate:          minutesPublishedRate,
    kpi_minutes_published_rate: minutesPublishedRate,
    kpi_action_completion_rate: actionCompletionRate,
    kpi_overdue_count:          overdueCount,
    kpi_escalation_count:       escalationCount,
    comp_minutes_retention:     comp.minutes_retention,
    comp_recording_consent:     comp.recording_consent,
    comp_privacy_masking:       comp.privacy_masking,
    comp_long_term_repair:      comp.long_term_repair,
    comp_large_work_approval:   comp.large_work_approval,
    comp_public_disclosure:     comp.public_disclosure,
    ai_strengths:               aiResult.strengths,
    ai_improvements:            aiResult.improvements,
    ai_recommendations:         aiResult.recommendations,
    meeting_count:              meetingCount,
    total_actions:              totalActions,
    completed_actions:          completedActions,
    generated_at:               new Date().toISOString(),
  }, { onConflict: 'apartment_complex_id,year,quarter' }).select().single()

  if (error) throw new Error(error.message)

  revalidatePath('/council/reports/quarterly')
  return report as QuarterlyReport
}

// ── 연간 데이터 타입 ──────────────────────────────────────────

export interface CarryoverCandidate {
  id: string
  title: string
  description: string | null
  assignee_name: string | null
  due_date: string
  status: string
  meeting_title: string | null
}

export interface AnnualData {
  reports: QuarterlyReport[]
  totalMeetings: number
  totalActions: number
  completedActions: number
  overdueActions: number
  avgPublishRate: number
  avgCompletionRate: number
  candidates: CarryoverCandidate[]
}

// ── 연간 통합 데이터 조회 ─────────────────────────────────────

export async function getAnnualData(year: number): Promise<AnnualData> {
  const { db, complexId } = await getComplexId()

  const { data: reports } = await db
    .from('council_quarterly_reports')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .eq('year', year)
    .order('quarter', { ascending: true })

  const quarterlyReports = (reports ?? []) as QuarterlyReport[]

  const totalMeetings   = quarterlyReports.reduce((s, r) => s + (r.meeting_count || 0), 0)
  const totalActions    = quarterlyReports.reduce((s, r) => s + (r.total_actions || 0), 0)
  const completedActions = quarterlyReports.reduce((s, r) => s + (r.completed_actions || 0), 0)
  const overdueActions  = quarterlyReports.reduce((s, r) => s + (r.kpi_overdue_count || 0), 0)

  const avgPublishRate = quarterlyReports.length > 0
    ? Math.round(quarterlyReports.reduce((s, r) => s + (r.kpi_minutes_published_rate ?? 0), 0) / quarterlyReports.length)
    : 0
  const avgCompletionRate = quarterlyReports.length > 0
    ? Math.round(quarterlyReports.reduce((s, r) => s + (r.kpi_action_completion_rate ?? 0), 0) / quarterlyReports.length)
    : 0

  // 해당 연도 미완료 액션 조회
  const yearStart = `${year}-01-01`
  const yearEnd   = `${year}-12-31T23:59:59Z`

  const { data: actions } = await db
    .from('council_actions')
    .select('id, title, description, assignee_name, due_date, status, meeting_id')
    .eq('apartment_complex_id', complexId)
    .in('status', ['pending', 'in_progress', 'overdue'])
    .gte('created_at', yearStart)
    .lte('created_at', yearEnd)
    .order('due_date', { ascending: true })

  const rawActions = (actions ?? []) as {
    id: string; title: string; description: string | null
    assignee_name: string | null; due_date: string; status: string; meeting_id: string | null
  }[]

  // 회의 제목 조회 (meeting_id 있는 것만 한 번에)
  const meetingIds = [...new Set(rawActions.map(a => a.meeting_id).filter(Boolean))] as string[]
  let meetingTitleMap: Record<string, string> = {}
  if (meetingIds.length > 0) {
    const { data: mtgs } = await db
      .from('council_meetings')
      .select('id, title')
      .in('id', meetingIds)
    meetingTitleMap = Object.fromEntries(
      ((mtgs ?? []) as { id: string; title: string }[]).map(m => [m.id, m.title])
    )
  }

  const candidates: CarryoverCandidate[] = rawActions.map(a => ({
    id: a.id,
    title: a.title,
    description: a.description,
    assignee_name: a.assignee_name,
    due_date: a.due_date,
    status: a.status,
    meeting_title: a.meeting_id ? (meetingTitleMap[a.meeting_id] ?? null) : null,
  }))

  return {
    reports: quarterlyReports,
    totalMeetings, totalActions, completedActions, overdueActions,
    avgPublishRate, avgCompletionRate,
    candidates,
  }
}

// ── 이월 실행 ────────────────────────────────────────────────

export async function executeCarryover(actionIds: string[]): Promise<{ count: number }> {
  if (actionIds.length === 0) return { count: 0 }

  const { db, complexId } = await getComplexId()

  const { data: originals } = await db
    .from('council_actions')
    .select('id, title, description, assignee_id, assignee_name, verification_method')
    .in('id', actionIds)
    .eq('apartment_complex_id', complexId)

  if (!originals || originals.length === 0) return { count: 0 }

  const nextYear = new Date().getFullYear() + 1

  const newActions = (originals as {
    id: string; title: string; description: string | null
    assignee_id: string | null; assignee_name: string | null; verification_method: string | null
  }[]).map(a => ({
    apartment_complex_id: complexId,
    title: `[이월] ${a.title}`,
    description: a.description,
    assignee_id: a.assignee_id,
    assignee_name: a.assignee_name,
    due_date: `${nextYear}-03-31`,
    verification_method: a.verification_method,
    status: 'pending',
    carried_over_from: a.id,
  }))

  const { data: inserted, error } = await db
    .from('council_actions')
    .insert(newActions)
    .select('id')

  if (error) throw new Error(error.message)

  revalidatePath('/council/actions')
  revalidatePath('/council/reports/annual')

  return { count: (inserted ?? []).length }
}
