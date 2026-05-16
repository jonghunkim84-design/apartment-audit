'use client'

import { useRef, useState, useTransition } from 'react'
import { Trash2, Paperclip, ExternalLink } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createRepairEntry,
  deleteRepairEntry,
  uploadRepairFile,
  type LongTermRepairRow,
} from '@/lib/actions/long-term-repair'

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

export function RepairClient({ initialRows }: { initialRows: LongTermRepairRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [yearInput, setYearInput] = useState(String(new Date().getFullYear()))
  const [monthInput, setMonthInput] = useState('')
  const [plannedInput, setPlannedInput] = useState('')
  const [actualInput, setActualInput] = useState('')
  const [balanceInput, setBalanceInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const year = parseInt(yearInput)
    const month = monthInput ? parseInt(monthInput) : null
    const planned = parseInt(plannedInput)
    const actual = parseInt(actualInput)
    const balance = parseInt(balanceInput)

    if (isNaN(year) || isNaN(planned) || isNaN(actual) || isNaN(balance)) {
      setFormError('연도와 금액을 올바르게 입력하세요.')
      return
    }

    setFormError(null)
    startTransition(async () => {
      try {
        await createRepairEntry({ year, month, planned_amount: planned, actual_amount: actual, balance, description: descInput.trim() || undefined })
        setPlannedInput('')
        setActualInput('')
        setBalanceInput('')
        setDescInput('')
        setMonthInput('')
      } catch (err) {
        setFormError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    setDeletingId(id)
    startTransition(async () => {
      try { await deleteRepairEntry(id) }
      finally { setDeletingId(null) }
    })
  }

  async function handleFileChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await uploadRepairFile(id, fd)
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* 입력 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">신규 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">연도 *</label>
                <Input type="number" placeholder="2026" value={yearInput}
                  onChange={e => setYearInput(e.target.value)} min={2000} max={2100} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">월 (선택)</label>
                <select
                  value={monthInput}
                  onChange={e => setMonthInput(e.target.value)}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">연간</option>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={String(i + 1)}>{i + 1}월</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">계획액 (원) *</label>
                <Input type="number" placeholder="0" value={plannedInput}
                  onChange={e => setPlannedInput(e.target.value)} min={0} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">실행액 (원) *</label>
                <Input type="number" placeholder="0" value={actualInput}
                  onChange={e => setActualInput(e.target.value)} min={0} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">잔액 (원) *</label>
                <Input type="number" placeholder="0" value={balanceInput}
                  onChange={e => setBalanceInput(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">비고</label>
                <Input type="text" placeholder="메모..." value={descInput}
                  onChange={e => setDescInput(e.target.value)} />
              </div>
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? '저장 중...' : '등록'}
              </Button>
              <p className="text-xs text-muted-foreground">
                실행액이 계획액 초과 시 CRITICAL 감사 소견이 자동 등록됩니다.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 이력 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">집행 이력 ({initialRows.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">등록된 데이터가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['기간', '계획액', '실행액', '잔액', '비고', '상태', '파일', ''].map(h => (
                      <th key={h} className={cn(
                        'px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap',
                        ['계획액', '실행액', '잔액'].includes(h) ? 'text-right' : 'text-left'
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {initialRows.map(row => (
                    <tr key={row.id} className={cn('hover:bg-muted/30', row.is_unplanned && 'bg-red-50/50')}>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">
                        {row.year}년 {row.month ? `${row.month}월` : <span className="text-muted-foreground text-xs">(연간)</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {fmtKRW(row.planned_amount)}
                      </td>
                      <td className={cn('px-4 py-3 text-right tabular-nums whitespace-nowrap', row.is_unplanned && 'text-red-600 font-semibold')}>
                        {fmtKRW(row.actual_amount)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                        {fmtKRW(row.balance)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                        {row.description ?? '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.is_unplanned ? (
                          <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300 whitespace-nowrap">
                            계획외 CRITICAL
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">정상</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <input
                          ref={el => { if (el) fileRefs.current.set(row.id, el) }}
                          type="file"
                          className="hidden"
                          accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                          onChange={e => handleFileChange(row.id, e)}
                        />
                        {row.file_url ? (
                          <div className="flex items-center gap-1.5">
                            <a href={row.file_url} target="_blank" rel="noopener noreferrer"
                              className="text-primary hover:text-primary/80">
                              <ExternalLink className="size-3.5" />
                            </a>
                            <button type="button"
                              onClick={() => fileRefs.current.get(row.id)?.click()}
                              className="text-xs text-muted-foreground hover:text-foreground">
                              교체
                            </button>
                          </div>
                        ) : (
                          <button type="button"
                            onClick={() => fileRefs.current.get(row.id)?.click()}
                            disabled={uploadingId === row.id}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                            <Paperclip className="size-3.5" />
                            {uploadingId === row.id ? '...' : '첨부'}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="text-muted-foreground hover:text-destructive transition-colors">
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
