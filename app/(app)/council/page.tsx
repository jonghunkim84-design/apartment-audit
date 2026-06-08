import { getMeetings, getActions, getActiveTerm, getDeferredDecisions } from '@/lib/actions/council'
import { CouncilDashboard } from '@/components/council/CouncilDashboard'

export default async function CouncilPage() {
  const [meetings, actions, term, deferredDecisions] = await Promise.all([
    getMeetings().catch(() => []),
    getActions().catch(() => []),
    getActiveTerm().catch(() => null),
    getDeferredDecisions().catch(() => []),
  ])

  return (
    <CouncilDashboard
      meetings={meetings}
      actions={actions}
      activeTerm={term}
      deferredDecisions={deferredDecisions}
    />
  )
}
