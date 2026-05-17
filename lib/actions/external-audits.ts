'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { computeHash } from '@/lib/evidence'

export type ExternalAuditRow = {
  id: string
  complex_id: string | null
  audit_year: number
  audit_firm: string
  auditor_name: string | null
  audit_date: string
  opinion: string | null
  report_url: string | null
  report_hash: string | null
  summary: string | null
  created_by: string | null
  created_at: string
}

export type FindingInput = {
  title: string
  description: string
  severity: 'high' | 'medium' | 'low'
  acfe_category: string
  remediation_due: string
}

export async function getExternalAudits(): Promise<ExternalAuditRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('단지 설정이 필요합니다.')

  const { data, error } = await supabase
    .from('external_audits')
    .select('*')
    .eq('complex_id', profile.apartment_complex_id)
    .order('audit_year', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as ExternalAuditRow[]
}

export async function getExternalAudit(id: string): Promise<ExternalAuditRow | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('external_audits')
    .select('*')
    .eq('id', id)
    .single()

  if (error) return null
  return data as ExternalAuditRow
}

export async function createExternalAudit(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('단지 설정이 필요합니다.')

  const complexId = profile.apartment_complex_id
  const auditYear = parseInt(formData.get('audit_year') as string)
  const auditFirm = (formData.get('audit_firm') as string).trim()
  const auditorName = (formData.get('auditor_name') as string)?.trim() || null
  const auditDate = formData.get('audit_date') as string
  const opinion = (formData.get('opinion') as string) || null
  const summary = (formData.get('summary') as string)?.trim() || null
  const file = formData.get('file') as File | null

  let reportUrl: string | null = null
  let reportHash: string | null = null

  if (file && file.size > 0) {
    const buffer = Buffer.from(await file.arrayBuffer())
    reportHash = computeHash(buffer)

    const ext = file.name.split('.').pop() ?? 'pdf'
    const storagePath = `${complexId}/${auditYear}/${Date.now()}.${ext}`

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('external-audits')
      .upload(storagePath, file, { contentType: file.type, upsert: false })

    if (uploadError) throw new Error(uploadError.message)

    const { data: signed } = await supabase.storage
      .from('external-audits')
      .createSignedUrl(uploadData.path, 365 * 24 * 3600)

    reportUrl = signed?.signedUrl ?? null
  }

  const { data, error } = await supabase
    .from('external_audits')
    .insert({
      complex_id: complexId,
      audit_year: auditYear,
      audit_firm: auditFirm,
      auditor_name: auditorName,
      audit_date: auditDate,
      opinion,
      report_url: reportUrl,
      report_hash: reportHash,
      summary,
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/external-audits')
  return data.id
}

export async function createExternalAuditFindings(
  externalAuditId: string,
  findings: FindingInput[]
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) throw new Error('단지 설정이 필요합니다.')

  const rows = findings
    .filter(f => f.title.trim())
    .map(f => ({
      apartment_complex_id: profile.apartment_complex_id!,
      title: f.title.trim(),
      description: f.acfe_category
        ? `[외부감사 · ACFE: ${f.acfe_category}] ${f.description}`
        : f.description || null,
      severity: f.severity,
      status: 'open',
      source: 'external',
      external_audit_id: externalAuditId,
      remediation_due: f.remediation_due || null,
      remediation_status: 'pending',
      created_by: user.id,
    }))

  if (rows.length === 0) throw new Error('지적사항을 최소 1건 입력하세요.')

  const { error } = await supabase.from('audit_findings').insert(rows)
  if (error) throw new Error(error.message)

  revalidatePath('/external-audits')
  revalidatePath('/findings')
}
