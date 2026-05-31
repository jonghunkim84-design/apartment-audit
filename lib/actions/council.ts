'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type {
  CouncilTerm,
  CouncilMeeting,
  CouncilMeetingMinutes,
  CouncilDecision,
  CouncilAction,
  MeetingType,
  LegalType,
  AgendaType,
  D1Classification,
  ActionStatus,
  AIMinutesResult,
} from '@/lib/council-types'

// ── 헬퍼 ───────────────────────────────────────────────────────

async function getComplexId() {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any   // 새 테이블은 database.ts 재생성 전까지 any 캐스팅
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('인증 필요')
  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) throw new Error('단지 미설정')
  return { supabase, db, user, complexId: profile.apartment_complex_id }
}

// ============================================================
// 회기 (Terms)
// ============================================================

export async function getActiveTerm(): Promise<CouncilTerm | null> {
  const { supabase, db, complexId } = await getComplexId()
  const { data } = await db
    .from('council_terms')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .eq('status', 'active')
    .order('term_number', { ascending: false })
    .limit(1)
    .single()
  return data as CouncilTerm | null
}

export async function createTerm(input: {
  term_number: number
  start_date: string
  end_date: string
}): Promise<CouncilTerm> {
  const { supabase, db, complexId } = await getComplexId()
  const { data, error } = await db
    .from('council_terms')
    .insert({ ...input, apartment_complex_id: complexId })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/council')
  return data as CouncilTerm
}

// ============================================================
// 회의 (Meetings)
// ============================================================

export async function getMeetings(filters?: {
  type?: MeetingType
  status?: string
  year?: number
}): Promise<CouncilMeeting[]> {
  const { supabase, db, complexId } = await getComplexId()
  let q = db
    .from('council_meetings')
    .select('*, council_meeting_minutes(*)')
    .eq('apartment_complex_id', complexId)
    .order('held_at', { ascending: false })

  if (filters?.type) q = q.eq('meeting_type', filters.type)
  if (filters?.status) q = q.eq('status', filters.status)
  if (filters?.year) {
    q = q
      .gte('held_at', `${filters.year}-01-01`)
      .lte('held_at', `${filters.year}-12-31`)
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CouncilMeeting[]
}

export async function getMeeting(id: string): Promise<CouncilMeeting | null> {
  const { supabase, db, complexId } = await getComplexId()
  const { data, error } = await db
    .from('council_meetings')
    .select(`
      *,
      council_meeting_minutes(*),
      council_decisions(*, council_actions(*))
    `)
    .eq('id', id)
    .eq('apartment_complex_id', complexId)
    .single()
  if (error) return null
  return data as CouncilMeeting
}

export async function createMeeting(input: {
  title: string
  meeting_type: MeetingType
  held_at: string
  location?: string
  quorum_required?: number
  quorum_present?: number
  quorum_met?: boolean
  recording_consent_confirmed: boolean
  term_id?: string
}): Promise<CouncilMeeting> {
  const { supabase, db, user, complexId } = await getComplexId()
  const { data, error } = await db
    .from('council_meetings')
    .insert({
      ...input,
      apartment_complex_id: complexId,
      created_by: user.id,
      status: 'scheduled',
    })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/council/meetings')
  return data as CouncilMeeting
}

export async function updateMeeting(id: string, input: Partial<{
  title: string
  status: string
  raw_transcript: string
  quorum_required: number
  quorum_present: number
  quorum_met: boolean
  location: string
}>): Promise<void> {
  const { supabase, db, complexId } = await getComplexId()
  const { error } = await db
    .from('council_meetings')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('apartment_complex_id', complexId)
  if (error) throw new Error(error.message)
  revalidatePath(`/council/meetings/${id}`)
}

// ============================================================
// 회의록 (Minutes)
// ============================================================

export async function saveMinutes(meetingId: string, result: AIMinutesResult): Promise<CouncilMeetingMinutes> {
  const { supabase, db, user, complexId } = await getComplexId()

  // 회의 소속 확인
  const { data: meeting } = await db
    .from('council_meetings')
    .select('id')
    .eq('id', meetingId)
    .eq('apartment_complex_id', complexId)
    .single()
  if (!meeting) throw new Error('접근 권한 없음')

  // 회의록 upsert
  const { data: minutes, error: mError } = await db
    .from('council_meeting_minutes')
    .upsert({
      meeting_id: meetingId,
      agenda_summary: result.agenda_summary,
      discussion_summary: result.discussion_summary,
      ai_generated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'meeting_id' })
    .select()
    .single()
  if (mError) throw new Error(mError.message)

  // 결정사항 + 액션 저장
  for (let i = 0; i < result.decisions.length; i++) {
    const d = result.decisions[i]
    const { data: decision, error: dError } = await db
    .from('council_decisions')
      .insert({
        meeting_id: meetingId,
        agenda_type: d.agenda_type,
        title: d.title,
        d1_classification: d.d1_classification,
        d2_definition: d.d2_definition,
        d3_criteria: d.d3_criteria,
        d4_execution: d.d4_execution,
        d5_feedback: d.d5_feedback,
        legal_type: d.legal_type,
        order_index: i,
      })
      .select()
      .single()
    if (dError) continue

    for (const a of d.actions) {
      await db.from('council_actions').insert({
        apartment_complex_id: complexId,
        meeting_id: meetingId,
        decision_id: decision.id,
        title: a.title,
        assignee_name: a.assignee_hint,
        due_date: a.due_date_hint,
        verification_method: a.verification_method,
        status: 'pending',
      })
    }
  }

  // 회의 상태 → completed
  await db
    .from('council_meetings')
    .update({ status: 'completed', updated_at: new Date().toISOString() })
    .eq('id', meetingId)

  revalidatePath(`/council/meetings/${meetingId}`)
  return minutes as CouncilMeetingMinutes
}

export async function publishMinutes(meetingId: string): Promise<void> {
  const { supabase, db, user, complexId } = await getComplexId()
  const { error } = await db
    .from('council_meeting_minutes')
    .update({
      published_at: new Date().toISOString(),
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('meeting_id', meetingId)
  if (error) throw new Error(error.message)
  revalidatePath(`/council/meetings/${meetingId}`)
}

// ============================================================
// 결정사항 (Decisions)
// ============================================================

export async function updateDecision(id: string, input: Partial<{
  title: string
  agenda_type: AgendaType
  d1_classification: D1Classification
  d2_definition: string
  d3_criteria: string
  d4_execution: string
  d5_feedback: string
  legal_type: LegalType
}>): Promise<void> {
  const { supabase, db } = await getComplexId()
  const { error } = await db
    .from('council_decisions')
    .update(input)
    .eq('id', id)
  if (error) throw new Error(error.message)
}

// ============================================================
// 액션 (Actions)
// ============================================================

export async function getActions(filters?: {
  status?: ActionStatus | 'all'
  assignee_id?: string
  overdue?: boolean
}): Promise<CouncilAction[]> {
  const { supabase, db, user, complexId } = await getComplexId()
  let q = db
    .from('council_actions')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .order('due_date', { ascending: true })

  if (filters?.status && filters.status !== 'all') {
    q = q.eq('status', filters.status)
  }
  if (filters?.assignee_id) q = q.eq('assignee_id', filters.assignee_id)
  if (filters?.overdue) {
    const today = new Date().toISOString().split('T')[0]
    q = q.lt('due_date', today).not('status', 'in', '("completed","cancelled")')
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as CouncilAction[]
}

export async function createAction(input: {
  meeting_id?: string
  decision_id?: string
  title: string
  description?: string
  assignee_id?: string
  assignee_name?: string
  due_date: string
  verification_method?: string
}): Promise<CouncilAction> {
  const { supabase, db, complexId } = await getComplexId()
  const { data, error } = await db
    .from('council_actions')
    .insert({ ...input, apartment_complex_id: complexId, status: 'pending' })
    .select()
    .single()
  if (error) throw new Error(error.message)
  revalidatePath('/council/actions')
  return data as CouncilAction
}

export async function updateActionStatus(id: string, status: ActionStatus, note?: string): Promise<void> {
  const { supabase, db, user } = await getComplexId()
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  }
  if (status === 'completed') {
    updates.completed_at = new Date().toISOString()
    updates.completed_by = user.id
    if (note) updates.completion_note = note
  }
  const { error } = await db
    .from('council_actions')
    .update(updates)
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/council/actions')
}

export async function escalateAction(id: string, toUserId: string): Promise<void> {
  const { supabase, db } = await getComplexId()
  const { error } = await db
    .from('council_actions')
    .update({
      escalated: true,
      escalated_at: new Date().toISOString(),
      escalated_to: toUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  // 인앱 알림 생성
  const { data: action } = await db
    .from('council_actions')
    .select('title')
    .eq('id', id)
    .single()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', toUserId)
    .single()

  if (action && profile?.apartment_complex_id) {
    await supabase.from('notifications').insert({
      user_id: toUserId,
      apartment_complex_id: profile.apartment_complex_id as string,
      title: '액션 에스컬레이션',
      message: `[대표회의] "${action.title}" 액션이 에스컬레이션되었습니다.`,
      severity: 'WARNING',
    })
  }
  revalidatePath('/council/actions')
}

// 매일 자동으로 overdue 상태 동기화 (API Route에서 호출)
export async function syncOverdueActions(complexId: string): Promise<number> {
  const { supabase, db } = await getComplexId()
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await db
    .from('council_actions')
    .update({ status: 'overdue', updated_at: new Date().toISOString() })
    .eq('apartment_complex_id', complexId)
    .eq('status', 'pending')
    .lt('due_date', today)
    .select('id')
  if (error) throw new Error(error.message)
  return (data ?? []).length
}





