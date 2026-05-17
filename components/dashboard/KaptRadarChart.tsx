'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts'
import { RefreshCw, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { KaptRow } from '@/lib/actions/kapt'

const CATEGORY_LABEL: Record<string, string> = {
  general_manage: '일반관리비',
  security:       '경비비',
  cleaning:       '청소비',
  repair:         '수선유지비',
  elevator:       '승강기유지비',
  other:          '기타관리비',
}

interface Props {
  initialData: KaptRow[]
}

export function KaptRadarChart({ initialData }: Props) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [isLoading, setIsLoading] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  async function syncKapt() {
    setIsLoading(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const res = await fetch('/api/kapt', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '동기화 실패')
      const s = json.summary
      setSyncResult(
        `${s.yearMonth} 동기화 완료 — 유사단지 ${s.peerCount}개 비교` +
        (s.exceededCategories?.length
          ? ` · [평균초과] ${s.exceededCategories.join(', ')}`
          : '')
      )
      startTransition(() => router.refresh())
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setIsLoading(false)
    }
  }

  const yearMonth = data[0]?.year_month ?? null

  // normalize to % of average (avg=100)
  const chartData = Object.keys(CATEGORY_LABEL).map(cat => {
    const row = data.find(r => r.category === cat)
    const ourPct = row && row.avg_amount > 0
      ? Math.round(row.our_amount / row.avg_amount * 100)
      : row?.our_amount ? 100 : 0
    return {
      category: CATEGORY_LABEL[cat],
      우리단지: ourPct,
      평균: 100,
    }
  })

  const exceeded = data.filter(r => r.avg_amount > 0 && r.our_amount > r.avg_amount * 1.3)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">K-apt 유사단지 관리비 비교</CardTitle>
            {yearMonth && (
              <p className="text-xs text-muted-foreground mt-0.5">{yearMonth} 기준 · 평균 대비 % (100 = 평균)</p>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={syncKapt} disabled={isLoading} className="shrink-0">
            {isLoading
              ? <><RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />동기화 중…</>
              : <><Play className="h-3.5 w-3.5 mr-1.5" />K-apt 동기화</>
            }
          </Button>
        </div>

        {syncResult && (
          <p className="mt-2 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs text-green-800">
            {syncResult}
          </p>
        )}
        {syncError && (
          <p className="mt-2 rounded-md border border-red-300 bg-red-50 px-3 py-1.5 text-xs text-red-800">
            오류: {syncError}
          </p>
        )}

        {exceeded.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {exceeded.map(r => (
              <Badge
                key={r.category}
                variant="outline"
                className="border-orange-300 bg-orange-50 text-orange-700 text-xs"
              >
                평균초과 · {CATEGORY_LABEL[r.category]}
                {' '}({Math.round(r.our_amount / r.avg_amount * 100)}%)
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">
            K-apt 동기화를 실행하면 유사단지 비교 데이터가 표시됩니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            {/* 레이더 차트 */}
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={chartData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="category" tick={{ fontSize: 11 }} />
                <Radar
                  name="우리단지"
                  dataKey="우리단지"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.25}
                />
                <Radar
                  name="유사단지 평균"
                  dataKey="평균"
                  stroke="#94a3b8"
                  fill="#94a3b8"
                  fillOpacity={0.10}
                  strokeDasharray="4 4"
                />
                <Tooltip
                  formatter={(value: unknown, name: string | number | undefined) => [`${value}%`, String(name ?? '')]}
                />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>

            {/* 수치 비교 테이블 */}
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="text-left pb-2 font-medium">항목</th>
                    <th className="text-right pb-2 font-medium">우리단지</th>
                    <th className="text-right pb-2 font-medium">유사단지</th>
                    <th className="text-right pb-2 pr-1 font-medium w-14">비율</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {Object.keys(CATEGORY_LABEL).map(cat => {
                    const row = data.find(r => r.category === cat)
                    if (!row) return null
                    const pct = row.avg_amount > 0
                      ? Math.round(row.our_amount / row.avg_amount * 100)
                      : null
                    const barWidth = pct !== null ? Math.min(pct, 200) / 2 : 0
                    const barColor =
                      pct === null ? 'bg-gray-300' :
                      pct > 130    ? 'bg-orange-500' :
                      pct > 100    ? 'bg-yellow-400' :
                      'bg-blue-500'
                    const pctColor =
                      pct === null ? 'text-muted-foreground' :
                      pct > 130    ? 'text-orange-600 font-bold' :
                      pct > 100    ? 'text-yellow-600 font-semibold' :
                      'text-blue-600'
                    return (
                      <tr key={cat} className="group">
                        <td className="py-2 pr-3 text-xs font-medium whitespace-nowrap">
                          {CATEGORY_LABEL[cat]}
                        </td>
                        <td className="py-2 pr-2 text-right tabular-nums text-xs">
                          {row.our_amount > 0
                            ? `${row.our_amount.toLocaleString()}원`
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums text-xs text-muted-foreground">
                          {row.avg_amount > 0
                            ? `${row.avg_amount.toLocaleString()}원`
                            : <span>—</span>}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-col items-end gap-0.5">
                            <span className={cn('text-xs tabular-nums', pctColor)}>
                              {pct !== null ? `${pct}%` : '—'}
                            </span>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className={cn('h-full rounded-full transition-all', barColor)}
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[10px] text-muted-foreground mt-3">
                원/세대 기준 · 막대 100% = 유사단지 평균 · 주황 = 130% 초과
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
