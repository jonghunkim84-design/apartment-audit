import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UsersManagementClient } from '@/components/settings/UsersManagementClient'

export default async function UsersManagementPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  if (profile?.role !== 'auditor') redirect('/dashboard')

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">사용자 관리</h1>
        <p className="text-zinc-500 text-sm mt-1">단지 구성원 권한 설정 및 초대</p>
      </div>
      <UsersManagementClient />
    </div>
  )
}
