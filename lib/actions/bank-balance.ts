'use server'

import { createClient } from '@/lib/supabase/server'

export interface AccountRow {
  bank: string
  purpose: string
  type: string
  accountNo: string
  bookAmount: number | null
  confirmedAmount: number | null
  note: string
}

function prevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number)
  if (m === 1) return `${y - 1}-12`
  return `${y}-${String(m - 1).padStart(2, '0')}`
}

export async function getLatestBankBalance(yearMonth: string): Promise<{
  accounts: AccountRow[]
  verificationNote: string
} | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return null

  // Try previous month first, then any earlier record
  const prev = prevYearMonth(yearMonth)
  const { data } = await supabase
    .from('bank_balance_checks')
    .select('accounts, verification_note')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .eq('year_month', prev)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (data) {
    const accounts = (data.accounts as unknown as AccountRow[]).map((row) => ({
      ...row,
      bookAmount: null,
      confirmedAmount: null,
    }))
    return { accounts, verificationNote: data.verification_note ?? '이상 없음' }
  }

  // Fallback: most recent record regardless of month
  const { data: fallback } = await supabase
    .from('bank_balance_checks')
    .select('accounts, verification_note')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .lt('year_month', yearMonth)
    .order('year_month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (fallback) {
    const accounts = (fallback.accounts as unknown as AccountRow[]).map((row) => ({
      ...row,
      bookAmount: null,
      confirmedAmount: null,
    }))
    return { accounts, verificationNote: fallback.verification_note ?? '이상 없음' }
  }

  return null
}

export async function saveBankBalance(
  yearMonth: string,
  accounts: AccountRow[],
  verificationNote: string,
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return { error: '아파트 단지가 설정되지 않았습니다.' }

  // Upsert by (complex_id, year_month) — delete old then insert
  await supabase
    .from('bank_balance_checks')
    .delete()
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .eq('year_month', yearMonth)

  const { error } = await supabase.from('bank_balance_checks').insert({
    apartment_complex_id: profile.apartment_complex_id,
    year_month: yearMonth,
    accounts: accounts as unknown as never,
    verification_note: verificationNote,
    created_by: user.id,
  })

  if (error) return { error: error.message }
  return {}
}
