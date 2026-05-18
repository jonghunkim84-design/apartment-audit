import { createClient } from '@/lib/supabase/server'

export type QuarterlyReportData = {
  apartment: { name: string; address: string | null }
  auditor: { full_name: string | null }
  period: { from: string; to: string }
  quarter: number
  year: number
  target: string
  supervisee: string
  reportTitle: string
  generatedAt: string
  findings: Array<{
    id: string
    title: string
    description: string | null
    severity: string
    status: string
    remediation_note: string | null
    remediation_due: string | null
    resolved_at: string | null
    created_at: string | null
  }>
}

export async function fetchQuarterlyReportData(
  from: string,
  to: string,
  target: string,
  supervisee: string,
  reportTitle: string,
): Promise<QuarterlyReportData> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('No apartment complex')

  const complexId = profile.apartment_complex_id

  const { data: apartment } = await supabase
    .from('apartment_complexes')
    .select('name, address')
    .eq('id', complexId)
    .single()

  const { data: findings } = await supabase
    .from('audit_findings')
    .select('id, title, description, severity, status, remediation_note, remediation_due, resolved_at, created_at')
    .eq('apartment_complex_id', complexId)
    .gte('created_at', from)
    .lte('created_at', `${to}T23:59:59`)
    .order('created_at', { ascending: true })

  const fromDate = new Date(from)
  const month = fromDate.getMonth() + 1
  const quarter = Math.ceil(month / 3)
  const year = fromDate.getFullYear()

  return {
    apartment: apartment ?? { name: '아파트', address: null },
    auditor: { full_name: profile.full_name },
    period: { from, to },
    quarter,
    year,
    target,
    supervisee,
    reportTitle,
    generatedAt: new Date().toISOString(),
    findings: findings ?? [],
  }
}
