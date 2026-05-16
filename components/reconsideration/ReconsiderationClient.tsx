'use client'

import { useRef, useState, useTransition } from 'react'
import { ChevronDown, ChevronUp, Paperclip, ExternalLink, Clock, Send } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  createReconsideration,
  updateResolution,
  uploadReconDocument,
  type ReconsiderationRow,
  type ReconStatus,
} from '@/lib/actions/reconsideration'
import { LAW_REFERENCES } from '@/lib/reconsideration-constants'

// ── 메타 ────────────────────────────────────────────────────────────────────

const STATUS_META: Record<ReconStatus, { label: string; cls: string }> = {
  SENT:      { label: '발송됨',      cls: 'bg-blue-50 text-blue-700 border-blue-300' },
  RECEIVED:  { label: '접수됨',      cls: 'bg-yellow-50 text-yellow-700 border-yellow-300' },
  RESOLVED:  { label: '처리완료',    cls: 'bg-green-50 text-green-700 border-green-300' },
  ESCALATED: { label: '상급기관 이관', cls: 'bg-red-50 text-red-700 border-red-300' },
}

const FILTER_OPTIONS: { value: 'ALL' | ReconStatus; label: string }[] = [
  { value: 'ALL',       label: '전체' },
  { value: 'SENT',      label: '발송됨' },
  { value: 'RECEIVED',  label: '접수됨' },
  { value: 'RESOLVED',  label: '처리완료' },
  { value: 'ESCALATED', label: '상급기관 이관' },
]

const selectCls = 'h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

function fmtDate(s: string) { return s.slice(0, 10) }

function daysSince(isoStr: string): number {
  return Math.floor((Date.now() - new Date(isoStr).getTime()) / 86_400_000)
}

// ── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function ReconsiderationClient({ initialRows }: { initialRows: ReconsiderationRow[] }) {
  const [isPending, startTransition] = useTransition()

  // 폼 상태
  const [showForm, setShowForm] = useState(false)
  const [lawRef, setLawRef] = useState<string>(LAW_REFERENCES[0])
  const [content, setContent] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // 목록 상태
  const [statusFilter, setStatusFilter] = useState<'ALL' | ReconStatus>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [resolutionStatus, setResolutionStatus] = useState<ReconStatus>('RECEIVED')
  const [resolutionText, setResolutionText] = useState('')
  const [resolutionError, setResolutionError] = useState<string | null>(null)

  // 파일 업로드
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const fileRefs = useRef<Map<string, HTMLInputElement>>(new Map())
  const newFileRef = useRef<HTMLInputElement>(null)
  const [pendingUploadId, setPendingUploadId] = useState<string | null>(null)

  const filtered = statusFilter === 'ALL'
    ? initialRows
    : initialRows.filter((r) => r.status === statusFilter)

  // ── 요청서 작성 ────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) { setFormError('요청 내용을 입력하세요.'); return }
    setFormError(null)

    startTransition(async () => {
      try {
        const newId = await createReconsideration({ law_reference: lawRef, content: content.trim() })
        // 파일이 선택돼 있으면 바로 업로드
        const file = newFileRef.current?.files?.[0]
        if (file) {
          const fd = new FormData()
          fd.append('file', file)
          await uploadReconDocument(newId, fd)
          if (newFileRef.current) newFileRef.current.value = ''
        }
        setContent('')
        setLawRef(LAW_REFERENCES[0])
        setShowForm(false)
      } catch (err) {
        setFormError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  // ── 처리 결과 입력 ─────────────────────────────────────────────────────────

  function openResolution(row: ReconsiderationRow) {
    setExpandedId(row.id)
    setResolutionStatus(row.status === 'SENT' ? 'RECEIVED' : row.status)
    setResolutionText(row.resolution ?? '')
    setResolutionError(null)
  }

  function handleResolutionSubmit(id: string) {
    startTransition(async () => {
      try {
        await updateResolution({ id, status: resolutionStatus, resolution: resolutionText.trim() || undefined })
        setExpandedId(null)
        setResolutionText('')
      } catch (err) {
        setResolutionError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  // ── 파일 첨부 (기존 항목) ──────────────────────────────────────────────────

  async function handleFileChange(id: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingId(id)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await uploadReconDocument(id, fd)
    } catch (err) {
      alert(err instanceof Error ? err.message : '업로드 실패')
    } finally {
      setUploadingId(null)
      e.target.value = ''
    }
  }

  // ── 렌더 ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── 요청서 작성 폼 ── */}
      <Card>
        <CardHeader className="pb-3">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center justify-between w-full text-left"
          >
            <CardTitle className="text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              재심의 요청서 작성
            </CardTitle>
            {showForm
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        </CardHeader>

        {showForm && (
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* 위반 법령 */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">위반 법령 *</label>
                <select value={lawRef} onChange={e => setLawRef(e.target.value)} className={selectCls}>
                  {LAW_REFERENCES.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>

              {/* 요청 내용 */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">요청 내용 *</label>
                <textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="위반 사항 및 재심의 요청 근거를 구체적으로 기재하세요."
                  rows={5}
                  required
                  className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
                />
              </div>

              {/* 파일 첨부 */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">요청서 파일 첨부 (PDF 권장)</label>
                <input
                  ref={newFileRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="block text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-input file:text-xs file:font-medium file:bg-background hover:file:bg-muted"
                />
              </div>

              {/* 불변 안내 */}
              <p className="text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                등록된 요청서는 수정·삭제할 수 없습니다. (위반 법령·요청 내용 불변, RLS 보호)
              </p>

              {formError && <p className="text-xs text-destructive">{formError}</p>}

              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending}>
                  {isPending ? '제출 중...' : '요청서 제출'}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowForm(false)}>
                  취소
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>

      {/* ── 요청 목록 ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">요청 이력 ({filtered.length}건)</CardTitle>
            {/* 상태 필터 탭 */}
            <div className="flex items-center gap-1 flex-wrap justify-end">
              {FILTER_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setStatusFilter(value)}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors',
                    statusFilter === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground border-input hover:bg-muted',
                  )}
                >
                  {label}
                  {value !== 'ALL' && (
                    <span className="ml-1 tabular-nums">
                      ({initialRows.filter(r => r.status === value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              해당 상태의 요청이 없습니다.
            </p>
          ) : (
            <div className="divide-y">
              {filtered.map((row) => (
                <div key={row.id}>
                  {/* ── 요청 카드 ── */}
                  <div className={cn(
                    'px-6 py-4 space-y-2',
                    row.flag_overdue && 'bg-orange-50/40',
                  )}>
                    {/* 상단 행: 법령 + 상태 배지 + 미처리경과 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-primary bg-primary/10 rounded px-2 py-0.5">
                        {row.law_reference}
                      </span>
                      <Badge variant="outline" className={cn('text-xs', STATUS_META[row.status].cls)}>
                        {STATUS_META[row.status].label}
                      </Badge>
                      {row.flag_overdue && (
                        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700 border-orange-300 flex items-center gap-1">
                          <Clock className="size-3" />
                          미처리경과 {daysSince(row.sent_at)}일
                        </Badge>
                      )}
                    </div>

                    {/* 요청 내용 */}
                    <p className="text-sm text-foreground line-clamp-3 whitespace-pre-wrap">
                      {row.content}
                    </p>

                    {/* 처리 결과 (있을 경우) */}
                    {row.resolution && (
                      <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">처리 결과:</span>{' '}
                        {row.resolution}
                      </div>
                    )}

                    {/* 하단 행: 날짜 + 파일 + 처리결과 버튼 */}
                    <div className="flex items-center gap-3 pt-1">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        발송: {fmtDate(row.sent_at)}
                        {row.resolved_at && ` · 처리: ${fmtDate(row.resolved_at)}`}
                      </span>

                      {/* 파일 */}
                      <input
                        ref={el => { if (el) fileRefs.current.set(row.id, el) }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={e => handleFileChange(row.id, e)}
                      />
                      {row.document_url ? (
                        <a href={row.document_url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline">
                          <ExternalLink className="size-3" />파일 보기
                        </a>
                      ) : (
                        <button type="button"
                          onClick={() => fileRefs.current.get(row.id)?.click()}
                          disabled={uploadingId === row.id}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                          <Paperclip className="size-3" />
                          {uploadingId === row.id ? '업로드 중...' : '파일 첨부'}
                        </button>
                      )}

                      {/* 처리 결과 입력 버튼 (RESOLVED 아닐 때만) */}
                      {row.status !== 'RESOLVED' && row.status !== 'ESCALATED' && (
                        <button
                          type="button"
                          onClick={() => expandedId === row.id ? setExpandedId(null) : openResolution(row)}
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                        >
                          처리 결과 입력
                          {expandedId === row.id
                            ? <ChevronUp className="size-3" />
                            : <ChevronDown className="size-3" />}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* ── 처리 결과 입력 폼 (인라인 확장) ── */}
                  {expandedId === row.id && (
                    <div className="px-6 py-4 bg-muted/30 border-t space-y-3">
                      <p className="text-xs font-medium text-muted-foreground">처리 결과 입력</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">처리 상태 *</label>
                          <select
                            value={resolutionStatus}
                            onChange={e => setResolutionStatus(e.target.value as ReconStatus)}
                            className={selectCls}
                          >
                            <option value="RECEIVED">접수됨</option>
                            <option value="RESOLVED">처리완료</option>
                            <option value="ESCALATED">상급기관 이관</option>
                          </select>
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-xs font-medium text-muted-foreground">처리 내용</label>
                          <Input
                            placeholder="처리 결과 또는 접수 번호를 입력하세요."
                            value={resolutionText}
                            onChange={e => setResolutionText(e.target.value)}
                          />
                        </div>
                      </div>
                      {resolutionError && <p className="text-xs text-destructive">{resolutionError}</p>}
                      <div className="flex gap-2">
                        <Button type="button" size="sm" disabled={isPending}
                          onClick={() => handleResolutionSubmit(row.id)}>
                          {isPending ? '저장 중...' : '저장'}
                        </Button>
                        <Button type="button" variant="outline" size="sm"
                          onClick={() => setExpandedId(null)}>
                          취소
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
