import { logout } from '@/lib/actions/auth'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Button } from '@/components/ui/button'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 shrink-0 border-b bg-background flex items-center justify-end px-6 gap-3">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">로그아웃</Button>
          </form>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
