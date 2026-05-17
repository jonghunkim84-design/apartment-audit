'use server'

import { createClient } from '@/lib/supabase/server'

export type KaptRow = {
  id: string
  apartment_complex_id: string
  year_month: string
  category: string
  our_amount: number
  avg_amount: number
  sample_count: number
}

export async function getKaptComparison(): Promise<KaptRow[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return []

  // latest year_month only
  const { data: latest } = await supabase
    .from('kapt_comparison')
    .select('year_month')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .order('year_month', { ascending: false })
    .limit(1)
    .single()

  if (!latest?.year_month) return []

  const { data } = await supabase
    .from('kapt_comparison')
    .select('id, apartment_complex_id, year_month, category, our_amount, avg_amount, sample_count')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .eq('year_month', latest.year_month)

  return (data ?? []) as KaptRow[]
}
