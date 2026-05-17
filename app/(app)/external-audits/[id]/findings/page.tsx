import { notFound } from 'next/navigation'
import { getExternalAudit } from '@/lib/actions/external-audits'
import { FindingsBatchClient } from '@/components/external-audits/FindingsBatchClient'

export default async function ExternalAuditFindingsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const audit = await getExternalAudit(id)
  if (!audit) notFound()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">지적사항 등록</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {audit.audit_year}년도 외부감사 ({audit.audit_firm}) — 지적사항을 일괄 등록합니다.
        </p>
      </div>
      <FindingsBatchClient externalAuditId={id} />
    </div>
  )
}
