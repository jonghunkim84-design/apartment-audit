'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, CheckCircle2, XCircle,
  AlertCircle, Loader2, FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { approveReceipt, rejectReceipt, type ReceiptEditFields } from '@/lib/actions/receipts'
import type { Tables } from '@/types/database'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type ReviewReceipt = Pick<
  Tables<'receipts'>,
  | 'id' | 'receipt_date' | 'merchant_name' | 'business_number'
  | 'supply_amount' | 'tax_amount' | 'amount' | 'payment_method'
  | 'card_company' | 'approval_number' | 'merchant_category'
  | 'confidence_score' | 'policy_flags' | 'original_image_url'
  | 'ocr_raw_text' | 'status' | 'review_note'
>

type FormState = {
  receipt_date: string
  merchant_name: string
  business_number: string
  supply_amount: string
  tax_amount: string
  amount: string
  payment_method: string
  card_company: string
  approval_number: string
  merchant_category: string
  notes: string
}

// ── 변환 헬퍼 ─────────────────────────────────────────────────────────────────

function toForm(r: ReviewReceipt): FormState {
  return {
    receipt_date:     r.receipt_date ?? '',
    merchant_name:    r.merchant_name ?? '',
    business_number:  r.business_number ?? '',
    supply_amount:    r.supply_amount != null ? String(r.supply_amount) : '',
    tax_amount:       r.tax_amount != null ? String(r.tax_amount) : '',
    amount:           r.amount != null ? String(r.amount) : '',
    payment_method:   r.payment_method ?? '',
    card_company:     r.card_company ?? '',
    approval_number:  r.approval_number ?? '',
    merchant_category: r.merchant_category ?? '',
    notes:            r.review_note ?? '',
  }
}

function toDbFields(f: FormState): ReceiptEditFields {
  return {
    receipt_date:     f.receipt_date || null,
    merchant_name:    f.merchant_name || null,
    business_number:  f.business_number || null,
    supply_amount:    f.supply_amount ? parseInt(f.supply_amount, 10) : null,
    tax_amount:       f.tax_amount ? parseInt(f.tax_amount, 10) : null,
    amount:           f.amount ? parseInt(f.amount, 10) : null,
    payment_method:   f.payment_method || null,
    card_company:     f.card_company || null,
    approval_number:  f.approval_number || null,
    merchant_category: f.merchant_category || null,
  }
}

function fmtConfidence(score: number | null) {
  if (score === null) return '—'
  const pct = Math.round(Number(score) * 100)
  if (pct >= 95) return { label: `${pct}%`, color: 'text-green-600' }
  if (pct >= 85) return { label: `${pct}%`, color: 'text-green-500' }
  if (pct >= 65) return { label: `${pct}%`, color: 'text-yellow-600' }
  return { label: `${pct}%`, color: 'text-red-600' }
}

// ── 폼 필드 행 ─────────────────────────────────────────────────────────────────

function Field({
  label, value, onChange, type = 'text', readOnly = false,
}: {
  label: string
  value: string
  onChange?: (v: string) => void
  type?: string
  readOnly?: boolean
}) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-2">
      <label className="text-xs text-muted-foreground text-right shrink-0">{label}</label>
      <Input
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn('h-8 text-sm', readOnly && 'bg-muted/40 cursor-default')}
      />
    </div>
  )
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────

export function ReviewClient({ receipts: initial }: { receipts: ReviewReceipt[] }) {
  const router = useRouter()
  const [queue, setQueue] = useState(initial)
  const [forms, setForms] = useState<FormState[]>(() => initial.map(toForm))
  const [idx, setIdx] = useState(0)
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [isPending, startTransition] = useTransition()

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center gap-3">
        <CheckCircle2 className="h-10 w-10 text-green-500" />
        <p className="font-medium">검수 대기 영수증이 없습니다</p>
        <p className="text-sm text-muted-foreground">모든 영수증이 처리되었습니다</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/receipts')}>
          영수증 목록으로
        </Button>
      </div>
    )
  }

  const receipt = queue[idx]
  const form = forms[idx]
  const conf = fmtConfidence(receipt.confidence_score)
  const hasFlags = receipt.policy_flags !== null && Object.keys(receipt.policy_flags as object).length > 0
  const covMismatch = hasFlags && 'cov_mismatch' in (receipt.policy_flags as object)

  function updateField(key: keyof FormState, value: string) {
    setForms((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [key]: value }
      return next
    })
  }

  function removeCurrentAndAdvance() {
    const newQueue = queue.filter((_, i) => i !== idx)
    const newForms = forms.filter((_, i) => i !== idx)
    setQueue(newQueue)
    setForms(newForms)
    if (newQueue.length === 0) return
    setIdx(Math.min(idx, newQueue.length - 1))
  }

  function handleApprove() {
    startTransition(async () => {
      await approveReceipt(receipt.id, toDbFields(form))
      removeCurrentAndAdvance()
    })
  }

  function handleReject() {
    if (!rejectReason.trim()) return
    startTransition(async () => {
      await rejectReceipt(receipt.id, rejectReason.trim(), toDbFields(form))
      setRejectOpen(false)
      setRejectReason('')
      removeCurrentAndAdvance()
    })
  }

  return (
    <>
      {/* 네비게이터 */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {idx + 1} / {queue.length}건
        </span>
        <div className="flex gap-1">
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={idx === 0 || isPending}
            onClick={() => setIdx(idx - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline" size="icon" className="h-8 w-8"
            disabled={idx === queue.length - 1 || isPending}
            onClick={() => setIdx(idx + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 본문: 이미지 + 폼 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 왼쪽: 원본 이미지 */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> 원본 이미지
            </CardTitle>
          </CardHeader>
          <CardContent>
            {receipt.original_image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={receipt.original_image_url}
                alt="영수증 원본"
                className="w-full rounded-md object-contain max-h-[520px] border bg-muted/20"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64 rounded-md border border-dashed text-muted-foreground gap-2">
                <AlertCircle className="h-8 w-8 opacity-40" />
                <p className="text-sm">이미지 없음</p>
              </div>
            )}
            {receipt.ocr_raw_text && (
              <details className="mt-3">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                  OCR 원문 보기
                </summary>
                <pre className="mt-2 text-xs bg-muted/40 rounded p-3 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {receipt.ocr_raw_text}
                </pre>
              </details>
            )}
          </CardContent>
        </Card>

        {/* 오른쪽: 13요소 편집 폼 */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>추출 데이터 편집</span>
              {typeof conf === 'object' ? (
                <span className={cn('text-sm font-bold tabular-nums', conf.color)}>
                  신뢰도 {conf.label}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">신뢰도 —</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Field label="날짜" value={form.receipt_date} type="date" onChange={(v) => updateField('receipt_date', v)} />
            <Field label="가맹점" value={form.merchant_name} onChange={(v) => updateField('merchant_name', v)} />
            <Field label="사업자번호" value={form.business_number} onChange={(v) => updateField('business_number', v)} />
            <Field label="공급가액" value={form.supply_amount} type="number" onChange={(v) => updateField('supply_amount', v)} />
            <Field label="부가세" value={form.tax_amount} type="number" onChange={(v) => updateField('tax_amount', v)} />
            <Field label="합계금액" value={form.amount} type="number" onChange={(v) => updateField('amount', v)} />

            {/* 결제수단 select */}
            <div className="grid grid-cols-[100px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground text-right">결제수단</label>
              <select
                value={form.payment_method}
                onChange={(e) => updateField('payment_method', e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">선택 안 함</option>
                <option value="card">카드</option>
                <option value="cash">현금</option>
                <option value="transfer">계좌이체</option>
                <option value="other">기타</option>
              </select>
            </div>

            <Field label="카드사" value={form.card_company} onChange={(v) => updateField('card_company', v)} />
            <Field label="승인번호" value={form.approval_number} onChange={(v) => updateField('approval_number', v)} />

            {/* 통화 (읽기 전용) */}
            <Field label="통화" value="KRW" readOnly />

            {/* 카테고리 select */}
            <div className="grid grid-cols-[100px_1fr] items-center gap-2">
              <label className="text-xs text-muted-foreground text-right">카테고리</label>
              <select
                value={form.merchant_category}
                onChange={(e) => updateField('merchant_category', e.target.value)}
                className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">선택 안 함</option>
                <option value="식비">식비</option>
                <option value="교통">교통</option>
                <option value="사무용품">사무용품</option>
                <option value="시설관리">시설관리</option>
                <option value="인건비">인건비</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* 비고 textarea */}
            <div className="grid grid-cols-[100px_1fr] items-start gap-2">
              <label className="text-xs text-muted-foreground text-right pt-1.5">비고</label>
              <textarea
                value={form.notes}
                onChange={(e) => updateField('notes', e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                placeholder="특이사항 없음"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 이상 플래그 경고 */}
      {hasFlags && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 flex items-start gap-3">
          <AlertCircle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-800 space-y-1">
            {covMismatch && <p>CoV-1 불일치: 공급가액 + 부가세 ≠ 합계금액</p>}
            {Object.keys(receipt.policy_flags as object)
              .filter((k) => k !== 'cov_mismatch')
              .map((k) => <p key={k}>{k}</p>)
            }
          </div>
        </div>
      )}

      {/* 승인 / 반려 버튼 */}
      <div className="flex gap-3 justify-end">
        <Button
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
          disabled={isPending}
          onClick={() => setRejectOpen(true)}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
          반려
        </Button>
        <Button
          className="bg-green-600 hover:bg-green-700 text-white"
          disabled={isPending}
          onClick={handleApprove}
        >
          {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
          승인
        </Button>
      </div>

      {/* 반려 사유 다이얼로그 */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>반려 사유 입력</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="반려 사유를 입력하세요 (필수)"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => { setRejectOpen(false); setRejectReason('') }}
                disabled={isPending}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                disabled={!rejectReason.trim() || isPending}
                onClick={handleReject}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                반려 확정
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
