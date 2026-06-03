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
        <header className="h-16 shrink-0 flex items-center justify-end px-6 gap-3" style={{ background: 'linear-gradient(rgba(0,0,0,0.18),rgba(0,0,0,0.18)), #8BADD9' }}>
          <div className="flex items-center gap-3">
            <NotificationBell userId={user.id} />
            <span className="text-sm text-blue-100">{user?.email}</span>
            <form action={logout}>
              <Button variant="ghost" size="sm" type="submit" className="text-blue-100 hover:text-white hover:bg-white/10">
                로그아웃
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
