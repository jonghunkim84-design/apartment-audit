import { getExternalAudits } from '@/lib/actions/external-audits'
import { ExternalAuditsClient } from '@/components/external-audits/ExternalAuditsClient'

export default async function ExternalAuditsPage() {
  const rows = await getExternalAudits()

  const latestOpinion = rows[0]?.opinion ?? null
  const totalCount = rows.length
  const nonUnqualified = rows.filter(r => r.opinion === '적정').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">외부 회계감사</h1>
        <p className="text-sm text-muted-foreground mt-1">
          공인회계사 외부감사 보고서 등록 및 지적사항 연계 관리
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">최근 감사 의견</p>
          <p className="text-2xl font-bold mt-1">{latestOpinion ?? '—'}</p>
          <p className="text-xs text-muted-foreground mt-1">{rows[0]?.audit_year ?? '등록 없음'}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">누적 감사 건수</p>
          <p className="text-2xl font-bold mt-1">{totalCount}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-xs text-muted-foreground font-medium">적정 의견 횟수</p>
          <p className="text-2xl font-bold mt-1">{nonUnqualified}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
          <p className="text-xs text-muted-foreground mt-1">전체의 {totalCount > 0 ? Math.round(nonUnqualified / totalCount * 100) : 0}%</p>
        </div>
      </div>

      <ExternalAuditsClient initialRows={rows} />
    </div>
  )
}
