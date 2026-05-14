'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AlertCircle, Plus, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { UploadDropzone } from '@/components/receipts/UploadDropzone'
import type { Tables } from '@/types/database'

type Receipt = Pick<
  Tables<'receipts'>,
  | 'id'
  | 'receipt_date'
  | 'merchant_name'
  | 'merchant_category'
  | 'amount'
  | 'supply_amount'
  | 'tax_amount'
  | 'payment_method'
  | 'card_company'
  | 'confidence_score'
  | 'status'
  | 'policy_flags'
  | 'created_at'
>

const STATUS_META: Record<
  NonNullable<Receipt['status']>,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  approved:      { label: '승인',     variant: 'default',     className: 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' },
  manual_review: { label: '검수 필요', variant: 'outline',     className: 'bg-yellow-50 text-yellow-700 border-yellow-300 hover:bg-yellow-50' },
  rejected:      { label: '반려',     variant: 'destructive', className: '' },
  pending:       { label: '대기',     variant: 'secondary',   className: '' },
  processing:    { label: '처리 중',  variant: 'secondary',   className: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-50' },
}

function formatKRW(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

export function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const handleUploadSuccess = () => {
    // 목록 새로고침 후 다이얼로그 유지 (결과 카드 확인 가능)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">영수증</h1>
          <p className="text-muted-foreground text-sm mt-1">
            총 {receipts.length}건
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          영수증 업로드
        </Button>
      </div>

      {/* 업로드 다이얼로그 */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>영수증 업로드</DialogTitle>
          </DialogHeader>
          <UploadDropzone onSuccess={handleUploadSuccess} />
        </DialogContent>
      </Dialog>

      {/* 목록 테이블 */}
      {receipts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <AlertCircle className="h-8 w-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">업로드된 영수증이 없습니다</p>
          <p className="text-xs text-muted-foreground/60 mt-1">오른쪽 상단 버튼으로 업로드하세요</p>
        </div>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[90px]">날짜</TableHead>
                <TableHead>가맹점</TableHead>
                <TableHead className="w-[90px]">카테고리</TableHead>
                <TableHead className="w-[110px] text-right">금액</TableHead>
                <TableHead className="w-[90px]">결제수단</TableHead>
                <TableHead className="w-[80px] text-center">신뢰도</TableHead>
                <TableHead className="w-[90px] text-center">상태</TableHead>
                <TableHead className="w-[40px] text-center">이상</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receipts.map((r) => {
                const meta = STATUS_META[r.status ?? 'pending']
                const hasFlag = r.policy_flags !== null && Object.keys(r.policy_flags as object).length > 0
                const conf = r.confidence_score ? Math.round(Number(r.confidence_score) * 100) : null
                const confColor =
                  conf === null ? '' :
                  conf >= 85 ? 'text-green-600' :
                  conf >= 65 ? 'text-yellow-600' : 'text-red-600'

                return (
                  <TableRow key={r.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm tabular-nums">
                      {formatDate(r.receipt_date)}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium leading-snug">
                        {r.merchant_name ?? <span className="text-muted-foreground">미인식</span>}
                      </p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.merchant_category ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-right tabular-nums">
                      {formatKRW(r.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground capitalize">
                      {r.payment_method ?? '—'}
                      {r.card_company && (
                        <span className="block text-xs">{r.card_company}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn('text-sm font-medium tabular-nums', confColor)}>
                        {conf !== null ? `${conf}%` : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant={meta.variant}
                        className={cn('text-xs', meta.className)}
                      >
                        {meta.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {hasFlag && (
                        <TriangleAlert className="h-4 w-4 text-yellow-500 mx-auto" />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
