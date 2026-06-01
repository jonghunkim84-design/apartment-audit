import { getAnnualData } from '@/lib/actions/council-reports'
import { AnnualReportClient } from '@/components/council/AnnualReportClient'

export default async function AnnualReportPage() {
  const year = new Date().getFullYear()
  const data = await getAnnualData(year).catch(() => ({
    reports: [],
    totalMeetings: 0,
    totalActions: 0,
    completedActions: 0,
    overdueActions: 0,
    avgPublishRate: 0,
    avgCompletionRate: 0,
    candidates: [],
  }))

  return <AnnualReportClient year={year} data={data} />
}
