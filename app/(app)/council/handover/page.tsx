import { getLatestHandover, getPendingActionsCount } from '@/lib/actions/council-handover'
import { HandoverClient } from '@/components/council/HandoverClient'

export default async function HandoverPage() {
  const [handover, pendingCount] = await Promise.all([
    getLatestHandover().catch(() => null),
    getPendingActionsCount().catch(() => 0),
  ])

  return <HandoverClient handover={handover} pendingCount={pendingCount} />
}
