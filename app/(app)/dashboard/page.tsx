import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Receipt, XCircle, Banknote, TriangleAlert, ShieldAlert,
} from 'lucide-react'
import { SpendingChart, type MonthData } from '@/components/dashboard/SpendingChart'
import { KaptRadarChart } from '@/components/dashboard/KaptRadarChart'
import { getDepletionStatus } from '@/lib/actions/long-term-repair'
import { getKaptComparison } from '@/lib/actions/kapt'

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
  low:    { label: '낮음', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
} as const

const ANOMALY_LABEL: Record<string, string> = {
  benfords_law:        '벤포드 법칙 이상',
  acfe_pattern:        'ACFE 패턴 감지',
  statistical_outlier: '통계적 이상치',
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
    const key = d.toISOString().slice(0, 7)
    const label = `${d.getMonth() + 1}월`
    const amount = receipts
      ?.filter((r) => r.receipt_date?.startsWith(key) && r.status === 'approved')
      .reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0
    return { label, amount }
  })

  // ── 장기수선충당금 고갈 경고 ────────────────────────────────────────────────
  const depletion = complexId ? await getDepletionStatus(complexId) : null

  // ── K-apt 유사단지 비교 ──────────────────────────────────────────────────────
  const kaptData = await getKaptComparison()

  const complexName =
    profile?.apartment_complexes &&
    typeof profile.apartment_complexes === 'object' &&
    'name' in profile.apartment_complexes
      ? (profile.apartment_complexes as { name: string }).name
      : null

  return (
    <div className="space-y-8 max-w-7xl">
      {/* 인사말 */}
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">대시보드</h1>
        <p className="text-zinc-500 text-sm mt-1">
          {complexName
            ? <span className="font-medium text-zinc-700">{complexName}</span>
            : user?.email}
          <span className="text-zinc-400 ml-2">{thisMonth} 기준</span>
        </p>
      </div>

      {/* 장기수선충당금 고갈 경고 */}
      {depletion?.warn && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 px-6 py-4 flex items-start gap-4">
          <div className="bg-orange-100 p-2.5 rounded-xl shrink-0">
            <TriangleAlert className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-orange-800">장기수선충당금 잔액 부족 경고</p>
            <p className="text-2xl font-bold tabular-nums text-orange-700 mt-0.5">
              {depletion.estimatedMonths}개월
              <span className="text-sm font-normal text-orange-600 ml-1">내 고갈 예상</span>
            </p>
            <p className="text-xs text-orange-600 mt-1">
              현재 잔액 {fmt(depletion.latestBalance)} · 월평균 지출 {fmt(Math.round(depletion.avgMonthly))}
              {' '}—{' '}
              <a href="/long-term-repair" className="underline font-medium">충당금 관리 바로가기</a>
            </p>
          </div>
        </div>
      )}

      {/* KPI 카드 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {/* 이번 달 처리 */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">이번 달 처리</p>
              <p className="text-3xl font-bold tabular-nums text-zinc-900 mt-2">
                {thisMonthCount.toLocaleString()}
                <span className="text-base font-normal text-zinc-400 ml-1">건</span>
              </p>
              <p className="text-xs text-zinc-400 mt-1">{thisMonth} 기준</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl shrink-0">
              <Receipt className="h-5 w-5 text-blue-500" />
            </div>
          </div>
        </div>

        {/* 이상 건수 */}
        <div className={cn(
          'rounded-2xl shadow-sm border p-6',
          flaggedCount > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-zinc-100'
        )}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">이상 건수</p>
              <div className="flex items-center gap-2 mt-2">
                <p className={cn(
                  'text-3xl font-bold tabular-nums',
                  flaggedCount > 0 ? 'text-red-600' : 'text-zinc-900'
                )}>
                  {flaggedCount.toLocaleString()}
                  <span className="text-base font-normal text-zinc-400 ml-1">건</span>
                </p>
                {flaggedCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">
                    주의
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 mt-1">정책 위반 플래그</p>
            </div>
            <div className={cn(
              'p-3 rounded-xl shrink-0',
              flaggedCount > 0 ? 'bg-red-100' : 'bg-yellow-50'
            )}>
              <TriangleAlert className={cn(
                'h-5 w-5',
                flaggedCount > 0 ? 'text-red-500' : 'text-yellow-500'
              )} />
            </div>
          </div>
        </div>

        {/* 총 지출액 */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">총 지출액</p>
              <p className="text-3xl font-bold tabular-nums text-zinc-900 mt-2 leading-tight">
                {fmt(totalSpending)}
              </p>
              <p className="text-xs text-zinc-400 mt-1">승인 완료 기준</p>
            </div>
            <div className="bg-emerald-50 p-3 rounded-xl shrink-0">
              <Banknote className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
        </div>

        {/* 반려 건수 */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">반려 건수</p>
              <p className={cn(
                'text-3xl font-bold tabular-nums mt-2',
                rejectedCount > 0 ? 'text-red-600' : 'text-zinc-900'
              )}>
                {rejectedCount.toLocaleString()}
                <span className="text-base font-normal text-zinc-400 ml-1">건</span>
              </p>
              <p className="text-xs text-zinc-400 mt-1">전체 기간</p>
            </div>
            <div className={cn(
              'p-3 rounded-xl shrink-0',
              rejectedCount > 0 ? 'bg-red-50' : 'bg-zinc-50'
            )}>
              <XCircle className={cn(
                'h-5 w-5',
                rejectedCount > 0 ? 'text-red-500' : 'text-zinc-400'
              )} />
            </div>
          </div>
        </div>
      </div>

      {/* K-apt 유사단지 비교 Radar Chart */}
      <KaptRadarChart initialData={kaptData} />

      {/* 차트 + 이상 징후 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 최근 6개월 지출 Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
          <p className="text-sm font-semibold text-zinc-700 mb-4">최근 6개월 관리비 지출</p>
          <SpendingChart data={chartData} />
        </div>

        {/* 최근 이상 징후 5건 */}
        <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-zinc-500" />
            <p className="text-sm font-semibold text-zinc-700">최근 이상 징후</p>
          </div>
          {!anomalies || anomalies.length === 0 ? (
            <p className="text-sm text-zinc-400 text-center py-12">
              감지된 이상 징후 없음
            </p>
          ) : (
            <div className="divide-y divide-zinc-50">
              {anomalies.map((a) => {
                const meta = SEVERITY_META[a.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.low
                return (
                  <div key={a.id} className="px-6 py-3.5 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-zinc-800 truncate">
                        {ANOMALY_LABEL[a.detection_type] ?? a.detection_type}
                      </span>
                      <Badge variant="outline" className={cn('text-xs shrink-0 border', meta.cls)}>
                        {meta.label}
                      </Badge>
                    </div>
                    {a.description && (
                      <p className="text-xs text-zinc-400 line-clamp-2">{a.description}</p>
                    )}
                    <p className="text-xs text-zinc-300">{fmtDate(a.detection_date)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
