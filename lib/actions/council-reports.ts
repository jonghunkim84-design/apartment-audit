'use server'

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

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

// ── 분기 보고서 생성 (API 라우트 호출) ──────────────────────────

export async function generateQuarterlyReport(year: number, quarter: number): Promise<QuarterlyReport> {
  const cookieStore = await cookies()
  const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join('; ')

  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const res = await fetch(`${baseUrl}/api/council/generate-quarterly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
    body: JSON.stringify({ year, quarter }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error || '분기 보고서 생성 실패')
  }

  const { report } = await res.json() as { report: QuarterlyReport }
  revalidatePath('/council/reports/quarterly')
  return report
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
