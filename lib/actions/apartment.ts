'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function createApartmentComplex(name: string, address?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.' }

  const { data: complex, error: complexError } = await supabase
    .from('apartment_complexes')
    .insert({ name, address: address || null })
    .select('id')
    .single()

  if (complexError) return { error: '아파트 단지 생성에 실패했습니다: ' + complexError.message }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ apartment_complex_id: complex.id })
    .eq('id', user.id)

  if (profileError) return { error: '프로필 업데이트에 실패했습니다: ' + profileError.message }

  redirect('/dashboard')
}
