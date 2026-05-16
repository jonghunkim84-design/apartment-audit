'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { MiscIncomeRow, MiscIncomeCategory } from '@/lib/actions/misc-income'

const CATEGORY_META: Record<MiscIncomeCategory, { label: string; color: string }> = {
  recycling: { label: '재활용',    color: '#22c55e' },
  parking:   { label: '주차',      color: '#3b82f6' },
  rental:    { label: '광고/임대', color: '#a855f7' },
  interest:  { label: '이자',      color: '#eab308' },
  penalty:   { label: '과태료',    color: '#ef4444' },
  other:     { label: '기타',      color: '#6b7280' },
}

const CATEGORIES = Object.keys(CATEGORY_META) as MiscIncomeCategory[]

type ChartRow = { label: string } & Record<MiscIncomeCategory, number>

function buildChartData(rows: MiscIncomeRow[]): ChartRow[] {
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (11 - i))
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getMonth() + 1}월`

    const entry: ChartRow = { label } as ChartRow
    for (const cat of CATEGORIES) {
      entry[cat] = rows
        .filter((r) => r.income_date.startsWith(key) && r.category === cat)
        .reduce((s, r) => s + r.amount, 0)
    }
    return entry
  })
}

function fmtKRW(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}백만`
  if (v >= 10_000)    return `${(v / 10_000).toFixed(0)}만`
  return String(v)
}

export function MiscIncomeChart({ rows }: { rows: MiscIncomeRow[] }) {
  const data = buildChartData(rows)

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={fmtKRW}
          tick={{ fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={52}
        />
        <Tooltip
          formatter={(v, name) =>
            [new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(Number(v ?? 0)), name]
          }
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {CATEGORIES.map((cat) => (
          <Bar
            key={cat}
            dataKey={cat}
            stackId="a"
            fill={CATEGORY_META[cat].color}
            name={CATEGORY_META[cat].label}
            radius={cat === 'other' ? [2, 2, 0, 0] : undefined}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
