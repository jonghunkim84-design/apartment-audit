'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { Json } from '@/types/database'

export type DisclosureType = 'monthly_expenses' | 'misc_income' | 'long_term_repair' | 'audit_report'

export interface PublicDisclosure {
  id: string
  disclosure_type: string
  period: string
  title: string
  data: Record<string, unknown>
  report_pdf_url: string | null
  kapt_match: boolean | null
  approved_at: string
  is_active: boolean
}

async function getComplexId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) throw new Error('No complex')
  return { supabase, user, complexId: profile.apartment_complex_id }
}

export async function getDisclosures(): Promise<PublicDisclosure[]> {
  const { supabase, complexId } = await getComplexId()
  const { data } = await supabase
    .from('public_disclosures')
    .select('id,disclosure_type,period,title,data,report_pdf_url,kapt_match,approved_at,is_active')
    .eq('apartment_complex_id', complexId)
    .order('period', { ascending: false })
  return (data ?? []) as PublicDisclosure[]
}

export async function getAvailablePeriods() {
  const { supabase, complexId } = await getComplexId()

  const [{ data: receiptRows }, { data: miscRows }, { data: repairRows }, { data: findingRows }] =
    await Promise.all([
      supabase.from('receipts').select('receipt_date').eq('apartment_complex_id', complexId).eq('status', 'approved'),
      supabase.from('misc_income').select('income_date').eq('apartment_complex_id', complexId),
      supabase.from('long_term_repair').select('year').eq('apartment_complex_id', complexId),
      supabase.from('audit_findings').select('created_at').eq('apartment_complex_id', complexId),
    ])

  const toQuarter = (dateStr: string | null) => {
    if (!dateStr) return null
    const d = new Date(dateStr)
    return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`
  }

  const uniq = <T>(arr: (T | null)[]) =>
    [...new Set(arr.filter(Boolean) as T[])].sort().reverse()

  return {
    monthly_expenses: uniq(
      (receiptRows ?? []).map(r => r.receipt_date?.slice(0, 7) ?? null)
    ) as string[],
    misc_income: uniq(
      (miscRows ?? []).map(r => toQuarter(r.income_date))
    ) as string[],
    long_term_repair: uniq(
      (repairRows ?? []).map(r => (r.year ? String(r.year) : null))
    ) as string[],
    audit_report: uniq(
      (findingRows ?? []).map(r => toQuarter(r.created_at))
    ) as string[],
  }
}

export async function approveDisclosure(type: DisclosureType, period: string) {
  const { supabase, user, complexId } = await getComplexId()

  const { data: complex } = await supabase
    .from('apartment_complexes')
    .select('unit_count, public_code')
    .eq('id', complexId)
    .single()

  const data = await computeData(supabase, complexId, type, period)

  // K-apt 일치 여부 (monthly_expenses만)
  let kapt_match: boolean | null = null
  if (type === 'monthly_expenses' && complex?.unit_count) {
    const { data: kaptRows } = await supabase
      .from('kapt_comparison')
      .select('our_amount')
      .eq('apartment_complex_id', complexId)
      .eq('year_month', period)
    if (kaptRows && kaptRows.length > 0) {
      const kaptTotal = kaptRows.reduce((s, r) => s + (r.our_amount ?? 0), 0)
      const internalPerUnit = Math.round((data as { total_expense: number }).total_expense / complex.unit_count)
      kapt_match = Math.abs(kaptTotal - internalPerUnit) / Math.max(kaptTotal, 1) < 0.2
    }
  }

  const { error } = await supabase
    .from('public_disclosures')
    .upsert({
      apartment_complex_id: complexId,
      disclosure_type: type,
      period,
      title: buildTitle(type, period),
      data: data as unknown as Json,
      kapt_match,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
      is_active: true,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'apartment_complex_id,disclosure_type,period' })

  if (error) throw new Error(error.message)
  revalidatePath('/disclosure')
  return { publicCode: complex?.public_code }
}

export async function revokeDisclosure(id: string) {
  const { supabase } = await getComplexId()
  const { error } = await supabase
    .from('public_disclosures')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/disclosure')
}

function buildTitle(type: DisclosureType, period: string) {
  switch (type) {
    case 'monthly_expenses':  return `${period} 관리비 지출 내역`
    case 'misc_income':       return `${period} 잡수입 현황`
    case 'long_term_repair':  return `${period}년 장기수선충당금 현황`
    case 'audit_report':      return `${period} 감사 결과 요약`
  }
}

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function computeData(
  supabase: SupabaseClient,
  complexId: string,
  type: DisclosureType,
  period: string
): Promise<unknown> {
  switch (type) {
    case 'monthly_expenses': {
      const { data: rows } = await supabase
        .from('receipts')
        .select('merchant_name, amount, receipt_date, merchant_category, policy_flags')
        .eq('apartment_complex_id', complexId)
        .eq('status', 'approved')
        .like('receipt_date', `${period}%`)

      const items = rows ?? []
      const total_expense = items.reduce((s, r) => s + (r.amount ?? 0), 0)

      const catMap: Record<string, { amount: number; count: number }> = {}
      for (const r of items) {
        const cat = r.merchant_category ?? '기타'
        catMap[cat] ??= { amount: 0, count: 0 }
        catMap[cat].amount += r.amount ?? 0
        catMap[cat].count++
      }

      return {
        year_month: period,
        total_expense,
        receipt_count: items.length,
        by_category: Object.entries(catMap)
          .map(([category, v]) => ({ category, ...v }))
          .sort((a, b) => b.amount - a.amount),
        // 비식별: 상호명·금액·일자만 유지
        receipts: items.map(r => ({
          merchant_name: r.merchant_name,
          amount: r.amount,
          receipt_date: r.receipt_date,
          category: r.merchant_category ?? '기타',
          flagged: !!(r.policy_flags && Object.keys(r.policy_flags as object).length > 0),
        })),
      }
    }

    case 'misc_income': {
      const [yearStr, qStr] = period.split('-Q')
      const year = parseInt(yearStr)
      const quarter = parseInt(qStr)
      const sm = (quarter - 1) * 3 + 1
      const em = quarter * 3
      const start = `${year}-${String(sm).padStart(2, '0')}-01`
      const end   = `${year}-${String(em).padStart(2, '0')}-31`

      const { data: rows } = await supabase
        .from('misc_income')
        .select('category, amount, income_date')
        .eq('apartment_complex_id', complexId)
        .gte('income_date', start)
        .lte('income_date', end)

      const items = rows ?? []
      const total = items.reduce((s, r) => s + (r.amount ?? 0), 0)
      const typeMap: Record<string, { amount: number; count: number }> = {}
      for (const r of items) {
        const t = r.category ?? 'other'
        typeMap[t] ??= { amount: 0, count: 0 }
        typeMap[t].amount += r.amount ?? 0
        typeMap[t].count++
      }

      return {
        period, year, quarter, total,
        by_type: Object.entries(typeMap)
          .map(([type, v]) => ({ type, ...v }))
          .sort((a, b) => b.amount - a.amount),
      }
    }

    case 'long_term_repair': {
      const year = parseInt(period)
      const { data: rows } = await supabase
        .from('long_term_repair')
        .select('year, month, planned_amount, actual_amount, balance')
        .eq('apartment_complex_id', complexId)
        .eq('year', year)
        .order('month', { ascending: true, nullsFirst: true })

      const items = rows ?? []
      const balance    = items.at(-1)?.balance ?? 0
      const planned    = items.reduce((s, r) => s + (r.planned_amount ?? 0), 0)
      const actual     = items.reduce((s, r) => s + (r.actual_amount ?? 0), 0)
      const exec_rate  = planned > 0 ? Math.round(actual / planned * 100) : 0

      return { period, year, balance, planned_amount: planned, actual_amount: actual, exec_rate, entries: items }
    }

    case 'audit_report': {
      const [yearStr, qStr] = period.split('-Q')
      const year = parseInt(yearStr)
      const quarter = parseInt(qStr)
      const sm = (quarter - 1) * 3 + 1
      const em = quarter * 3
      const start = `${year}-${String(sm).padStart(2, '0')}-01`
      const end   = new Date(year, em, 0).toISOString().slice(0, 10)

      const { data: findings } = await supabase
        .from('audit_findings')
        .select('severity, status')
        .eq('apartment_complex_id', complexId)
        .gte('created_at', start)
        .lte('created_at', end + 'T23:59:59Z')

      const items = findings ?? []
      const high     = items.filter(f => f.severity === 'high').length
      const medium   = items.filter(f => f.severity === 'medium').length
      const low      = items.filter(f => f.severity === 'low').length
      const resolved = items.filter(f => f.status === 'resolved').length

      return {
        period, year, quarter,
        findings_count: items.length,
        high_severity: high, medium_severity: medium, low_severity: low, resolved_count: resolved,
        summary: `${period} 감사 결과 총 ${items.length}건의 지적사항이 검토되었으며, 이 중 ${resolved}건이 조치 완료되었습니다.`,
      }
    }
  }
}
