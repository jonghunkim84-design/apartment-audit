'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export type ReceiptEditFields = {
  receipt_date?: string | null
  merchant_name?: string | null
  business_number?: string | null
  supply_amount?: number | null
  tax_amount?: number | null
  amount?: number | null
  payment_method?: string | null
  card_company?: string | null
  approval_number?: string | null
  merchant_category?: string | null
}

export async function approveReceipt(id: string, fields: ReceiptEditFields): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('receipts')
    .update({
      ...fields,
      status: 'approved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/receipts/review')
  revalidatePath('/receipts')
  revalidatePath('/dashboard')
}

export async function rejectReceipt(
  id: string,
  reason: string,
  fields: ReceiptEditFields
): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { error } = await supabase
    .from('receipts')
    .update({
      ...fields,
      status: 'rejected',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      review_note: reason,
    })
    .eq('id', id)

  if (error) throw error
  revalidatePath('/receipts/review')
  revalidatePath('/receipts')
  revalidatePath('/dashboard')
}
