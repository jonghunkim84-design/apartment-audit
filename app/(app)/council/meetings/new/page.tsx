import { getActiveTerm } from '@/lib/actions/council'
import { NewMeetingClient } from '@/components/council/NewMeetingClient'

export default async function NewMeetingPage() {
  const term = await getActiveTerm().catch(() => null)
  return <NewMeetingClient activeTerm={term} />
}
