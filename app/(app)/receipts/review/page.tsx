import { createClient } from '@/lib/supabase/server'
import { ReviewClient } from '@/components/receipts/ReviewClient'

export default async function ReviewPage() {
  const supabase = await createClient()

  const { data: receipts } = await supabase
    .from('receipts')
    .select(
      'id, receipt_date, merchant_name, business_number, supply_amount, tax_amount, amount, payment_method, card_company, approval_number, merchant_category, confidence_score, policy_flags, original_image_url, ocr_raw_text, status, review_note'
    )
    .in('status', ['pending', 'manual_review'])
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">영수증 검수</h1>
        <p className="text-muted-foreground text-sm mt-1">
          검수 대기 {receipts?.length ?? 0}건
        </p>
      </div>
      <ReviewClient receipts={receipts ?? []} />
    </div>
  )
}
