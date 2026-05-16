import { getMiscIncomeData } from '@/lib/actions/misc-income'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MiscIncomeChart } from '@/components/misc-income/MiscIncomeChart'
import { MiscIncomeClient } from '@/components/misc-income/MiscIncomeClient'
import { AlertTriangle, AlertCircle, Banknote, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

const ALERT_ICON = {
  high:   <AlertCircle className="h-4 w-4 text-red-500 shrink-0" />,
  medium: <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />,
  low:    <AlertTriangle className="h-4 w-4 text-gray-400 shrink-0" />,
} as const

const ALERT_CLS = {
  high:   'border-red-200 bg-red-50 dark:bg-red-950/20',
  medium: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20',
  low:    'border-gray-200 bg-gray-50',
} as const

export default async function MiscIncomePage() {
  const { rows, alerts } = await getMiscIncomeData()

  // KPI 계산
  const thisYear = new Date().getFullYear()
  const thisMonth = new Date().toISOString().slice(0, 7)

  const totalYTD    = rows.filter(r => r.income_date.startsWith(String(thisYear))).reduce((s, r) => s + r.amount, 0)
  const totalMonth  = rows.filter(r => r.income_date.startsWith(thisMonth)).reduce((s, r) => s + r.amount, 0)
  const pendingCount = rows.filter(r => r.payment_status === 'pending').length
  const pendingAmount = rows.filter(r => r.payment_status === 'pending').reduce((s, r) => s + r.amount, 0)
  const alertCount  = alerts.length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">잡수입 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          공동주택관리법 제26조 · 재활용품·광고·주차·이자 수입 적립 및 이상 감지
        </p>
      </div>

      {/* 이상 감지 알림 배너 */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, i) => (
            <div key={i} className={cn('flex items-start gap-3 rounded-lg border px-4 py-3', ALERT_CLS[alert.severity])}>
              {ALERT_ICON[alert.severity]}
              <div>
                <p className={cn(
                  'text-sm font-semibold',
                  alert.severity === 'high' ? 'text-red-700' : 'text-yellow-700',
                )}>
                  {alert.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{alert.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">올해 잡수입 합계</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmtKRW(totalYTD)}</p>
            <p className="text-xs text-muted-foreground mt-1">{thisYear}년 수납완료 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">이번 달 수입</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmtKRW(totalMonth)}</p>
            <p className="text-xs text-muted-foreground mt-1">{thisMonth} 기준</p>
          </CardContent>
        </Card>

        <Card className={pendingCount > 0 ? 'border-orange-300 bg-orange-50/40' : ''}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">미수납 건수</CardTitle>
            <Clock className={cn('h-4 w-4', pendingCount > 0 ? 'text-orange-500' : 'text-muted-foreground')} />
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', pendingCount > 0 && 'text-orange-600')}>
              {pendingCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{fmtKRW(pendingAmount)}</p>
          </CardContent>
        </Card>

        <Card className={alertCount > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">이상 감지</CardTitle>
            <AlertTriangle className={cn('h-4 w-4', alertCount > 0 ? 'text-red-500' : 'text-muted-foreground')} />
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', alertCount > 0 && 'text-red-600')}>
              {alertCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">audit_findings 자동 등록</p>
          </CardContent>
        </Card>
      </div>

      {/* Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">월별 잡수입 현황 (최근 12개월, 유형별)</CardTitle>
        </CardHeader>
        <CardContent>
          <MiscIncomeChart rows={rows} />
        </CardContent>
      </Card>

      {/* 등록 폼 + 이력 */}
      <MiscIncomeClient initialRows={rows} />
    </div>
  )
}
