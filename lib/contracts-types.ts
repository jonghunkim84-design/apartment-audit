export type ContractRow = {
  id: string
  apartment_complex_id: string
  title: string
  contractor_name: string
  business_number: string | null
  contract_amount: number
  contract_type: 'bid' | 'private_contract' | 'service' | 'construction' | 'supply' | 'other'
  contract_date: string | null
  contract_start: string | null
  contract_end: string | null
  status: 'active' | 'expired' | 'terminated'
  document_url: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Computed flags (not in DB)
  flag_over_limit?: boolean
  flag_concentration?: boolean
}
