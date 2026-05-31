import { getMeeting } from '@/lib/actions/council'
import { notFound } from 'next/navigation'
import { MeetingDetailClient } from '@/components/council/MeetingDetailClient'

export default async function MeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const meeting = await getMeeting(id).catch(() => null)
  if (!meeting) notFound()
  return <MeetingDetailClient meeting={meeting} />
}
