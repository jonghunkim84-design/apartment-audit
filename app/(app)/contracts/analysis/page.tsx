import { getContracts } from '@/lib/actions/contracts'
import { ContractAnalysisClient } from '@/components/contracts/ContractAnalysisClient'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ContractRow } from '@/lib/contracts-types'

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  bid: '입찰',
  private_contract: '수의계약',
  service: '용역',
  construction: '공사',
  supply: '물품',
  other: '기타',
}

function mean(arr: number[]) {
  return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0
}

function stdDev(arr: number[], avg: number) {
  if (arr.length < 2) return 0
  return Math.sqrt(arr.reduce((s, v) => s + Math.pow(v - avg, 2), 0) / arr.length)
}

export type TypeStat = {
  type: string
  label: string
  count: number
  amount: number
  pct: number
}

export type AwardRate = {
  bidCount: number
  privateCount: number
  bidAmount: number
  privateAmount: number
  rate: number
}

export type ContractorStat = {
  name: string
  count: number
  amount: number
  pct: number
  flag: boolean
}

export type AnomalyRow = {
  id: string
  title: string
  contractor_name: string
  type: string
  typeLabel: string
  amount: number
  groupMean: number
  groupStdDev: number
  zScore: number
  direction: 'high' | 'low'
}

export type RiskRow = {
  id: string
  title: string
  contractor_name: string
  amount: number
  risks: string[]
}

export type ContractAnalysis = {
  totalCount: number
  totalAmount: number
  byType: TypeStat[]
  awardRate: AwardRate
  contractors: ContractorStat[]
  anomalies: AnomalyRow[]
  riskRows: RiskRow[]
}

function computeAnalysis(rows: ContractRow[]): ContractAnalysis {
  const totalCount = rows.length
  const totalAmount = rows.reduce((s, r) => s + r.contract_amount, 0)

  // ── 유형별 통계
  const typeMap: Record<string, { count: number; amount: number }> = {}
  for (const r of rows) {
    typeMap[r.contract_type] ??= { count: 0, amount: 0 }
    typeMap[r.contract_type].count++
    typeMap[r.contract_type].amount += r.contract_amount
  }
  const byType: TypeStat[] = Object.entries(typeMap)
    .map(([type, v]) => ({
      type,
      label: CONTRACT_TYPE_LABEL[type] ?? type,
      count: v.count,
      amount: v.amount,
      pct: totalAmount > 0 ? Math.round((v.amount / totalAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)

  // ── 낙찰률
  const bidCount = rows.filter(r => r.contract_type === 'bid').length
  const privateCount = rows.filter(r => r.contract_type === 'private_contract').length
  const bidAmount = rows.filter(r => r.contract_type === 'bid').reduce((s, r) => s + r.contract_amount, 0)
  const privateAmount = rows.filter(r => r.contract_type === 'private_contract').reduce((s, r) => s + r.contract_amount, 0)
  const awardRate: AwardRate = {
    bidCount,
    privateCount,
    bidAmount,
    privateAmount,
    rate: (bidCount + privateCount) > 0
      ? Math.round((bidCount / (bidCount + privateCount)) * 100)
      : 0,
  }

  // ── 거래처 집중도
  const contractorMap: Record<string, { count: number; amount: number }> = {}
  for (const r of rows) {
    contractorMap[r.contractor_name] ??= { count: 0, amount: 0 }
    contractorMap[r.contractor_name].count++
    contractorMap[r.contractor_name].amount += r.contract_amount
  }
  const contractors: ContractorStat[] = Object.entries(contractorMap)
    .map(([name, v]) => ({
      name,
      count: v.count,
      amount: v.amount,
      pct: totalAmount > 0 ? Math.round((v.amount / totalAmount) * 1000) / 10 : 0,
      flag: totalAmount > 0 && v.amount / totalAmount > 0.3,
    }))
    .sort((a, b) => b.amount - a.amount)

  // ── 단가 이상 탐지 (유형별 z-score, n≥3)
  const byTypeRows: Record<string, ContractRow[]> = {}
  for (const r of rows) {
    byTypeRows[r.contract_type] ??= []
    byTypeRows[r.contract_type].push(r)
  }
  const anomalies: AnomalyRow[] = []
  for (const [type, group] of Object.entries(byTypeRows)) {
    if (group.length < 3) continue
    const amounts = group.map(r => r.contract_amount)
    const avg = mean(amounts)
    const sd = stdDev(amounts, avg)
    if (sd === 0) continue
    for (const r of group) {
      const z = (r.contract_amount - avg) / sd
      if (Math.abs(z) >= 1.5 && r.contract_amount >= 1_000_000) {
        anomalies.push({
          id: r.id,
          title: r.title,
          contractor_name: r.contractor_name,
          type,
          typeLabel: CONTRACT_TYPE_LABEL[type] ?? type,
          amount: r.contract_amount,
          groupMean: Math.round(avg),
          groupStdDev: Math.round(sd),
          zScore: Math.round(z * 10) / 10,
          direction: z > 0 ? 'high' : 'low',
        })
      }
    }
  }
  anomalies.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))

  // ── 위험 계약
  const riskRows: RiskRow[] = []
  for (const r of rows) {
    const risks: string[] = []
    if (r.flag_over_limit) risks.push('수의계약 한도 초과 (2천만원)')
    if (!r.document_url) risks.push('계약서 미첨부')
    if (!r.contract_start || !r.contract_end) risks.push('계약 기간 미입력')
    if (r.status === 'active' && r.contract_end && r.contract_end < new Date().toISOString().slice(0, 10)) {
      risks.push('기간 만료 후 active 상태')
    }
    if (risks.length > 0) {
      riskRows.push({ id: r.id, title: r.title, contractor_name: r.contractor_name, amount: r.contract_amount, risks })
    }
  }
  riskRows.sort((a, b) => b.risks.length - a.risks.length)

  return { totalCount, totalAmount, byType, awardRate, contractors, anomalies, riskRows }
}

export default async function ContractAnalysisPage() {
  const rows = await getContracts()
  const analysis = computeAnalysis(rows)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/contracts" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2 w-fit">
          <ChevronLeft className="h-3.5 w-3.5" />계약 목록
        </Link>
        <h1 className="text-2xl font-bold">계약 비교 분석</h1>
        <p className="text-sm text-muted-foreground mt-1">
          낙찰률 · 단가 이상 탐지 · 거래처 집중도 · 위험 계약 현황
        </p>
      </div>

      <ContractAnalysisClient analysis={analysis} />
    </div>
  )
}
