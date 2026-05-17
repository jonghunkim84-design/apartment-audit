import { logout } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Button } from '@/components/ui/button'
import { redirect } from 'next/navigation'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.apartment_complex_id) redirect('/setup')

  return (
    <div className="flex h-screen overflow-hidden bg-slate-100">
      <Sidebar role={profile?.role ?? undefined} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b border-zinc-200 bg-white flex items-center justify-end px-6 gap-3">
          <NotificationBell userId={user.id} />
          <span className="text-sm text-zinc-500">{user?.email}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit" className="text-zinc-600 hover:text-zinc-900">
              로그아웃
            </Button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
