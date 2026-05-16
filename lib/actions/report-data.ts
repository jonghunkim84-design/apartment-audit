import { createClient } from '@/lib/supabase/server'

export type ReportData = {
  apartment: { name: string; address: string | null; unit_count: number | null }
  auditor: { full_name: string | null; email: string | null }
  period: { from: string; to: string }
  generatedAt: string

  receipts: {
    total: number
    flagged: number
    totalAmount: number
  }

  flaggedReceipts: Array<{
    id: string
    receipt_date: string | null
    merchant_name: string | null
    amount: number | null
    status: string
    policy_flags: unknown
    review_note: string | null
  }>

  findings: Array<{
    id: string
    title: string
    description: string | null
    severity: string
    status: string
    created_at: string | null
  }>

  reconsiderations: Array<{
    id: string
    law_reference: string
    content: string
    status: string
    sent_at: string
    resolved_at: string | null
    resolution: string | null
  }>

  miscIncome: {
    byCategory: Record<string, number>
    total: number
    pendingCount: number
  }

  longTermRepair: {
    totalPlanned: number
    totalActual: number
    unplannedCount: number
    executionRate: number
  }
}

export async function fetchReportData(from: string, to: string): Promise<ReportData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id, full_name, email')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('No apartment complex')

  const complexId = profile.apartment_complex_id

  const { data: apartment } = await supabase
    .from('apartment_complexes')
    .select('name, address, unit_count')
    .eq('id', complexId)
    .single()

  const { data: receipts } = await supabase
    .from('receipts')
    .select('id, status, amount, policy_flags, merchant_name, receipt_date, review_note')
    .eq('apartment_complex_id', complexId)
    .gte('receipt_date', from)
    .lte('receipt_date', to)

  const allReceipts = receipts ?? []
  const flaggedReceipts = allReceipts.filter(
    (r) => r.status === 'manual_review' || r.status === 'rejected',
  )
  const totalAmount = allReceipts.reduce((s, r) => s + (r.amount ?? 0), 0)

  const { data: findings } = await supabase
    .from('audit_findings')
    .select('id, title, description, severity, status, created_at')
    .eq('apartment_complex_id', complexId)
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: false })

  const { data: reconsiderations } = await supabase
    .from('reconsideration_requests')
    .select('id, law_reference, content, status, sent_at, resolved_at, resolution')
    .eq('apartment_complex_id', complexId)
    .gte('sent_at', from)
    .lte('sent_at', `${to}T23:59:59`)
    .order('sent_at', { ascending: false })

  const { data: miscIncomeRows } = await supabase
    .from('misc_income')
    .select('category, amount, payment_status')
    .eq('apartment_complex_id', complexId)
    .gte('income_date', from)
    .lte('income_date', to)

  const byCategory: Record<string, number> = {}
  let miscTotal = 0
  let pendingCount = 0
  for (const row of miscIncomeRows ?? []) {
    byCategory[row.category] = (byCategory[row.category] ?? 0) + row.amount
    miscTotal += row.amount
    if (row.payment_status === 'pending') pendingCount++
  }

  const fromYear = parseInt(from.slice(0, 4))
  const toYear = parseInt(to.slice(0, 4))
  const { data: ltrRows } = await supabase
    .from('long_term_repair')
    .select('planned_amount, actual_amount, is_unplanned')
    .eq('apartment_complex_id', complexId)
    .gte('year', fromYear)
    .lte('year', toYear)

  const totalPlanned = (ltrRows ?? []).reduce((s, r) => s + r.planned_amount, 0)
  const totalActual = (ltrRows ?? []).reduce((s, r) => s + r.actual_amount, 0)
  const unplannedCount = (ltrRows ?? []).filter((r) => r.is_unplanned).length
  const executionRate = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0

  return {
    apartment: apartment ?? { name: '아파트', address: null, unit_count: null },
    auditor: { full_name: profile.full_name, email: profile.email },
    period: { from, to },
    generatedAt: new Date().toISOString(),

    receipts: {
      total: allReceipts.length,
      flagged: flaggedReceipts.length,
      totalAmount,
    },

    flaggedReceipts: flaggedReceipts.map((r) => ({
      id: r.id,
      receipt_date: r.receipt_date,
      merchant_name: r.merchant_name,
      amount: r.amount,
      status: r.status,
      policy_flags: r.policy_flags,
      review_note: r.review_note,
    })),

    findings: findings ?? [],
    reconsiderations: reconsiderations ?? [],

    miscIncome: { byCategory, total: miscTotal, pendingCount },

    longTermRepair: { totalPlanned, totalActual, unplannedCount, executionRate },
  }
}
