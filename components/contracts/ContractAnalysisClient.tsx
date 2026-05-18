'use client'

import { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  TrendingUp, Users, AlertTriangle, ShieldAlert, BarChart3, List,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { ContractAnalysis } from '@/app/(app)/contracts/analysis/page'

function fmtKRW(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(1)}억원`
  if (n >= 10_000) return `${Math.round(n / 10_000).toLocaleString()}만원`
  return `${n.toLocaleString()}원`
}

function fmtKRWFull(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

const CHART_COLORS = ['#8BADD9', '#5B8EC4', '#3B72AF', '#2A5A96', '#1A447D', '#0F3060']

const TABS = [
  { id: 'overview',     label: '종합 현황',    icon: BarChart3 },
  { id: 'award',        label: '낙찰률 분석',  icon: TrendingUp },
  { id: 'anomaly',      label: '단가 이상 탐지', icon: AlertTriangle },
  { id: 'concentration',label: '거래처 집중도', icon: Users },
  { id: 'risk',         label: '위험 계약',    icon: ShieldAlert },
] as const

type TabId = typeof TABS[number]['id']

export function ContractAnalysisClient({ analysis }: { analysis: ContractAnalysis }) {
  const [tab, setTab] = useState<TabId>('overview')
  const { totalCount, totalAmount, byType, awardRate, contractors, anomalies, riskRows } = analysis

  const anomalyCount = anomalies.length
  const riskCount = riskRows.length

  return (
    <div className="space-y-5">
      {/* 탭 */}
      <div className="flex gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === id
                ? 'border-[#8BADD9] text-[#5B8EC4]'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
            {id === 'anomaly' && anomalyCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 text-amber-700 text-xs px-1.5 py-0.5 font-semibold">
                {anomalyCount}
              </span>
            )}
            {id === 'risk' && riskCount > 0 && (
              <span className="ml-1 rounded-full bg-red-100 text-red-600 text-xs px-1.5 py-0.5 font-semibold">
                {riskCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 종합 현황 ── */}
      {tab === 'overview' && (
        <div className="space-y-5">
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="총 계약 건수" value={`${totalCount}건`} sub="전체" color="blue" />
            <KpiCard label="총 계약 금액" value={fmtKRW(totalAmount)} sub={fmtKRWFull(totalAmount)} color="slate" />
            <KpiCard label="단가 이상 탐지" value={`${anomalyCount}건`} sub="z-score ≥ 1.5" color={anomalyCount > 0 ? 'amber' : 'green'} />
            <KpiCard label="위험 계약" value={`${riskCount}건`} sub="복수 위험 요인" color={riskCount > 0 ? 'red' : 'green'} />
          </div>

          {/* 유형별 차트 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">유형별 계약 금액</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={byType} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis
                    tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 10_000).toLocaleString()}만`}
                    tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52}
                  />
                  <Tooltip
                    formatter={(v) => [fmtKRWFull(Number(v)), '계약 금액']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={52}>
                    {byType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* 유형별 테이블 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">유형별 상세</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['유형', '건수', '금액', '비율'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${h !== '유형' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {byType.map(row => (
                    <tr key={row.type} className="hover:bg-muted/20">
                      <td className="px-4 py-2.5 font-medium">{row.label}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{row.count}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtKRWFull(row.amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#8BADD9] rounded-full" style={{ width: `${row.pct}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground w-8 text-right">{row.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 낙찰률 분석 ── */}
      {tab === 'award' && (
        <div className="space-y-5">
          {/* 낙찰률 대형 표시 */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center gap-8">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">경쟁입찰 낙찰률</p>
                  <p className={`text-6xl font-bold tabular-nums ${
                    awardRate.rate >= 70 ? 'text-green-600' : awardRate.rate >= 40 ? 'text-amber-500' : 'text-red-600'
                  }`}>
                    {awardRate.rate}<span className="text-2xl font-normal">%</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    입찰 {awardRate.bidCount}건 / (입찰 + 수의) {awardRate.bidCount + awardRate.privateCount}건
                  </p>
                </div>
                <div className="flex-1 w-full">
                  <div className="space-y-3">
                    <ProgressRow label="경쟁입찰" value={awardRate.bidCount} total={awardRate.bidCount + awardRate.privateCount} color="bg-blue-500" />
                    <ProgressRow label="수의계약" value={awardRate.privateCount} total={awardRate.bidCount + awardRate.privateCount} color="bg-red-400" />
                  </div>
                  <p className={`mt-4 text-xs px-3 py-2 rounded-lg ${
                    awardRate.rate >= 70
                      ? 'bg-green-50 text-green-700'
                      : awardRate.rate >= 40
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-red-50 text-red-700'
                  }`}>
                    {awardRate.rate >= 70
                      ? '경쟁입찰 비율이 양호합니다. (권장: 70% 이상)'
                      : awardRate.rate >= 40
                      ? '경쟁입찰 비율이 낮습니다. 수의계약 사유를 확인하세요. (권장: 70% 이상)'
                      : '경쟁입찰 비율이 매우 낮습니다. 수의계약 집중 여부를 감사하세요.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 금액 비교 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">입찰 / 수의계약 금액 비교</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['구분', '건수', '총 금액', '평균 금액'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${h !== '구분' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    { label: '경쟁입찰', count: awardRate.bidCount, amount: awardRate.bidAmount },
                    { label: '수의계약', count: awardRate.privateCount, amount: awardRate.privateAmount },
                  ].map(row => (
                    <tr key={row.label} className="hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{row.label}</td>
                      <td className="px-4 py-3 text-right tabular-nums">{row.count}건</td>
                      <td className="px-4 py-3 text-right tabular-nums">{fmtKRWFull(row.amount)}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {row.count > 0 ? fmtKRWFull(Math.round(row.amount / row.count)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── 단가 이상 탐지 ── */}
      {tab === 'anomaly' && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground px-1">
            동일 계약 유형 내 z-score ≥ 1.5인 계약을 표시합니다.
            유형별 3건 미만이면 분석에서 제외됩니다.
          </div>
          {anomalies.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">이상 탐지된 계약이 없습니다.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {anomalies.map(a => (
                <Card key={a.id} className={a.direction === 'high' ? 'border-amber-200 bg-amber-50/30' : 'border-blue-200 bg-blue-50/20'}>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{a.title}</span>
                          <Badge variant="outline" className="text-xs shrink-0">{a.typeLabel}</Badge>
                          <Badge
                            variant="outline"
                            className={`text-xs shrink-0 ${a.direction === 'high' ? 'bg-amber-50 text-amber-700 border-amber-300' : 'bg-blue-50 text-blue-700 border-blue-300'}`}
                          >
                            {a.direction === 'high' ? '▲ 과다' : '▼ 과소'}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{a.contractor_name}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold tabular-nums">{fmtKRWFull(a.amount)}</p>
                        <p className="text-xs text-muted-foreground">
                          z = <span className={`font-semibold ${a.direction === 'high' ? 'text-amber-600' : 'text-blue-600'}`}>{a.zScore > 0 ? '+' : ''}{a.zScore}</span>
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
                      <Stat label="그룹 평균" value={fmtKRW(a.groupMean)} />
                      <Stat label="표준편차" value={fmtKRW(a.groupStdDev)} />
                      <Stat label="편차 배율" value={`×${(Math.abs(a.amount - a.groupMean) / a.groupMean * 100).toFixed(0)}%`} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 거래처 집중도 ── */}
      {tab === 'concentration' && (
        <div className="space-y-5">
          {/* 상위 5개 차트 */}
          {contractors.slice(0, 5).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">상위 5개 거래처 금액</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={contractors.slice(0, 5)} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 10_000).toLocaleString()}만`}
                      tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                    />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} width={80} />
                    <Tooltip formatter={(v) => [fmtKRWFull(Number(v)), '계약 금액']} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={24}>
                      {contractors.slice(0, 5).map((c, i) => (
                        <Cell key={i} fill={c.flag ? '#f87171' : CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* 전체 테이블 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">거래처별 계약 현황</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/40">
                  <tr>
                    {['거래처명', '건수', '총 금액', '비중'].map(h => (
                      <th key={h} className={`px-4 py-2.5 text-xs font-medium text-muted-foreground ${h !== '거래처명' ? 'text-right' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {contractors.map(c => (
                    <tr key={c.name} className={c.flag ? 'bg-red-50/50' : 'hover:bg-muted/20'}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          {c.flag && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
                          <span className={c.flag ? 'font-semibold text-red-700' : ''}>{c.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{c.count}건</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtKRWFull(c.amount)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.flag ? 'bg-red-400' : 'bg-[#8BADD9]'}`}
                              style={{ width: `${Math.min(c.pct, 100)}%` }}
                            />
                          </div>
                          <span className={`text-xs w-10 text-right ${c.flag ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                            {c.pct}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground px-1">
            단일 거래처 비중 30% 초과 시 <span className="text-red-600 font-medium">거래처집중</span> 위험으로 표시됩니다.
          </p>
        </div>
      )}

      {/* ── 위험 계약 ── */}
      {tab === 'risk' && (
        <div className="space-y-3">
          {riskRows.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">위험 요인이 발견된 계약이 없습니다.</CardContent></Card>
          ) : (
            <>
              <div className="text-sm text-muted-foreground px-1 mb-2">
                계약서 미첨부, 기간 미입력, 수의계약 한도 초과, 만료 후 active 상태인 계약입니다.
              </div>
              {riskRows.map(r => (
                <Card key={r.id} className="border-red-100">
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{r.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{r.contractor_name}</p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {r.risks.map(risk => (
                            <Badge key={risk} variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                              {risk}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <p className="tabular-nums font-bold text-right shrink-0">{fmtKRWFull(r.amount)}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── 소형 컴포넌트 ───

function KpiCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: 'blue' | 'slate' | 'green' | 'amber' | 'red' }) {
  const styles = {
    blue:  { bg: 'bg-blue-50',  text: 'text-blue-700',  sub: 'text-blue-400' },
    slate: { bg: 'bg-slate-50', text: 'text-slate-800', sub: 'text-slate-400' },
    green: { bg: 'bg-green-50', text: 'text-green-700', sub: 'text-green-400' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', sub: 'text-amber-400' },
    red:   { bg: 'bg-red-50',   text: 'text-red-700',   sub: 'text-red-400' },
  }[color]
  return (
    <div className={`${styles.bg} rounded-2xl px-4 py-4`}>
      <p className={`text-xs ${styles.sub} mb-1`}>{label}</p>
      <p className={`text-xl font-bold ${styles.text} tabular-nums`}>{value}</p>
      <p className={`text-xs ${styles.sub} mt-0.5 truncate`}>{sub}</p>
    </div>
  )
}

function ProgressRow({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold tabular-nums">{value}건 ({pct}%)</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/60 rounded-lg px-2.5 py-1.5">
      <p className="text-muted-foreground text-[10px]">{label}</p>
      <p className="font-semibold text-xs tabular-nums">{value}</p>
    </div>
  )
}
