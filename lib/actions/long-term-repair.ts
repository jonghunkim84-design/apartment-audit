'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createNotificationsForComplex } from '@/lib/notifications/create'

export type LongTermRepairRow = {
  id: string
  apartment_complex_id: string
  year: number
  month: number | null
  planned_amount: number
  actual_amount: number
  balance: number
  description: string | null
  file_url: string | null
  is_unplanned: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type CreateRepairInput = {
  year: number
  month: number | null
  planned_amount: number
  actual_amount: number
  balance: number
  description?: string
}

async function getProfile(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('아파트 단지가 설정되지 않았습니다.')
  return { user, complexId: profile.apartment_complex_id }
}

export async function getLongTermRepairData(): Promise<LongTermRepairRow[]> {
  const supabase = await createClient()
  const { complexId } = await getProfile(supabase)

  const { data } = await supabase
    .from('long_term_repair')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .order('year', { ascending: false })
    .order('month', { ascending: false, nullsFirst: false })

  return (data ?? []) as LongTermRepairRow[]
}

export async function createRepairEntry(input: CreateRepairInput): Promise<void> {
  const supabase = await createClient()
  const { user, complexId } = await getProfile(supabase)

  const isUnplanned = input.actual_amount > input.planned_amount

  const { data: entry, error } = await supabase
    .from('long_term_repair')
    .insert({
      apartment_complex_id: complexId,
      year: input.year,
      month: input.month ?? null,
      planned_amount: input.planned_amount,
      actual_amount: input.actual_amount,
      balance: input.balance,
      description: input.description ?? null,
      is_unplanned: isUnplanned,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // 계획 외 집행 → audit_findings CRITICAL 자동 등록 + 알림
  if (isUnplanned && entry) {
    const periodLabel = input.month ? `${input.year}년 ${input.month}월` : `${input.year}년`
    const overAmount = input.actual_amount - input.planned_amount
    const findingTitle = `[장기수선] 계획 외 초과 집행 (${periodLabel})`
    const findingMessage = `계획액 ${input.planned_amount.toLocaleString()}원 대비 실행액 ${input.actual_amount.toLocaleString()}원 초과. 초과분: ${overAmount.toLocaleString()}원`

    await supabase.from('audit_findings').insert({
      apartment_complex_id: complexId,
      title: findingTitle,
      description: findingMessage,
      severity: 'critical',
      status: 'open',
      created_by: user.id,
    })

    await createNotificationsForComplex({
      complexId,
      actorUserId: user.id,
      title: findingTitle,
      message: findingMessage,
      severity: 'CRITICAL',
      category: 'long_term_repair',
      referenceId: entry.id,
    })
  }

  revalidatePath('/long-term-repair')
  revalidatePath('/dashboard')
}

export async function deleteRepairEntry(id: string): Promise<void> {
  const supabase = await createClient()
  await getProfile(supabase)

  const { error } = await supabase
    .from('long_term_repair')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/long-term-repair')
  revalidatePath('/dashboard')
}

export async function uploadRepairFile(id: string, formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { complexId } = await getProfile(supabase)

  const file = formData.get('file') as File
  if (!file || file.size === 0) throw new Error('파일이 없습니다.')
  if (file.size > 10 * 1024 * 1024) throw new Error('파일 크기는 10MB 이하여야 합니다.')

  const ext = file.name.split('.').pop()
  const path = `${complexId}/long-term-repair/${id}/${Date.now()}.${ext}`

  const { data: storageData, error: uploadError } = await supabase.storage
    .from('checklist-evidence')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: signed } = await supabase.storage
    .from('checklist-evidence')
    .createSignedUrl(storageData.path, 60 * 60 * 24 * 365)

  const url = signed?.signedUrl ?? storageData.path

  const { error } = await supabase
    .from('long_term_repair')
    .update({ file_url: url })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/long-term-repair')
  return url
}

// 대시보드 경고용: 12개월 내 고갈 예상 여부 계산
export type DepletionStatus = {
  warn: boolean
  latestBalance: number | null
  avgMonthly: number
  estimatedMonths: number | null
}

export async function getDepletionStatus(complexId: string): Promise<DepletionStatus> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('long_term_repair')
    .select('year, month, actual_amount, balance')
    .eq('apartment_complex_id', complexId)
    .order('year', { ascending: false })
    .order('month', { ascending: false, nullsFirst: false })
    .limit(13)

  const rows = (data ?? []) as Pick<LongTermRepairRow, 'year' | 'month' | 'actual_amount' | 'balance'>[]

  const latestBalance = rows.length > 0 ? rows[0].balance : null
  const monthly = rows.filter(r => r.month !== null).slice(0, 12)
  const avgMonthly = monthly.length > 0
    ? monthly.reduce((s, r) => s + r.actual_amount, 0) / monthly.length
    : 0

  const estimatedMonths = (latestBalance !== null && avgMonthly > 0)
    ? Math.floor(latestBalance / avgMonthly)
    : null

  return {
    warn: estimatedMonths !== null && estimatedMonths < 12,
    latestBalance,
    avgMonthly,
    estimatedMonths,
  }
}
