import { createClient } from '@/lib/supabase/server'
import { getLongTermRepairData } from '@/lib/actions/long-term-repair'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RepairBarChart, RepairLineChart } from '@/components/long-term-repair/RepairCharts'
import { RepairClient } from '@/components/long-term-repair/RepairClient'

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

export default async function LongTermRepairPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user!.id)
    .single()

  const rows = await getLongTermRepairData()

  // KPI 계산
  const thisYear = new Date().getFullYear()
  const thisYearRows = rows.filter(r => r.year === thisYear)
  const latestBalance = rows.length > 0 ? rows[0].balance : null
  const thisYearPlanned = thisYearRows.reduce((s, r) => s + r.planned_amount, 0)
  const thisYearActual = thisYearRows.reduce((s, r) => s + r.actual_amount, 0)
  const unplannedCount = rows.filter(r => r.is_unplanned).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">장기수선충당금 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          공동주택관리법 제30조 — 장기수선계획 이행 및 충당금 적립·집행 현황
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">현재 잔액</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {latestBalance !== null ? fmtKRW(latestBalance) : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">최근 등록 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{thisYear}년 계획 총액</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmtKRW(thisYearPlanned)}</p>
            <p className="text-xs text-muted-foreground mt-1">당해 연도 합산</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{thisYear}년 실행 총액</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${thisYearActual > thisYearPlanned ? 'text-red-600' : ''}`}>
              {fmtKRW(thisYearActual)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {thisYearPlanned > 0
                ? `계획 대비 ${Math.round(thisYearActual / thisYearPlanned * 100)}%`
                : '집행 없음'}
            </p>
          </CardContent>
        </Card>

        <Card className={unplannedCount > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">계획외 집행</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${unplannedCount > 0 ? 'text-red-600' : ''}`}>
              {unplannedCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">전체 기간 누적</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">연도별 계획액 vs 실행액</CardTitle>
          </CardHeader>
          <CardContent>
            <RepairBarChart rows={rows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">월별 잔액 추이 (최근 24개월)</CardTitle>
          </CardHeader>
          <CardContent>
            <RepairLineChart rows={rows} />
          </CardContent>
        </Card>
      </div>

      {/* 등록 폼 + 이력 테이블 */}
      <RepairClient initialRows={rows} />
    </div>
  )
}
