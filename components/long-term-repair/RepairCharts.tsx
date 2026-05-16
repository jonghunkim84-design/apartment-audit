'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line,
} from 'recharts'
import type { LongTermRepairRow } from '@/lib/actions/long-term-repair'

function fmtKRW(v: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(v)
}

function fmtWan(v: number) {
  const abs = Math.abs(v)
  if (abs >= 100_000_000) return `${Math.round(v / 100_000_000)}억`
  if (abs >= 10_000) return `${Math.round(v / 10_000)}만`
  return String(v)
}

const EMPTY = (
  <div className="flex items-center justify-center h-52 text-sm text-muted-foreground">
    데이터 없음
  </div>
)

// ── 연도별 계획액 vs 실행액 Bar Chart ────────────────────────────────────────

export function RepairBarChart({ rows }: { rows: LongTermRepairRow[] }) {
  const byYear = new Map<number, { planned: number; actual: number }>()
  for (const r of rows) {
    const prev = byYear.get(r.year) ?? { planned: 0, actual: 0 }
    byYear.set(r.year, {
      planned: prev.planned + r.planned_amount,
      actual: prev.actual + r.actual_amount,
    })
  }

  const data = [...byYear.entries()]
    .sort(([a], [b]) => a - b)
    .map(([year, { planned, actual }]) => ({
      year: `${year}년`,
      계획액: planned,
      실행액: actual,
    }))

  if (data.length === 0) return EMPTY

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis
          dataKey="year"
          tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false} tickLine={false}
        />
        <YAxis
          tickFormatter={fmtWan}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false} tickLine={false} width={52}
        />
        <Tooltip
          formatter={(value, name) => [fmtKRW(Number(value)), name]}
          contentStyle={{
            fontSize: 12, borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--background))',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="계획액" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="실행액" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── 월별 잔액 추이 Line Chart ─────────────────────────────────────────────────

export function RepairLineChart({ rows }: { rows: LongTermRepairRow[] }) {
  const data = [...rows]
    .filter(r => r.month !== null)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : (a.month ?? 0) - (b.month ?? 0))
    .slice(-24)
    .map(r => ({
      label: `${r.year}.${String(r.month).padStart(2, '0')}`,
      잔액: r.balance,
    }))

  if (data.length === 0) return EMPTY

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false} tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={fmtWan}
          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
          axisLine={false} tickLine={false} width={52}
        />
        <Tooltip
          formatter={(value) => [fmtKRW(Number(value)), '잔액']}
          contentStyle={{
            fontSize: 12, borderRadius: 8,
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--background))',
          }}
        />
        <Line
          type="monotone" dataKey="잔액"
          stroke="#22c55e" strokeWidth={2}
          dot={{ r: 3, fill: '#22c55e' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
