import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Receipt, XCircle, Banknote, TriangleAlert, ShieldAlert,
} from 'lucide-react'
import { SpendingChart, type MonthData } from '@/components/dashboard/SpendingChart'

// ── 헬퍼 ──────────────────────────────────────────────────────────────────────

function fmt(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

// ── 이상 징후 심각도 메타 ─────────────────────────────────────────────────────

const SEVERITY_META = {
  high:   { label: '높음', cls: 'bg-red-100 text-red-700 border-red-200' },
  medium: { label: '중간', cls: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  low:    { label: '낮음', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
} as const

const ANOMALY_LABEL: Record<string, string> = {
  benfords_law:       "벤포드 법칙 이상",
  acfe_pattern:       "ACFE 패턴 감지",
  statistical_outlier: "통계적 이상치",
}

// ── 페이지 ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id, full_name, apartment_complexes(name)')
    .eq('id', user!.id)
    .single()

  const complexId = profile?.apartment_complex_id ?? ''

  // ── 영수증 전체 조회 ────────────────────────────────────────────────────────
  const { data: receipts } = await supabase
    .from('receipts')
    .select('id, status, amount, receipt_date, policy_flags')
    .eq('apartment_complex_id', complexId)

  // ── 최근 이상 징후 5건 ──────────────────────────────────────────────────────
  const { data: anomalies } = await supabase
    .from('anomaly_detections')
    .select('id, detection_type, severity, description, detection_date, status')
    .eq('apartment_complex_id', complexId)
    .in('status', ['open', 'investigating'])
    .order('detection_date', { ascending: false })
    .limit(5)

  // ── KPI 계산 ────────────────────────────────────────────────────────────────
  const thisMonth = new Date().toISOString().slice(0, 7)

  const thisMonthCount = receipts?.filter(
    (r) => r.receipt_date?.startsWith(thisMonth)
  ).length ?? 0

  const flaggedCount = receipts?.filter(
    (r) => r.policy_flags !== null && Object.keys(r.policy_flags as object).length > 0
  ).length ?? 0

  const totalSpending = receipts
    ?.filter((r) => r.status === 'approved')
    .reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0

  const rejectedCount = receipts?.filter((r) => r.status === 'rejected').length ?? 0

  // ── 최근 6개월 Bar Chart 데이터 ─────────────────────────────────────────────
  const chartData: MonthData[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const key = d.toISOString().slice(0, 7)   // "YYYY-MM"
    const label = `${d.getMonth() + 1}월`
    const amount = receipts
      ?.filter((r) => r.receipt_date?.startsWith(key) && r.status === 'approved')
      .reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0
    return { label, amount }
  })

  const complexName =
    profile?.apartment_complexes &&
    typeof profile.apartment_complexes === 'object' &&
    'name' in profile.apartment_complexes
      ? (profile.apartment_complexes as { name: string }).name
      : null

  return (
    <div className="space-y-6">
      {/* 인사말 */}
      <div>
        <h1 className="text-2xl font-bold">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.email}
          {complexName && <span className="ml-1 font-medium text-foreground">· {complexName}</span>}
        </p>
      </div>

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">이번 달 처리</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {thisMonthCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">{thisMonth} 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">이상 건수</CardTitle>
            <TriangleAlert className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', flaggedCount > 0 && 'text-yellow-600')}>
              {flaggedCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">정책 위반 플래그</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 지출액</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalSpending)}</p>
            <p className="text-xs text-muted-foreground mt-1">승인 완료 기준</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">반려 건수</CardTitle>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <p className={cn('text-2xl font-bold tabular-nums', rejectedCount > 0 && 'text-red-600')}>
              {rejectedCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">전체 기간</p>
          </CardContent>
        </Card>
      </div>

      {/* 차트 + 이상 징후 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 최근 6개월 지출 Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">최근 6개월 관리비 지출</CardTitle>
          </CardHeader>
          <CardContent>
            <SpendingChart data={chartData} />
          </CardContent>
        </Card>

        {/* 최근 이상 징후 5건 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              최근 이상 징후
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!anomalies || anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                감지된 이상 징후 없음
              </p>
            ) : (
              <div className="divide-y">
                {anomalies.map((a) => {
                  const meta = SEVERITY_META[a.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.low
                  return (
                    <div key={a.id} className="px-6 py-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {ANOMALY_LABEL[a.detection_type] ?? a.detection_type}
                        </span>
                        <Badge variant="outline" className={cn('text-xs shrink-0', meta.cls)}>
                          {meta.label}
                        </Badge>
                      </div>
                      {a.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>
                      )}
                      <p className="text-xs text-muted-foreground">{fmtDate(a.detection_date)}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
