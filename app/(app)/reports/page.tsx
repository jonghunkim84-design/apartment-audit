import { ReportPageClient } from '@/components/reports/ReportPageClient'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">감사 보고서</h1>
        <p className="text-muted-foreground text-sm mt-1">
          공동주택관리법 제26조 · 기간 선택 후 PDF 자동 생성
        </p>
      </div>
      <ReportPageClient />
    </div>
  )
}
