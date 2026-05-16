'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ReconStatus = 'SENT' | 'RECEIVED' | 'RESOLVED' | 'ESCALATED'

export type ReconsiderationRow = {
  id: string
  apartment_complex_id: string
  law_reference: string
  content: string
  document_url: string | null
  status: ReconStatus
  resolution: string | null
  resolved_at: string | null
  resolved_by: string | null
  sent_at: string
  created_by: string
  created_at: string
  updated_at: string
  // computed
  flag_overdue: boolean
}

export type { } // keep module boundaries clean

export async function getReconsiderations(): Promise<ReconsiderationRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('reconsideration_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
  const cutoff = fourteenDaysAgo.toISOString()

  return (data ?? []).map((r) => ({
    ...(r as Omit<ReconsiderationRow, 'flag_overdue'>),
    flag_overdue: r.status === 'SENT' && r.sent_at < cutoff,
  }))
}

export async function createReconsideration(input: {
  law_reference: string
  content: string
}): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user!.id)
    .single()

  const { data, error } = await supabase
    .from('reconsideration_requests')
    .insert({
      apartment_complex_id: profile!.apartment_complex_id!,
      law_reference: input.law_reference,
      content: input.content,
      created_by: user!.id,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/reconsideration')
  return data.id
}

export async function updateResolution(input: {
  id: string
  status: ReconStatus
  resolution?: string
}): Promise<void> {
  const supabase = await createClient()
  const isFinished = input.status === 'RESOLVED' || input.status === 'ESCALATED'

  const { error } = await supabase
    .from('reconsideration_requests')
    .update({
      status: input.status,
      resolution: input.resolution || null,
      resolved_at: isFinished ? new Date().toISOString() : null,
    })
    .eq('id', input.id)

  if (error) throw new Error(error.message)
  revalidatePath('/reconsideration')
}

export async function uploadReconDocument(id: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const file = formData.get('file') as File
  if (!file) throw new Error('파일이 없습니다.')

  const ext = file.name.split('.').pop()
  const path = `${id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('recon-documents')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: signed } = await supabase.storage
    .from('recon-documents')
    .createSignedUrl(path, 365 * 24 * 3600)

  const { error: updateError } = await supabase
    .from('reconsideration_requests')
    .update({ document_url: signed?.signedUrl ?? null })
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)
  revalidatePath('/reconsideration')
}
