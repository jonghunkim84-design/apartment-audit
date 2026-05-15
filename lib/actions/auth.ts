'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function login(email: string, password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signup(fullName: string, email: string, password: string, apartmentName: string) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  })

  if (error) {
    return { error: error.message }
  }

  if (!data.session) {
    return { success: '이메일을 확인해주세요. 확인 링크를 발송했습니다.' }
  }

  // 아파트 단지 생성 및 프로필 연결
  const { data: complex } = await supabase
    .from('apartment_complexes')
    .insert({ name: apartmentName })
    .select('id')
    .single()

  if (complex && data.user) {
    await supabase
      .from('profiles')
      .update({ apartment_complex_id: complex.id })
      .eq('id', data.user.id)
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function requestPasswordReset(email: string) {
  const supabase = await createClient()
  // BOM 등 비ASCII 문자 제거 후 사용
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://apartment-audit-system.vercel.app')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
  })
  if (error) return { error: error.message }
  return { success: true }
}

export async function updatePassword(password: string) {
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })
  if (error) return { error: error.message }
  redirect('/dashboard')
}
