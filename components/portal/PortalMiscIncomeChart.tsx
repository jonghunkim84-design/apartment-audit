'use client'

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

const CATEGORY_LABEL: Record<string, string> = {
  recycling: '재활용', parking: '주차', rental: '임대',
  interest: '이자', overdue: '연체료', other: '기타',
}

interface TypeItem { type: string; amount: number; count: number }

function fmtKRW(v: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(v)
}

export function PortalMiscIncomeChart({ byType }: { byType: TypeItem[] }) {
  const chartData = byType.map(d => ({
    name: CATEGORY_LABEL[d.type] ?? d.type,
    금액: d.amount,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
        <XAxis
          type="number"
          tickFormatter={v => v === 0 ? '0' : `${Math.round(v / 10000)}만`}
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} width={48} />
        <Tooltip
          formatter={(value) => [fmtKRW(Number(value)), '수입']}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}
          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
        />
        <Bar dataKey="금액" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  )
}
