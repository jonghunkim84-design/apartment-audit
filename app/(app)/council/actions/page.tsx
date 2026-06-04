import { getActions, getComplexMembers } from '@/lib/actions/council'
import { ActionsClient } from '@/components/council/ActionsClient'
import { createClient } from '@/lib/supabase/server'

export default async function ActionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [actions, members] = await Promise.all([
    getActions().catch(() => []),
    getComplexMembers().catch(() => []),
  ])

  return (
    <ActionsClient
      initialActions={actions}
      members={members}
      currentUserId={user?.id ?? ''}
    />
  )
}
