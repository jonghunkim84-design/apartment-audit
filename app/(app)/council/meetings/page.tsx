import { getMeetings } from '@/lib/actions/council'
import { MeetingsClient } from '@/components/council/MeetingsClient'

export default async function MeetingsPage() {
  const meetings = await getMeetings().catch(() => [])
  return <MeetingsClient meetings={meetings} />
}
