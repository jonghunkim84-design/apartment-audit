'use client'

import { useRef, useState, useTransition } from 'react'
import { Trash2, Paperclip, ExternalLink, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createMiscIncome,
  deleteMiscIncome,
  updatePaymentStatus,
  uploadMiscIncomeFile,
  type MiscIncomeRow,
  type MiscIncomeCategory,
} from '@/lib/actions/misc-income'

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

const CATEGORY_LABELS: Record<MiscIncomeCategory, string> = {
  recycling: '재활용',
  parking:   '주차',
  rental:    '광고/임대',
  interest:  '이자',
  penalty:   '과태료',
  other:     '기타',
}

const CATEGORY_CLS: Record<MiscIncomeCategory, string> = {
  recycling: 'bg-green-50 text-green-700 border-green-300',
  parking:   'bg-blue-50 text-blue-700 border-blue-300',
  rental:    'bg-purple-50 text-purple-700 border-purple-300',
  interest:  'bg-yellow-50 text-yellow-700 border-yellow-300',
  penalty:   'bg-red-50 text-red-700 border-red-300',
  other:     'bg-gray-100 text-gray-600 border-gray-300',
}

const selectCls = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function MiscIncomeClient({ initialRows }: { initialRows: MiscIncomeRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [category, setCategory] = useState<MiscIncomeCategory>('recycling')
  const [amountInput, setAmountInput] = useState('')
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10))
  const [descInput, setDescInput] = useState('')
  const [accountInput, setAccountInput] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'received'>('received')
  const [receivedAtInput, setReceivedAtInput] = useState('')
  const [waiverInput, setWaiverInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(amountInput)
    if (isNaN(amount) || amount <= 0) { setFormError('금액을 올바르게 입력하세요.'); return }
    if (!dateInput) { setFormError('날짜를 입력하세요.'); return }
    const waiverRate = waiverInput ? parseFloat(waiverInput) / 100 : undefined
    if (waiverRate !== undefined && (isNaN(waiverRate) || waiverRate < 0 || waiverRate > 1)) {
      setFormError('감면율은 0~100 사이로 입력하세요.')
      return
    }
    setFormError(null)
    startTransition(async () => {
      try {
        await createMiscIncome({
          category,
          amount,
          income_date: dateInput,
          description: descInput.trim() || undefined,
          account_number: accountInput.trim() || undefined,
          payment_status: paymentStatus,
          received_at: receivedAtInput || undefined,
          waiver_rate: waiverRate,
        })
        setAmountInput('')
        setDescInput('')
        setAccountInput('')
        setWaiverInput('')
        setPaymentStatus('received')
        setReceivedAtInput('')
      } catch (err) {
        setFormError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    setDeletingId(id)
    startTransition(async () => {
      try { await deleteMiscIncome(id) }
      finally { setDeletingId(null) }
    })
  }

  function handleStatusToggle(row: MiscIncomeRow) {
    const next = row.payment_status === 'received' ? 'pending' : 'received'
    startTransition(async () => { await updatePaymentStatus(row.id, next) })
  }

  async function handleFileChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await uploadMiscIncomeFile(id, fd)
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  return (
    <div className="space-y-6">
      {/* 등록 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">신규 잡수입 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">유형 *</label>
                <select value={category} onChange={e => setCategory(e.target.value as MiscIncomeCategory)} className={selectCls}>
                  {(Object.entries(CATEGORY_LABELS) as [MiscIncomeCategory, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">금액 (원) *</label>
                <Input type="number" placeholder="0" value={amountInput} onChange={e => setAmountInput(e.target.value)} min={0} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">날짜 *</label>
                <Input type="date" value={dateInput} onChange={e => setDateInput(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">입금계좌</label>
                <Input placeholder="예: 국민 123-456" value={accountInput} onChange={e => setAccountInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">수납 상태</label>
                <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value as 'pending' | 'received')} className={selectCls}>
                  <option value="received">수납완료</option>
                  <option value="pending">미수납</option>
                </select>
              </div>
              {paymentStatus === 'received' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">수납일</label>
                  <Input type="date" value={receivedAtInput} onChange={e => setReceivedAtInput(e.target.value)} />
                </div>
              )}
              {category === 'parking' && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">감면율 (%)</label>
                  <Input type="number" placeholder="0" value={waiverInput} onChange={e => setWaiverInput(e.target.value)} min={0} max={100} step={0.1} />
                </div>
              )}
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">설명</label>
                <Input placeholder="메모..." value={descInput} onChange={e => setDescInput(e.target.value)} />
              </div>
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? '저장 중...' : '등록'}
              </Button>
              {category === 'rental' && (
                <p className="text-xs text-muted-foreground">
                  <AlertTriangle className="inline size-3 mr-0.5 text-yellow-500" />
                  광고/임대는 등록 후 계약서 파일을 첨부하세요.
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 이력 테이블 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">잡수입 이력 ({initialRows.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">등록된 잡수입이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['날짜', '유형', '금액', '설명', '입금계좌', '감면율', '상태', '이상', '파일', ''].map((h) => (
                      <th key={h} className={cn(
                        'px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap text-left',
                        h === '금액' && 'text-right',
                      )}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {initialRows.map((row) => {
                    const hasFlag = row.flag_missing_contract || row.flag_overdue || row.flag_excessive_waiver
                    return (
                      <tr key={row.id} className={cn('hover:bg-muted/30', hasFlag && 'bg-yellow-50/40')}>
                        <td className="px-4 py-3 whitespace-nowrap tabular-nums text-muted-foreground text-xs">
                          {row.income_date.slice(0, 10)}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={cn('text-xs', CATEGORY_CLS[row.category])}>
                            {CATEGORY_LABELS[row.category]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap font-medium">
                          {fmtKRW(row.amount)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground max-w-[120px] truncate text-xs">
                          {row.description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                          {row.account_number ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-xs tabular-nums">
                          {row.waiver_rate != null
                            ? <span className={cn(row.flag_excessive_waiver && 'text-red-600 font-semibold')}>
                                {(row.waiver_rate * 100).toFixed(1)}%
                              </span>
                            : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => handleStatusToggle(row)}
                            disabled={isPending}
                            className={cn(
                              'text-xs px-2 py-0.5 rounded-full border font-medium transition-colors',
                              row.payment_status === 'received'
                                ? 'bg-green-50 text-green-700 border-green-300 hover:bg-green-100'
                                : 'bg-orange-50 text-orange-700 border-orange-300 hover:bg-orange-100',
                            )}
                          >
                            {row.payment_status === 'received' ? '수납완료' : '미수납'}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            {row.flag_missing_contract && (
                              <span className="text-xs text-orange-600 font-medium whitespace-nowrap">계약서미첨부</span>
                            )}
                            {row.flag_overdue && (
                              <span className="text-xs text-red-600 font-medium whitespace-nowrap">미수금회수필요</span>
                            )}
                            {row.flag_excessive_waiver && (
                              <span className="text-xs text-red-600 font-medium whitespace-nowrap">주차감면과다</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            ref={el => { if (el) fileRefs.current.set(row.id, el) }}
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,.pdf,.xls,.xlsx"
                            onChange={e => handleFileChange(row.id, e)}
                          />
                          {row.evidence_url ? (
                            <div className="flex items-center gap-1.5">
                              <a href={row.evidence_url} target="_blank" rel="noopener noreferrer"
                                className="text-primary hover:text-primary/80">
                                <ExternalLink className="size-3.5" />
                              </a>
                              <button type="button" onClick={() => fileRefs.current.get(row.id)?.click()}
                                className="text-xs text-muted-foreground hover:text-foreground">교체</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => fileRefs.current.get(row.id)?.click()}
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
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
