'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export type FindingRow = {
  id: string
  title: string
  description: string | null
  severity: string
  status: string
  receipt_id: string | null
  created_at: string | null
  updated_at: string | null
}

export async function getFindings(): Promise<FindingRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return []

  const { data } = await supabase
    .from('audit_findings')
    .select('id, title, description, severity, status, receipt_id, created_at, updated_at')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .order('created_at', { ascending: false })

  return (data ?? []) as FindingRow[]
}

export async function updateFindingStatus(id: string, status: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('audit_findings')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/findings')
}
