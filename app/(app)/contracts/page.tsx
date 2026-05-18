import { getContracts } from '@/lib/actions/contracts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ContractsClient } from '@/components/contracts/ContractsClient'
import Link from 'next/link'
import { BarChart3 } from 'lucide-react'

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

export default async function ContractsPage() {
  const rows = await getContracts()

  // KPI 계산
  const totalAmount = rows.reduce((s, r) => s + r.contract_amount, 0)
  const activeCount = rows.filter(r => r.status === 'active').length
  const overLimitCount = rows.filter(r => r.flag_over_limit).length
  const concentrationCount = rows.filter(r => r.flag_concentration).length

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">입찰·계약 관리</h1>
          <p className="text-sm text-muted-foreground mt-1">
            공동주택관리법 제7조 · 주택관리업자 및 사업자 선정지침 준수 현황
          </p>
        </div>
        <Link
          href="/contracts/analysis"
          className="flex items-center gap-1.5 text-sm text-[#5B8EC4] hover:text-[#3B72AF] font-medium shrink-0 mt-1"
        >
          <BarChart3 className="h-4 w-4" />
          비교 분석
        </Link>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">계약 총액</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{fmtKRW(totalAmount)}</p>
            <p className="text-xs text-muted-foreground mt-1">전체 계약 합산</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">진행중 계약</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {activeCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">active 상태</p>
          </CardContent>
        </Card>

        <Card className={overLimitCount > 0 ? 'border-red-300 bg-red-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">수의계약한도초과</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${overLimitCount > 0 ? 'text-red-600' : ''}`}>
              {overLimitCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">수의계약 2천만원 초과</p>
          </CardContent>
        </Card>

        <Card className={concentrationCount > 0 ? 'border-orange-300 bg-orange-50/40' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">거래처집중 경고</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold tabular-nums ${concentrationCount > 0 ? 'text-orange-600' : ''}`}>
              {concentrationCount.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">건</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">동일 업체 30% 초과</p>
          </CardContent>
        </Card>
      </div>

      {/* 계약 등록 폼 + 목록 */}
      <ContractsClient initialRows={rows} />
    </div>
  )
}
