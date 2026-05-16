'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Tables } from '@/types/database'

export type ChecklistItem = Tables<'audit_checklist_items'>
export type Checklist = Pick<Tables<'audit_checklists'>, 'id' | 'title' | 'status' | 'period_start' | 'period_end'>

const QUARTERLY_ITEMS = [
  { item_text: '관리비 수입·지출 내역 원장 대조', category: '월간' },
  { item_text: '통장 잔고 현황 확인', category: '월간' },
  { item_text: '장기수선충당금 적립·집행 적정성 검토', category: '분기' },
  { item_text: '관리규약 위반 사항 확인', category: '분기' },
  { item_text: '사업자 선정지침 준수 여부', category: '건별' },
  { item_text: '계약서 이행 현황 점검', category: '반기' },
  { item_text: '재활용품·광고 수익 잡수입 적립 현황', category: '분기' },
  { item_text: '장기수선계획 이행 실적 vs 계획 대조', category: '반기' },
  { item_text: '외부 회계감사 협조 자료 준비', category: '연간' },
] as const

function getQuarterRange(): { start: string; end: string; title: string } {
  const now = new Date()
  const year = now.getFullYear()
  const q = Math.floor(now.getMonth() / 3) + 1
  const startMonth = (q - 1) * 3
  const endMonth = q * 3 - 1
  const start = `${year}-${String(startMonth + 1).padStart(2, '0')}-01`
  const end = new Date(year, endMonth + 1, 0).toISOString().slice(0, 10)
  return { start, end, title: `${year}년 ${q}분기 감사 체크리스트` }
}

export async function getOrCreateChecklist(): Promise<{ checklist: Checklist; items: ChecklistItem[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('아파트 단지가 설정되지 않았습니다.')

  const { start, end, title } = getQuarterRange()

  const { data: existing } = await supabase
    .from('audit_checklists')
    .select('id, title, status, period_start, period_end')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .eq('period_start', start)
    .maybeSingle()

  if (existing) {
    const { data: items } = await supabase
      .from('audit_checklist_items')
      .select('*')
      .eq('checklist_id', existing.id)
      .order('created_at', { ascending: true })
    return { checklist: existing, items: items ?? [] }
  }

  const { data: newChecklist, error: checklistError } = await supabase
    .from('audit_checklists')
    .insert({
      apartment_complex_id: profile.apartment_complex_id,
      title,
      period_start: start,
      period_end: end,
      created_by: user.id,
      status: 'in_progress',
    })
    .select('id, title, status, period_start, period_end')
    .single()

  if (checklistError || !newChecklist) throw new Error(checklistError?.message ?? '체크리스트 생성 실패')

  const { data: items, error: itemsError } = await supabase
    .from('audit_checklist_items')
    .insert(
      QUARTERLY_ITEMS.map(item => ({
        checklist_id: newChecklist.id,
        item_text: item.item_text,
        category: item.category,
        status: 'pending' as const,
      }))
    )
    .select('*')

  if (itemsError) throw new Error(itemsError.message)
  return { checklist: newChecklist, items: items ?? [] }
}

export async function toggleChecklistItem(itemId: string, checked: boolean): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('audit_checklist_items')
    .update({
      status: checked ? 'pass' : 'pending',
      checked_by: checked ? user.id : null,
      checked_at: checked ? new Date().toISOString() : null,
    })
    .eq('id', itemId)

  if (error) throw error
  revalidatePath('/audit')
}

export async function updateChecklistItemNote(itemId: string, note: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('audit_checklist_items')
    .update({ note: note.trim() || null })
    .eq('id', itemId)

  if (error) throw error
}

export async function uploadChecklistEvidence(
  itemId: string,
  checklistId: string,
  formData: FormData
): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()

  const file = formData.get('file') as File
  if (!file || file.size === 0) throw new Error('파일이 없습니다.')
  if (file.size > 10 * 1024 * 1024) throw new Error('파일 크기는 10MB 이하여야 합니다.')

  const ext = file.name.split('.').pop()
  const path = `${profile?.apartment_complex_id}/${checklistId}/${itemId}/${Date.now()}.${ext}`

  const { data: storageData, error: uploadError } = await supabase.storage
    .from('checklist-evidence')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadError) throw uploadError

  const { data: signed } = await supabase.storage
    .from('checklist-evidence')
    .createSignedUrl(storageData.path, 60 * 60 * 24 * 365)

  const url = signed?.signedUrl ?? storageData.path

  const { error: updateError } = await supabase
    .from('audit_checklist_items')
    .update({ evidence_url: url })
    .eq('id', itemId)

  if (updateError) throw updateError
  revalidatePath('/audit')
  return url
}

export async function removeChecklistEvidence(itemId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('audit_checklist_items')
    .update({ evidence_url: null })
    .eq('id', itemId)

  if (error) throw error
  revalidatePath('/audit')
}
