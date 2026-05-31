import { getActions } from '@/lib/actions/council'
import { ActionsClient } from '@/components/council/ActionsClient'

export default async function ActionsPage() {
  const actions = await getActions().catch(() => [])
  return <ActionsClient initialActions={actions} />
}
