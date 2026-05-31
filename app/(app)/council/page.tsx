import { getMeetings, getActions, getActiveTerm } from '@/lib/actions/council'
import { CouncilDashboard } from '@/components/council/CouncilDashboard'

export default async function CouncilPage() {
  const [meetings, actions, term] = await Promise.all([
    getMeetings().catch(() => []),
    getActions().catch(() => []),
    getActiveTerm().catch(() => null),
  ])

  return <CouncilDashboard meetings={meetings} actions={actions} activeTerm={term} />
}
