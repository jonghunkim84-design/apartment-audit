import { createClient } from '@/lib/supabase/server'
import { ReceiptList } from '@/components/receipts/ReceiptList'

export default async function ReceiptsPage() {
  const supabase = await createClient()
  const { data: receipts } = await supabase
    .from('receipts')
    .select(
      'id, receipt_date, merchant_name, merchant_category, amount, supply_amount, tax_amount, payment_method, card_company, confidence_score, status, policy_flags, created_at'
    )
    .order('created_at', { ascending: false })

  return <ReceiptList receipts={receipts ?? []} />
}
