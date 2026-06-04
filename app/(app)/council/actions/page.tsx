import { getActions, getComplexMembers } from '@/lib/actions/council'
import { ActionsClient } from '@/components/council/ActionsClient'

export default async function ActionsPage() {
  const [actions, members] = await Promise.all([
    getActions().catch(() => []),
    getComplexMembers().catch(() => []),
  ])
  return <ActionsClient initialActions={actions} members={members} />
}
