'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createExternalAuditFindings, type FindingInput } from '@/lib/actions/external-audits'

const ACFE_CATEGORIES = [
  '자산횡령', '부패', '재무제표부정', '가공거래', '김영란법위반', '기타',
] as const

const selectCls =
  'h-8 rounded-lg border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 w-full'

type Row = FindingInput & { _key: number }

function emptyRow(key: number): Row {
  return { _key: key, title: '', description: '', severity: 'medium', acfe_category: '', remediation_due: '' }
}

export function FindingsBatchClient({ externalAuditId }: { externalAuditId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rows, setRows] = useState<Row[]>([emptyRow(0)])
  const [nextKey, setNextKey] = useState(1)
  const [error, setError] = useState<string | null>(null)

  function addRow() {
    setRows(prev => [...prev, emptyRow(nextKey)])
    setNextKey(k => k + 1)
  }

  function removeRow(key: number) {
    if (rows.length === 1) return
    setRows(prev => prev.filter(r => r._key !== key))
  }

  function updateRow(key: number, field: keyof FindingInput, value: string) {
    setRows(prev => prev.map(r => r._key === key ? { ...r, [field]: value } : r))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const valid = rows.filter(r => r.title.trim())
    if (valid.length === 0) { setError('지적사항을 최소 1건 입력하세요.'); return }

    startTransition(async () => {
      try {
        await createExternalAuditFindings(externalAuditId, valid)
        router.push('/external-audits')
      } catch (err) {
        setError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  const validCount = rows.filter(r => r.title.trim()).length

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">지적사항 일괄 입력</CardTitle>
        <Button type="button" variant="outline" size="sm" onClick={addRow}>
          <Plus className="size-3.5 mr-1" />
          행 추가
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-y-2">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="text-left px-1 pb-1 font-medium min-w-[200px]">지적사항 제목 *</th>
                  <th className="text-left px-1 pb-1 font-medium min-w-[200px]">내용</th>
                  <th className="text-left px-1 pb-1 font-medium w-[90px]">심각도</th>
                  <th className="text-left px-1 pb-1 font-medium w-[130px]">ACFE 분류</th>
                  <th className="text-left px-1 pb-1 font-medium w-[130px]">시정 기한</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row._key} className="align-top">
                    <td className="px-1">
                      <Input
                        value={row.title}
                        onChange={e => updateRow(row._key, 'title', e.target.value)}
                        placeholder="지적사항 제목"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-1">
                      <Input
                        value={row.description}
                        onChange={e => updateRow(row._key, 'description', e.target.value)}
                        placeholder="상세 내용"
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-1">
                      <select
                        value={row.severity}
                        onChange={e => updateRow(row._key, 'severity', e.target.value as FindingInput['severity'])}
                        className={selectCls}
                      >
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </select>
                    </td>
                    <td className="px-1">
                      <select
                        value={row.acfe_category}
                        onChange={e => updateRow(row._key, 'acfe_category', e.target.value)}
                        className={selectCls}
                      >
                        <option value="">선택 안함</option>
                        {ACFE_CATEGORIES.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-1">
                      <Input
                        type="date"
                        value={row.remediation_due}
                        onChange={e => updateRow(row._key, 'remediation_due', e.target.value)}
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="px-1 pt-1">
                      <button
                        type="button"
                        onClick={() => removeRow(row._key)}
                        disabled={rows.length === 1}
                        className="text-muted-foreground hover:text-destructive disabled:opacity-30 transition-colors"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={isPending || validCount === 0}>
              {isPending ? '저장 중...' : `${validCount}건 저장`}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/external-audits')}
              disabled={isPending}
            >
              나중에 입력
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
