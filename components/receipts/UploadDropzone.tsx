'use client'

import { useState, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import {
  Upload,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

type UploadState = 'idle' | 'uploading' | 'done' | 'error'

interface OcrResult {
  receipt_id: string
  confidence: number
  status: 'approved' | 'manual_review' | 'rejected'
  flags: Record<string, unknown>
  parsed: {
    date: string | null
    merchant: string | null
    total: number | null
    category: string | null
    payment_method: string | null
  }
}

const STATUS_META = {
  approved:      { label: '자동 승인',    color: 'text-green-600',  bar: 'bg-green-500' },
  manual_review: { label: '수동 검수 필요', color: 'text-yellow-600', bar: 'bg-yellow-500' },
  rejected:      { label: '즉시 반려',    color: 'text-red-600',    bar: 'bg-red-500' },
} satisfies Record<OcrResult['status'], { label: string; color: string; bar: string }>

function formatKRW(n: number | null) {
  if (n === null) return '—'
  return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
}

function ResultCard({ result, onReset }: { result: OcrResult; onReset: () => void }) {
  const meta = STATUS_META[result.status]
  const hasCovMismatch = 'cov_mismatch' in result.flags

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-semibold text-sm">{result.parsed.merchant ?? '가맹점 미인식'}</p>
          <p className="text-xs text-muted-foreground">
            {result.parsed.date ?? '날짜 미인식'} · {result.parsed.category ?? '카테고리 미인식'}
          </p>
        </div>
        <div className="text-right shrink-0 ml-4">
          <p className="font-bold">{formatKRW(result.parsed.total)}</p>
          <p className="text-xs text-muted-foreground capitalize">
            {result.parsed.payment_method ?? '결제수단 미인식'}
          </p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">신뢰도</span>
          <span className={cn('text-xs font-medium', meta.color)}>
            {Math.round(result.confidence * 100)}% · {meta.label}
          </span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', meta.bar)}
            style={{ width: `${Math.round(result.confidence * 100)}%` }}
          />
        </div>
      </div>

      {hasCovMismatch && (
        <div className="rounded-md border border-yellow-200 bg-yellow-50 p-2.5">
          <p className="flex items-center gap-1.5 text-xs text-yellow-800">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            CoV-1 불일치: 공급가액 + 부가세 ≠ 총액
          </p>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground font-mono">
          {result.receipt_id.slice(0, 8)}…
        </span>
        <Button variant="ghost" size="sm" onClick={onReset}>
          <X className="h-3.5 w-3.5 mr-1" />
          닫기
        </Button>
      </div>
    </div>
  )
}

export function UploadDropzone({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [state, setState] = useState<UploadState>('idle')
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<OcrResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setErrorMsg('이미지 파일(JPG, PNG 등)만 업로드 가능합니다.')
      setState('error')
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setState('uploading')
    setResult(null)
    setErrorMsg(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: formData })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? '업로드 실패')
      setResult(data as OcrResult)
      setState('done')
      onSuccess?.()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : '오류가 발생했습니다.')
      setState('error')
    }
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const file = e.dataTransfer.files[0]
      if (file) processFile(file)
    },
    [processFile]
  )

  const handleReset = () => {
    setState('idle')
    setResult(null)
    setErrorMsg(null)
    if (preview) { URL.revokeObjectURL(preview); setPreview(null) }
    if (inputRef.current) inputRef.current.value = ''
  }

  const isClickable = state === 'idle' || state === 'error'

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => isClickable && inputRef.current?.click()}
        className={cn(
          'relative flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors select-none',
          isClickable && 'cursor-pointer',
          state === 'idle' && !isDragging && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30',
          isDragging && 'border-primary bg-primary/5',
          state === 'uploading' && 'border-muted-foreground/20 bg-muted/10',
          state === 'done' && 'border-green-400/40 bg-green-50/20',
          state === 'error' && 'border-destructive/40 bg-destructive/5',
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        />

        {state === 'uploading' && (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <div className="text-center">
              <p className="text-sm font-medium">OCR 분석 중…</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gemini AI로 분석 중입니다
              </p>
            </div>
          </>
        )}

        {state === 'idle' && (
          <>
            <div className={cn(
              'rounded-full p-3 transition-colors',
              isDragging ? 'bg-primary/10' : 'bg-muted',
            )}>
              <Upload className={cn('h-6 w-6', isDragging ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">영수증 이미지를 드래그하거나 클릭하여 업로드</p>
              <p className="text-xs text-muted-foreground mt-1">JPG · PNG · WEBP 지원 · 최대 10 MB</p>
            </div>
          </>
        )}

        {state === 'done' && (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-600" />
            <p className="text-sm font-medium text-green-700">분석 완료</p>
          </>
        )}

        {state === 'error' && (
          <>
            <AlertCircle className="h-10 w-10 text-destructive" />
            <div className="text-center">
              <p className="text-sm font-medium text-destructive">{errorMsg}</p>
              <p className="text-xs text-muted-foreground mt-1">클릭하여 다시 시도</p>
            </div>
          </>
        )}
      </div>

      {/* Result card */}
      {state === 'done' && result && (
        <ResultCard result={result} onReset={handleReset} />
      )}

      {/* Reset button after completion / error */}
      {(state === 'done' || state === 'error') && (
        <Button variant="outline" size="sm" className="w-full" onClick={handleReset}>
          새 영수증 업로드
        </Button>
      )}
    </div>
  )
}
