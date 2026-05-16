import { getReconsiderations } from '@/lib/actions/reconsideration'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReconsiderationClient } from '@/components/reconsideration/ReconsiderationClient'
import { Send, Clock, CheckCircle, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

export default async function ReconsiderationPage() {
  const rows = await getReconsiderations()

  const sentCount      = rows.filter((r) => r.status === 'SENT').length
  const receivedCount  = rows.filter((r) => r.status === 'RECEIVED').length
  const resolvedCount  = rows.filter((r) => r.status === 'RESOLVED').length
  const escalatedCount = rows.filter((r) => r.status === 'ESCALATED').length
  const overdueCount   = rows.filter((r) => r.flag_overdue).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">재심의 요청 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          공동주택관리법 위반 사항에 대한 재심의 요청 발송 및 처리 결과 추적
        </p>
      </div>

      {/* 미처리경과 경고 배너 */}
      {overdueCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 dark:bg-orange-950/20">
          <Clock className="h-4 w-4 text-orange-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-orange-700">
              [미처리경과] 발송 후 14일 경과 미처리 요청 {overdueCount}건
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              아래 목록에서 「발송됨」 상태 항목을 확인하고 후속 조치를 취하세요.
            </p>
          </div>
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">전체</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{rows.length}</p>
            <p className="text-xs text-muted-foreground mt-1">누적 요청</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">발송됨</CardTitle>
            <Send className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-blue-600">{sentCount}</p>
            <p className="text-xs text-muted-foreground mt-1">처리 대기 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">접수됨</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-yellow-600">{receivedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">검토 진행 중</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">처리완료</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums text-green-600">{resolvedCount}</p>
            <p className="text-xs text-muted-foreground mt-1">이관 포함</p>
          </CardContent>
        </Card>

        <Card className={cn(overdueCount > 0 && 'border-orange-300 bg-orange-50/40')}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">미처리경과</CardTitle>
            <AlertTriangle className={cn('h-4 w-4', overdueCount > 0 ? 'text-orange-500' : 'text-muted-foreground')} />
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', overdueCount > 0 && 'text-orange-600')}>
              {overdueCount}
            </p>
            <p className="text-xs text-muted-foreground mt-1">14일 초과 SENT</p>
          </CardContent>
        </Card>
      </div>

      {/* 요청서 작성 폼 + 목록 */}
      <ReconsiderationClient initialRows={rows} />
    </div>
  )
}
