import { NewAuditClient } from '@/components/external-audits/NewAuditClient'

export default function NewExternalAuditPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">외부 회계감사 등록</h1>
        <p className="text-sm text-muted-foreground mt-1">
          공인회계사의 외부감사 결과를 등록하고 지적사항을 연계합니다.
        </p>
      </div>
      <NewAuditClient />
    </div>
  )
}
