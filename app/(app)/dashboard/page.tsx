import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Receipt,
  CircleCheckBig,
  TriangleAlert,
  Banknote,
  TrendingUp,
  Clock,
} from 'lucide-react'

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

const STATUS_META = {
  approved:      { label: '승인',     cls: 'bg-green-100 text-green-700 border-green-200' },
  manual_review: { label: '검수 필요', cls: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  rejected:      { label: '반려',     cls: 'bg-red-100 text-red-700 border-red-200' },
  pending:       { label: '대기',     cls: 'bg-gray-100 text-gray-600 border-gray-200' },
  processing:    { label: '처리 중',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
} as const

// ── page ──────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // 프로필 + 단지 정보
  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id, full_name, apartment_complexes(name)')
    .eq('id', user!.id)
    .single()

  const complexId = profile?.apartment_complex_id

  // 영수증 통계
  const { data: receipts } = await supabase
    .from('receipts')
    .select('id, status, amount, confidence_score, receipt_date, merchant_name, merchant_category, policy_flags, created_at')
    .eq('apartment_complex_id', complexId ?? '')
    .order('created_at', { ascending: false })

  const total = receipts?.length ?? 0
  const approved = receipts?.filter(r => r.status === 'approved').length ?? 0
  const manualReview = receipts?.filter(r => r.status === 'manual_review').length ?? 0
  const rejected = receipts?.filter(r => r.status === 'rejected').length ?? 0
  const totalAmount = receipts?.reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : null
  const avgConf = receipts && receipts.length > 0
    ? Math.round(
        receipts.reduce((s, r) => s + Number(r.confidence_score ?? 0), 0) / receipts.length * 100
      )
    : null
  const flagged = receipts?.filter(r => r.policy_flags !== null).length ?? 0

  const recent5 = receipts?.slice(0, 5) ?? []

  // 상태별 분포
  const statusDist = [
    { key: 'approved',      count: approved },
    { key: 'manual_review', count: manualReview },
    { key: 'rejected',      count: rejected },
    { key: 'pending',       count: receipts?.filter(r => r.status === 'pending').length ?? 0 },
  ] as const

  // 이번 달 금액
  const thisMonth = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  const thisMonthAmount = receipts
    ?.filter(r => r.receipt_date?.startsWith(thisMonth))
    .reduce((s, r) => s + (r.amount ?? 0), 0) ?? 0

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
          안녕하세요, {user?.email}님
          {complexName && <span className="ml-1 text-foreground font-medium">· {complexName}</span>}
        </p>
      </div>

      {/* 핵심 지표 4개 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">총 영수증</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{total.toLocaleString()}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
            <p className="text-xs text-muted-foreground mt-1">검수 필요 {manualReview}건</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">감사 금액</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmt(totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">이번 달 {fmt(thisMonthAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">승인율</CardTitle>
            <CircleCheckBig className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {approvalRate !== null ? `${approvalRate}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">반려 {rejected}건</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">평균 신뢰도</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {avgConf !== null ? `${avgConf}%` : '—'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">이상 플래그 {flagged}건</p>
          </CardContent>
        </Card>
      </div>

      {/* 하단 2열: 최근 영수증 + 상태 분포 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 최근 영수증 */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              최근 영수증
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recent5.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">업로드된 영수증이 없습니다</p>
            ) : (
              <div className="divide-y">
                {recent5.map((r) => {
                  const meta = STATUS_META[r.status as keyof typeof STATUS_META] ?? STATUS_META.pending
                  return (
                    <div key={r.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/30">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.merchant_name ?? '가맹점 미인식'}</p>
                        <p className="text-xs text-muted-foreground">{fmtDate(r.receipt_date)} · {r.merchant_category ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-4">
                        <span className="text-sm font-medium tabular-nums">{fmt(r.amount)}</span>
                        <Badge variant="outline" className={cn('text-xs', meta.cls)}>{meta.label}</Badge>
                        {r.policy_flags !== null && (
                          <TriangleAlert className="h-3.5 w-3.5 text-yellow-500" />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 상태 분포 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">상태별 현황</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {total === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터 없음</p>
            ) : (
              statusDist.map(({ key, count }) => {
                const meta = STATUS_META[key]
                const pct = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{meta.label}</span>
                      <span className="font-medium tabular-nums">{count}건 <span className="text-muted-foreground text-xs">({pct}%)</span></span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all',
                          key === 'approved'      ? 'bg-green-500' :
                          key === 'manual_review' ? 'bg-yellow-400' :
                          key === 'rejected'      ? 'bg-red-400' : 'bg-gray-300'
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
