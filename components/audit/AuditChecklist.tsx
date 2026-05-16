'use client'

import { useCallback, useRef, useState, useTransition } from 'react'
import { Paperclip, X, Loader2, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  toggleChecklistItem,
  updateChecklistItemNote,
  uploadChecklistEvidence,
  removeChecklistEvidence,
  type Checklist,
  type ChecklistItem,
} from '@/lib/actions/checklist'

// ── 카테고리 배지 색상 ────────────────────────────────────────────────────────

const CATEGORY_STYLE: Record<string, string> = {
  월간: 'bg-blue-50 text-blue-700 border-blue-200',
  분기: 'bg-green-50 text-green-700 border-green-200',
  반기: 'bg-purple-50 text-purple-700 border-purple-200',
  건별: 'bg-orange-50 text-orange-700 border-orange-200',
  연간: 'bg-red-50 text-red-700 border-red-200',
}

// ── 단일 항목 행 ──────────────────────────────────────────────────────────────

function ChecklistRow({
  item,
  checklistId,
  onToggle,
  onNoteChange,
  onFileUpload,
  onFileRemove,
}: {
  item: ChecklistItem
  checklistId: string
  onToggle: (id: string, checked: boolean) => void
  onNoteChange: (id: string, note: string) => void
  onFileUpload: (id: string, file: File) => void
  onFileRemove: (id: string) => void
}) {
  const isChecked = item.status === 'pass'
  const fileInputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleNoteChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onNoteChange(item.id, value), 600)
    },
    [item.id, onNoteChange]
  )

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) onFileUpload(item.id, file)
      e.target.value = ''
    },
    [item.id, onFileUpload]
  )

  const fileName = item.evidence_url
    ? decodeURIComponent(item.evidence_url.split('/').pop()?.split('?')[0] ?? '첨부파일')
    : null

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        isChecked ? 'border-green-200 bg-green-50/40' : 'border-border bg-card'
      )}
    >
      {/* 상단: 체크박스 + 항목명 + 카테고리 */}
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isChecked}
          onCheckedChange={(val) => onToggle(item.id, val === true)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                'text-sm font-medium leading-snug',
                isChecked && 'line-through text-muted-foreground'
              )}
            >
              {item.item_text}
            </span>
            <Badge
              variant="outline"
              className={cn('text-xs', CATEGORY_STYLE[item.category] ?? '')}
            >
              {item.category}
            </Badge>
            {isChecked && (
              <CheckCircle2 className="size-4 text-green-500 shrink-0" />
            )}
          </div>

          {/* 하단: 비고 + 파일 첨부 */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Input
              placeholder="비고 입력..."
              defaultValue={item.note ?? ''}
              onChange={handleNoteChange}
              className="h-7 text-xs w-52 min-w-0"
            />

            {/* 파일 첨부 버튼 */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".jpg,.jpeg,.png,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={() => fileInputRef.current?.click()}
              className="gap-1 text-xs"
            >
              <Paperclip className="size-3" />
              파일첨부
            </Button>

            {/* 첨부된 파일명 */}
            {fileName && (
              <div className="flex items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground max-w-[180px]">
                <a
                  href={item.evidence_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate hover:underline"
                  title={fileName}
                >
                  {fileName}
                </a>
                <button
                  type="button"
                  onClick={() => onFileRemove(item.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 진행률 바 ─────────────────────────────────────────────────────────────────

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          완료 <span className="font-semibold text-foreground">{done}</span> / {total}건
        </span>
        <span
          className={cn(
            'font-bold tabular-nums',
            pct === 100 ? 'text-green-600' : pct >= 50 ? 'text-blue-600' : 'text-orange-500'
          )}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500',
            pct === 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function AuditChecklist({
  checklist,
  initialItems,
}: {
  checklist: Checklist
  initialItems: ChecklistItem[]
}) {
  const [items, setItems] = useState<ChecklistItem[]>(initialItems)
  const [uploading, setUploading] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const doneCount = items.filter((i) => i.status === 'pass').length

  const handleToggle = useCallback((id: string, checked: boolean) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status: checked ? 'pass' : 'pending', checked_at: checked ? new Date().toISOString() : null }
          : item
      )
    )
    startTransition(async () => {
      try {
        await toggleChecklistItem(id, checked)
      } catch {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id
              ? { ...item, status: checked ? 'pending' : 'pass' }
              : item
          )
        )
      }
    })
  }, [])

  const handleNoteChange = useCallback((id: string, note: string) => {
    startTransition(async () => {
      try {
        await updateChecklistItemNote(id, note)
      } catch {
        // silent — note는 debounced라 낙관적 업데이트 불필요
      }
    })
  }, [])

  const handleFileUpload = useCallback(
    async (id: string, file: File) => {
      setUploading(id)
      try {
        const formData = new FormData()
        formData.append('file', file)
        const url = await uploadChecklistEvidence(id, checklist.id, formData)
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, evidence_url: url } : item))
        )
      } catch (err) {
        alert(err instanceof Error ? err.message : '파일 업로드 실패')
      } finally {
        setUploading(null)
      }
    },
    [checklist.id]
  )

  const handleFileRemove = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, evidence_url: null } : item))
    )
    startTransition(async () => {
      try {
        await removeChecklistEvidence(id)
      } catch {
        // best-effort
      }
    })
  }, [])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">감사 체크리스트</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {checklist.title}
            {checklist.period_start && (
              <span className="ml-2 text-xs">
                ({checklist.period_start} ~ {checklist.period_end})
              </span>
            )}
          </p>
        </div>
        {isPending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            저장 중...
          </div>
        )}
      </div>

      {/* 진행률 */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <ProgressBar done={doneCount} total={items.length} />
        </CardContent>
      </Card>

      {/* 체크리스트 항목 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">공동주택관리법 기준 점검 항목</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {uploading && (
            <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 text-xs text-blue-700">
              <Loader2 className="size-3.5 animate-spin" />
              파일 업로드 중...
            </div>
          )}
          {items.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              checklistId={checklist.id}
              onToggle={handleToggle}
              onNoteChange={handleNoteChange}
              onFileUpload={handleFileUpload}
              onFileRemove={handleFileRemove}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
