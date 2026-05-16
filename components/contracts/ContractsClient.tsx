'use client'

import { useRef, useState, useTransition } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type ColumnFiltersState,
  type SortingState,
} from '@tanstack/react-table'
import { Trash2, Paperclip, ExternalLink, AlertTriangle, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createContract,
  deleteContract,
  uploadContractFile,
} from '@/lib/actions/contracts'
import type { ContractRow } from '@/lib/contracts-types'
import { validateBusinessNumber } from '@/lib/utils/business-number'

function fmtKRW(n: number) {
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

function fmtDate(d: string | null) {
  return d ? d.slice(0, 10) : '—'
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  bid: '입찰',
  private_contract: '수의계약',
  service: '용역',
  construction: '공사',
  supply: '물품',
  other: '기타',
}

const STATUS_LABELS: Record<string, string> = {
  active: '진행중',
  expired: '만료',
  terminated: '해지',
}

const STATUS_CLS: Record<string, string> = {
  active: 'bg-green-50 text-green-700 border-green-300',
  expired: 'bg-gray-100 text-gray-600 border-gray-300',
  terminated: 'bg-red-50 text-red-700 border-red-300',
}

const col = createColumnHelper<ContractRow>()

const columns = [
  col.accessor('title', {
    header: '계약명',
    cell: (info) => <span className="font-medium">{info.getValue()}</span>,
  }),
  col.accessor('contractor_name', {
    header: '업체명',
    cell: (info) => {
      const row = info.row.original
      return (
        <div className="flex flex-col gap-0.5">
          <span>{info.getValue()}</span>
          {row.flag_concentration && (
            <span className="flex items-center gap-1 text-xs text-orange-600 font-medium">
              <AlertCircle className="size-3" />거래처집중
            </span>
          )}
        </div>
      )
    },
  }),
  col.accessor('business_number', {
    header: '사업자번호',
    cell: (info) => {
      const v = info.getValue()
      if (!v) return <span className="text-muted-foreground">—</span>
      const formatted = v.replace(/(\d{3})(\d{2})(\d{5})/, '$1-$2-$3')
      return <span className="tabular-nums">{formatted}</span>
    },
  }),
  col.accessor('contract_amount', {
    header: '계약금액',
    cell: (info) => {
      const row = info.row.original
      return (
        <div className="text-right">
          <span className={cn('tabular-nums', row.flag_over_limit && 'text-red-600 font-semibold')}>
            {fmtKRW(info.getValue())}
          </span>
          {row.flag_over_limit && (
            <div className="flex items-center justify-end gap-1 text-xs text-red-600 font-medium mt-0.5">
              <AlertTriangle className="size-3" />수의계약한도초과
            </div>
          )}
        </div>
      )
    },
  }),
  col.accessor('contract_type', {
    header: '유형',
    cell: (info) => (
      <Badge variant="outline" className="text-xs whitespace-nowrap">
        {CONTRACT_TYPE_LABELS[info.getValue()] ?? info.getValue()}
      </Badge>
    ),
    filterFn: 'equals',
  }),
  col.accessor('contract_date', {
    header: '계약일',
    cell: (info) => <span className="tabular-nums">{fmtDate(info.getValue())}</span>,
  }),
  col.accessor('contract_start', {
    header: '시작일',
    cell: (info) => <span className="tabular-nums">{fmtDate(info.getValue())}</span>,
  }),
  col.accessor('contract_end', {
    header: '종료일',
    cell: (info) => <span className="tabular-nums">{fmtDate(info.getValue())}</span>,
  }),
  col.accessor('status', {
    header: '상태',
    cell: (info) => {
      const v = info.getValue()
      return (
        <Badge variant="outline" className={cn('text-xs', STATUS_CLS[v])}>
          {STATUS_LABELS[v] ?? v}
        </Badge>
      )
    },
  }),
  col.display({
    id: 'document',
    header: '파일',
    cell: () => null,
  }),
  col.display({
    id: 'actions',
    header: '',
    cell: () => null,
  }),
]

export function ContractsClient({ initialRows }: { initialRows: ContractRow[] }) {
  const [isPending, startTransition] = useTransition()
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [typeFilter, setTypeFilter] = useState<string>('all')

  // Form state
  const [titleInput, setTitleInput] = useState('')
  const [contractorInput, setContractorInput] = useState('')
  const [bizNoInput, setBizNoInput] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [typeInput, setTypeInput] = useState<ContractRow['contract_type']>('bid')
  const [contractDateInput, setContractDateInput] = useState('')
  const [startDateInput, setStartDateInput] = useState('')
  const [endDateInput, setEndDateInput] = useState('')
  const [statusInput, setStatusInput] = useState<ContractRow['status']>('active')
  const [notesInput, setNotesInput] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Map<string, HTMLInputElement>>(new Map())

  const filteredRows = typeFilter === 'all'
    ? initialRows
    : initialRows.filter((r) => r.contract_type === typeFilter)

  const table = useReactTable({
    data: filteredRows,
    columns,
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(amountInput)
    if (!titleInput.trim()) { setFormError('계약명을 입력하세요.'); return }
    if (!contractorInput.trim()) { setFormError('업체명을 입력하세요.'); return }
    if (isNaN(amount) || amount <= 0) { setFormError('계약금액을 올바르게 입력하세요.'); return }
    if (bizNoInput && !validateBusinessNumber(bizNoInput)) {
      setFormError('사업자번호 형식이 올바르지 않습니다. (체크섬 검증 실패)')
      return
    }
    setFormError(null)
    startTransition(async () => {
      try {
        await createContract({
          title: titleInput.trim(),
          contractor_name: contractorInput.trim(),
          business_number: bizNoInput.trim() || undefined,
          contract_amount: amount,
          contract_type: typeInput,
          contract_date: contractDateInput || undefined,
          contract_start: startDateInput || undefined,
          contract_end: endDateInput || undefined,
          status: statusInput,
          notes: notesInput.trim() || undefined,
        })
        setTitleInput('')
        setContractorInput('')
        setBizNoInput('')
        setAmountInput('')
        setContractDateInput('')
        setStartDateInput('')
        setEndDateInput('')
        setNotesInput('')
      } catch (err) {
        setFormError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  function handleDelete(id: string) {
    if (!confirm('삭제하시겠습니까?')) return
    setDeletingId(id)
    startTransition(async () => {
      try { await deleteContract(id) }
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
      await uploadContractFile(id, fd)
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  const selectCls = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

  return (
    <div className="space-y-6">
      {/* 등록 폼 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">신규 계약 등록</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              <div className="space-y-1 lg:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">계약명 *</label>
                <Input placeholder="예: 청소용역 계약" value={titleInput} onChange={e => setTitleInput(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">업체명 *</label>
                <Input placeholder="예: (주)청결서비스" value={contractorInput} onChange={e => setContractorInput(e.target.value)} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">사업자번호</label>
                <Input placeholder="000-00-00000" value={bizNoInput} onChange={e => setBizNoInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">계약금액 (원) *</label>
                <Input type="number" placeholder="0" value={amountInput} onChange={e => setAmountInput(e.target.value)} min={0} required />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">계약 유형 *</label>
                <select value={typeInput} onChange={e => setTypeInput(e.target.value as ContractRow['contract_type'])} className={selectCls}>
                  <option value="bid">입찰</option>
                  <option value="private_contract">수의계약</option>
                  <option value="service">용역</option>
                  <option value="construction">공사</option>
                  <option value="supply">물품</option>
                  <option value="other">기타</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">계약일</label>
                <Input type="date" value={contractDateInput} onChange={e => setContractDateInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">시작일</label>
                <Input type="date" value={startDateInput} onChange={e => setStartDateInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">종료일</label>
                <Input type="date" value={endDateInput} onChange={e => setEndDateInput(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">상태</label>
                <select value={statusInput} onChange={e => setStatusInput(e.target.value as ContractRow['status'])} className={selectCls}>
                  <option value="active">진행중</option>
                  <option value="expired">만료</option>
                  <option value="terminated">해지</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground">비고</label>
                <Input placeholder="메모..." value={notesInput} onChange={e => setNotesInput(e.target.value)} />
              </div>
            </div>

            {formError && <p className="text-xs text-destructive">{formError}</p>}

            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? '저장 중...' : '등록'}
              </Button>
              <p className="text-xs text-muted-foreground">
                수의계약 2천만원 초과 시 [수의계약한도초과] 플래그가 자동 표시됩니다.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* 필터 + 테이블 */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">계약 목록 ({filteredRows.length}건)</CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">유형 필터:</span>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs outline-none focus-visible:border-ring">
              <option value="all">전체</option>
              <option value="bid">입찰</option>
              <option value="private_contract">수의계약</option>
              <option value="service">용역</option>
              <option value="construction">공사</option>
              <option value="supply">물품</option>
              <option value="other">기타</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">등록된 계약이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {table.getHeaderGroups().map(hg =>
                      hg.headers.map(header => (
                        <th key={header.id}
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap text-left',
                            header.column.getCanSort() && 'cursor-pointer hover:text-foreground',
                            header.id === 'contract_amount' && 'text-right',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() === 'asc' ? ' ↑' : header.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                        </th>
                      ))
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {table.getRowModel().rows.map(row => {
                    const r = row.original
                    return (
                      <tr key={r.id} className={cn('hover:bg-muted/30', r.flag_over_limit && 'bg-red-50/40')}>
                        {row.getVisibleCells().map(cell => {
                          if (cell.column.id === 'document') {
                            return (
                              <td key={cell.id} className="px-4 py-3">
                                <input
                                  ref={el => { if (el) fileRefs.current.set(r.id, el) }}
                                  type="file"
                                  className="hidden"
                                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx,.xls,.xlsx"
                                  onChange={e => handleFileChange(r.id, e)}
                                />
                                {r.document_url ? (
                                  <div className="flex items-center gap-1.5">
                                    <a href={r.document_url} target="_blank" rel="noopener noreferrer"
                                      className="text-primary hover:text-primary/80">
                                      <ExternalLink className="size-3.5" />
                                    </a>
                                    <button type="button" onClick={() => fileRefs.current.get(r.id)?.click()}
                                      className="text-xs text-muted-foreground hover:text-foreground">
                                      교체
                                    </button>
                                  </div>
                                ) : (
                                  <button type="button" onClick={() => fileRefs.current.get(r.id)?.click()}
                                    disabled={uploadingId === r.id}
                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                                    <Paperclip className="size-3.5" />
                                    {uploadingId === r.id ? '...' : '첨부'}
                                  </button>
                                )}
                              </td>
                            )
                          }
                          if (cell.column.id === 'actions') {
                            return (
                              <td key={cell.id} className="px-4 py-3">
                                <button type="button" onClick={() => handleDelete(r.id)}
                                  disabled={deletingId === r.id}
                                  className="text-muted-foreground hover:text-destructive transition-colors">
                                  <Trash2 className="size-3.5" />
                                </button>
                              </td>
                            )
                          }
                          return (
                            <td key={cell.id} className={cn(
                              'px-4 py-3 whitespace-nowrap',
                              cell.column.id === 'contract_amount' && 'text-right',
                              cell.column.id === 'notes' && 'max-w-[140px] truncate text-muted-foreground',
                            )}>
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          )
                        })}
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
