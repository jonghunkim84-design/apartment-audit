'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type MiscIncomeCategory = 'recycling' | 'parking' | 'rental' | 'interest' | 'penalty' | 'other'

export type MiscIncomeRow = {
  id: string
  apartment_complex_id: string
  category: MiscIncomeCategory
  amount: number
  description: string | null
  evidence_url: string | null
  income_date: string
  account_number: string | null
  payment_status: 'pending' | 'received'
  received_at: string | null
  waiver_rate: number | null
  created_by: string | null
  verified_by: string | null
  created_at: string
  // computed flags
  flag_missing_contract?: boolean
  flag_overdue?: boolean
  flag_excessive_waiver?: boolean
}

export type MiscIncomeAlert = {
  type: 'recycling_drop' | 'parking_waiver' | 'missing_contract' | 'interest_missing' | 'overdue'
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
}

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

function prevMonthKey(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthSum(rows: MiscIncomeRow[], month: string, cat: MiscIncomeCategory): number {
  return rows
    .filter((r) => r.income_date.startsWith(month) && r.category === cat)
    .reduce((s, r) => s + r.amount, 0)
}

function threeMonthAvg(rows: MiscIncomeRow[], fromMonth: string, cat: MiscIncomeCategory): number {
  let cursor = fromMonth
  let total = 0
  for (let i = 0; i < 3; i++) {
    cursor = prevMonthKey(cursor)
    total += monthSum(rows, cursor, cat)
  }
  return total / 3
}

// ── 이상 감지 ────────────────────────────────────────────────────────────────

function detectAlerts(rows: MiscIncomeRow[]): MiscIncomeAlert[] {
  const today = new Date()
  const thisMonth = today.toISOString().slice(0, 7)
  const lastMonth = prevMonthKey(thisMonth)
  const sixtyDaysAgo = new Date(today)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().slice(0, 10)

  const alerts: MiscIncomeAlert[] = []

  // 1. 재활용수입급감 — 전월 대비 30% 이상 감소
  const thisRec = monthSum(rows, thisMonth, 'recycling')
  const lastRec = monthSum(rows, lastMonth, 'recycling')
  if (lastRec > 0 && thisRec < lastRec * 0.7) {
    const pct = Math.round((1 - thisRec / lastRec) * 100)
    alerts.push({
      type: 'recycling_drop',
      title: '[재활용수입급감] 재활용 수입 30% 이상 감소',
      description: `전월 ${fmt(lastRec)} → 이번 달 ${fmt(thisRec)} (${pct}% 감소)`,
      severity: 'high',
    })
  }

  // 2. 주차감면과다 — waiver_rate > 0.2
  const excessWaiver = rows.filter((r) => r.category === 'parking' && (r.waiver_rate ?? 0) > 0.2)
  if (excessWaiver.length > 0) {
    alerts.push({
      type: 'parking_waiver',
      title: '[주차감면과다] 주차 감면율 20% 초과',
      description: `${excessWaiver.length}건 항목의 감면율이 20%를 초과합니다.`,
      severity: 'medium',
    })
  }

  // 3. 계약서미첨부 — rental이면서 evidence_url 없음
  const missingContract = rows.filter((r) => r.category === 'rental' && !r.evidence_url)
  if (missingContract.length > 0) {
    alerts.push({
      type: 'missing_contract',
      title: '[계약서미첨부] 광고/임대 계약서 파일 미첨부',
      description: `${missingContract.length}건의 광고/임대 항목에 계약서 파일이 없습니다.`,
      severity: 'medium',
    })
  }

  // 4. 이자미기록 — 직전 3개월 평균 대비 50% 미만
  const thisInterest = monthSum(rows, thisMonth, 'interest')
  const avgInterest = threeMonthAvg(rows, thisMonth, 'interest')
  if (avgInterest > 0 && thisInterest < avgInterest * 0.5) {
    alerts.push({
      type: 'interest_missing',
      title: '[이자미기록] 이자 수익 직전 3개월 평균 대비 50% 미만',
      description: `3개월 평균 ${fmt(Math.round(avgInterest))} 대비 이번 달 ${fmt(thisInterest)} 기록`,
      severity: 'high',
    })
  }

  // 5. 미수금회수필요 — payment_status=pending & income_date 60일 초과
  const overdue = rows.filter((r) => r.payment_status === 'pending' && r.income_date < sixtyDaysAgoStr)
  if (overdue.length > 0) {
    const total = overdue.reduce((s, r) => s + r.amount, 0)
    alerts.push({
      type: 'overdue',
      title: '[미수금회수필요] 미입금 60일 초과',
      description: `${overdue.length}건, 합계 ${fmt(total)} 미수금 회수 필요`,
      severity: 'high',
    })
  }

  return alerts
}

// ── 이상 감지 → audit_findings 자동 등록 ────────────────────────────────────

async function registerAnomalies(
  complexId: string,
  userId: string,
  alerts: MiscIncomeAlert[],
): Promise<void> {
  if (alerts.length === 0) return
  const supabase = await createClient()

  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)

  for (const alert of alerts) {
    // 최근 24h 내 같은 제목 open/investigating 소견 있으면 중복 생성 방지
    const { data: existing } = await supabase
      .from('audit_findings')
      .select('id')
      .eq('apartment_complex_id', complexId)
      .eq('title', alert.title)
      .in('status', ['open', 'investigating'])
      .gte('created_at', oneDayAgo.toISOString())
      .limit(1)

    if (!existing || existing.length === 0) {
      await supabase.from('audit_findings').insert({
        apartment_complex_id: complexId,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        status: 'open',
        created_by: userId,
      })
    }
  }
}

// ── 공개 액션 ────────────────────────────────────────────────────────────────

export async function getMiscIncomeData(): Promise<{
  rows: MiscIncomeRow[]
  alerts: MiscIncomeAlert[]
  complexId: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user!.id)
    .single()

  const complexId = profile?.apartment_complex_id ?? ''

  const { data, error } = await supabase
    .from('misc_income')
    .select('*')
    .eq('apartment_complex_id', complexId)
    .order('income_date', { ascending: false })

  if (error) throw new Error(error.message)

  const raw = (data ?? []) as MiscIncomeRow[]

  const today = new Date()
  const sixtyDaysAgo = new Date(today)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const sixtyDaysAgoStr = sixtyDaysAgo.toISOString().slice(0, 10)

  const rows: MiscIncomeRow[] = raw.map((r) => ({
    ...r,
    flag_missing_contract: r.category === 'rental' && !r.evidence_url,
    flag_overdue: r.payment_status === 'pending' && r.income_date < sixtyDaysAgoStr,
    flag_excessive_waiver: r.category === 'parking' && (r.waiver_rate ?? 0) > 0.2,
  }))

  const alerts = detectAlerts(rows)

  // 이상 소견 자동 등록 (중복 방지 포함)
  await registerAnomalies(complexId, user!.id, alerts)

  return { rows, alerts, complexId }
}

type CreateInput = {
  category: MiscIncomeCategory
  amount: number
  income_date: string
  description?: string
  account_number?: string
  payment_status?: 'pending' | 'received'
  received_at?: string
  waiver_rate?: number
}

export async function createMiscIncome(input: CreateInput): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user!.id)
    .single()

  const { error } = await supabase.from('misc_income').insert({
    apartment_complex_id: profile!.apartment_complex_id!,
    category: input.category,
    amount: input.amount,
    income_date: input.income_date,
    description: input.description || null,
    account_number: input.account_number || null,
    payment_status: input.payment_status ?? 'received',
    received_at: input.received_at || null,
    waiver_rate: input.waiver_rate ?? null,
    created_by: user!.id,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/misc-income')
}

export async function deleteMiscIncome(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('misc_income').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/misc-income')
}

export async function updatePaymentStatus(id: string, status: 'pending' | 'received'): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('misc_income').update({
    payment_status: status,
    received_at: status === 'received' ? new Date().toISOString().slice(0, 10) : null,
  }).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/misc-income')
}

export async function uploadMiscIncomeFile(id: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const file = formData.get('file') as File
  if (!file) throw new Error('파일이 없습니다.')

  const ext = file.name.split('.').pop()
  const path = `${id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('misc-income-evidence')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: signed } = await supabase.storage
    .from('misc-income-evidence')
    .createSignedUrl(path, 365 * 24 * 3600)

  const { error: updateError } = await supabase
    .from('misc_income')
    .update({ evidence_url: signed?.signedUrl ?? null })
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)
  revalidatePath('/misc-income')
}
