'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

// ── 기본 체크리스트 항목 ─────────────────────────────────────

export const DEFAULT_CHECKLIST = [
  // Section A — 단지 현황
  { id: 'a1', section: 'A', label: '진행 중 액션 목록 정리 및 이관', checked: false },
  { id: 'a2', section: 'A', label: '진행 중 공사·계약 현황 입력 완료', checked: false },
  { id: 'a3', section: 'A', label: '주요 업체·기관 연락처 확인 및 이관', checked: false },
  // Section B — 시스템 접근 권한
  { id: 'b1', section: 'B', label: '카카오 단체방 관리자 권한 이전', checked: false },
  { id: 'b2', section: 'B', label: '구글 드라이브 접근 권한 이전', checked: false },
  { id: 'b3', section: 'B', label: '신임 동대표 시스템 계정 생성 완료', checked: false },
  // Section C — 문서 인계
  { id: 'c1', section: 'C', label: '관리규약 최신본 전달', checked: false },
  { id: 'c2', section: 'C', label: '장기수선계획 최신본 전달', checked: false },
  { id: 'c3', section: 'C', label: 'P2 회의록 표준 운영 매뉴얼 전달', checked: false },
  // Section D — 미해결 사항
  { id: 'd1', section: 'D', label: '컴플 즉시 시정 미완료 항목 전달', checked: false },
  { id: 'd2', section: 'D', label: '진행 중 장기 공사·용역 현황 전달', checked: false },
  { id: 'd3', section: 'D', label: '반복 민원 현황 전달', checked: false },
] as const

export type ChecklistItem = { id: string; section: string; label: string; checked: boolean }

// ── 타입 ─────────────────────────────────────────────────────

export interface Handover {
  id: string
  apartment_complex_id: string
  handover_date: string
  checklist: ChecklistItem[]
  ongoing_works: string | null
  key_contacts: string | null
  notes: string | null
  completed_by: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
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
  return { db, user, complexId: profile.apartment_complex_id as string }
}

// ── 인수인계 조회 ─────────────────────────────────────────────

export async function getLatestHandover(): Promise<Handover | null> {
  const { db, complexId } = await getComplexId()
  const { data } = await db
    .from('council_handovers')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return data as Handover | null
}

// ── 인수인계 저장 (upsert) ────────────────────────────────────

export async function saveHandover(input: {
  id?: string
  checklist: ChecklistItem[]
  ongoing_works: string
  key_contacts: string
  notes: string
}): Promise<Handover> {
  const { db, complexId } = await getComplexId()

  const payload = {
    apartment_complex_id: complexId,
    handover_date: new Date().toISOString().split('T')[0],
    checklist: input.checklist,
    ongoing_works: input.ongoing_works || null,
    key_contacts: input.key_contacts || null,
    notes: input.notes || null,
    updated_at: new Date().toISOString(),
  }

  let data, error
  if (input.id) {
    ;({ data, error } = await db
      .from('council_handovers')
      .update(payload)
      .eq('id', input.id)
      .eq('apartment_complex_id', complexId)
      .select()
      .single())
  } else {
    ;({ data, error } = await db
      .from('council_handovers')
      .insert(payload)
      .select()
      .single())
  }

  if (error) throw new Error(error.message)
  revalidatePath('/council/handover')
  return data as Handover
}

// ── 인계 완료 처리 ────────────────────────────────────────────

export async function completeHandover(id: string): Promise<void> {
  const { db, user, complexId } = await getComplexId()
  const { error } = await db
    .from('council_handovers')
    .update({
      completed_by: user.id,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('apartment_complex_id', complexId)

  if (error) throw new Error(error.message)
  revalidatePath('/council/handover')
}

// ── 온보딩: 미결 액션 수 조회 ─────────────────────────────────

export async function getPendingActionsCount(): Promise<number> {
  const { db, complexId } = await getComplexId()
  const { count } = await db
    .from('council_actions')
    .select('id', { count: 'exact', head: true })
    .eq('apartment_complex_id', complexId)
    .in('status', ['pending', 'in_progress', 'overdue'])
  return count ?? 0
}
