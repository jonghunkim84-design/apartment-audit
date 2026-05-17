import { getFindings } from '@/lib/actions/findings'
import { FindingsClient } from '@/components/findings/FindingsClient'

export default async function FindingsPage() {
  const findings = await getFindings()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">감사 지적사항</h1>
        <p className="text-sm text-muted-foreground mt-1">
          P4 누적 패턴 분석 (Benford&apos;s Law · ACFE Fraud Tree) · 자동 등록된 지적사항 관리
        </p>
      </div>
      <FindingsClient initialRows={findings} />
    </div>
  )
}
