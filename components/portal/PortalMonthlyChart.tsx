'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

interface MonthlyData {
  year_month: string
  total_expense: number
  receipt_count: number
}

function fmtKRW(v: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(v)
}

export function PortalMonthlyChart({ data }: { data: MonthlyData[] }) {
  const sorted = [...data].sort((a, b) => a.year_month.localeCompare(b.year_month))
  const chartData = sorted.map(d => ({
    month: d.year_month.slice(5) + '월',
    지출액: d.total_expense,
  }))

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
        <YAxis
          tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 10000)}만`}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
          width={44}
        />
        <Tooltip
          formatter={(value) => [fmtKRW(Number(value)), '지출']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Legend />
        <Bar dataKey="지출액" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  )
}
