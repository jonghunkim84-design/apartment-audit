import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return NextResponse.json({ error: 'No complex' }, { status: 400 })

  const year = request.nextUrl.searchParams.get('year')

  let query = supabase
    .from('external_audits')
    .select('*')
    .eq('complex_id', profile.apartment_complex_id)
    .order('audit_year', { ascending: false })

  if (year) query = query.eq('audit_year', parseInt(year))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

type AuditBody = {
  audit: {
    audit_year: number
    audit_firm: string
    auditor_name?: string
    audit_date: string
    opinion?: string
    summary?: string
  }
  findings?: Array<{
    title: string
    description?: string
    severity?: 'high' | 'medium' | 'low'
    acfe_category?: string
    remediation_due?: string
  }>
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return NextResponse.json({ error: 'No complex' }, { status: 400 })

  const body = await request.json() as AuditBody
  const { audit, findings = [] } = body

  const { data: auditData, error: auditError } = await supabase
    .from('external_audits')
    .insert({
      complex_id: profile.apartment_complex_id,
      audit_year: audit.audit_year,
      audit_firm: audit.audit_firm,
      auditor_name: audit.auditor_name ?? null,
      audit_date: audit.audit_date,
      opinion: audit.opinion ?? null,
      summary: audit.summary ?? null,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (auditError) return NextResponse.json({ error: auditError.message }, { status: 500 })

  if (findings.length > 0) {
    const findingRows = findings.map(f => ({
      apartment_complex_id: profile.apartment_complex_id!,
      title: f.title,
      description: f.acfe_category
        ? `[외부감사 · ACFE: ${f.acfe_category}] ${f.description ?? ''}`
        : f.description ?? null,
      severity: f.severity ?? 'medium',
      status: 'open',
      source: 'external',
      external_audit_id: auditData.id,
      remediation_due: f.remediation_due ?? null,
      remediation_status: 'pending',
      created_by: user.id,
    }))

    const { error: findingsError } = await supabase.from('audit_findings').insert(findingRows)
    if (findingsError) return NextResponse.json({ error: findingsError.message }, { status: 500 })
  }

  return NextResponse.json({ id: auditData.id, findingsCount: findings.length })
}
