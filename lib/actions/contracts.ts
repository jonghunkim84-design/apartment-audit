'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ContractRow } from '@/lib/contracts-types'
import { createNotificationsForComplex } from '@/lib/notifications/create'

export type { ContractRow } from '@/lib/contracts-types'

export async function getContracts(): Promise<ContractRow[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('contracts')
    .select('*')
    .order('contract_date', { ascending: false, nullsFirst: false })

  if (error) throw new Error(error.message)

  const rows = (data ?? []) as ContractRow[]

  // Compute 거래처집중 flag: same contractor total > 30% of all
  const totalAll = rows.reduce((s, r) => s + r.contract_amount, 0)
  const byContractor: Record<string, number> = {}
  for (const r of rows) {
    byContractor[r.contractor_name] = (byContractor[r.contractor_name] ?? 0) + r.contract_amount
  }

  return rows.map((r) => ({
    ...r,
    flag_over_limit: r.contract_type === 'private_contract' && r.contract_amount > 20_000_000,
    flag_concentration: totalAll > 0 && (byContractor[r.contractor_name] ?? 0) / totalAll > 0.3,
  }))
}

type CreateInput = {
  title: string
  contractor_name: string
  business_number?: string
  contract_amount: number
  contract_type: ContractRow['contract_type']
  contract_date?: string
  contract_start?: string
  contract_end?: string
  status?: ContractRow['status']
  notes?: string
}

export async function createContract(input: CreateInput): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user!.id)
    .single()

  const { error } = await supabase.from('contracts').insert({
    apartment_complex_id: profile!.apartment_complex_id!,
    title: input.title,
    contractor_name: input.contractor_name,
    business_number: input.business_number || null,
    contract_amount: input.contract_amount,
    contract_type: input.contract_type,
    contract_date: input.contract_date || null,
    contract_start: input.contract_start || null,
    contract_end: input.contract_end || null,
    status: input.status ?? 'active',
    notes: input.notes || null,
    created_by: user!.id,
  })

  if (error) throw new Error(error.message)

  const isOverLimit = input.contract_type === 'private_contract' && input.contract_amount > 20_000_000
  if (isOverLimit) {
    await createNotificationsForComplex({
      complexId: profile!.apartment_complex_id!,
      actorUserId: user!.id,
      title: `[수의계약] 한도 초과 계약 등록 — ${input.title}`,
      message: `${input.contractor_name}과의 수의계약이 ₩${input.contract_amount.toLocaleString()}으로 한도(₩20,000,000)를 초과합니다.`,
      severity: 'WARNING',
      category: 'contract',
    })
  }

  revalidatePath('/contracts')
}

export async function deleteContract(id: string): Promise<void> {
  const supabase = await createClient()
  const { error } = await supabase.from('contracts').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/contracts')
}

export async function uploadContractFile(id: string, formData: FormData): Promise<void> {
  const supabase = await createClient()
  const file = formData.get('file') as File
  if (!file) throw new Error('파일이 없습니다.')

  const ext = file.name.split('.').pop()
  const path = `${id}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('contract-documents')
    .upload(path, file, { upsert: true })

  if (uploadError) throw new Error(uploadError.message)

  const { data: signed } = await supabase.storage
    .from('contract-documents')
    .createSignedUrl(path, 365 * 24 * 3600)

  const { error: updateError } = await supabase
    .from('contracts')
    .update({ document_url: signed?.signedUrl ?? null })
    .eq('id', id)

  if (updateError) throw new Error(updateError.message)
  revalidatePath('/contracts')
}
