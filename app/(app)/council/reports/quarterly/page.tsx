import { getQuarterlyReports } from '@/lib/actions/council-reports'
import { QuarterlyReportClient } from '@/components/council/QuarterlyReportClient'

export default async function QuarterlyReportPage() {
  const reports = await getQuarterlyReports().catch(() => [])
  return <QuarterlyReportClient reports={reports} />
}
