'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Paperclip } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createExternalAudit } from '@/lib/actions/external-audits'

const OPINIONS = ['적정', '한정', '부적정', '의견거절'] as const

const selectCls =
  'h-9 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'

export function NewAuditClient() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const fd = new FormData(e.currentTarget)
    const file = fileRef.current?.files?.[0]
    if (file) fd.set('file', file)

    startTransition(async () => {
      try {
        const id = await createExternalAudit(fd)
        router.push(`/external-audits/${id}/findings`)
      } catch (err) {
        setError(err instanceof Error ? err.message : '저장 실패')
      }
    })
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">감사 기본 정보</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">감사 대상 연도 *</label>
              <Input
                name="audit_year"
                type="number"
                placeholder="2024"
                min={2000}
                max={2100}
                defaultValue={new Date().getFullYear() - 1}
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">감사 의견 *</label>
              <select name="opinion" className={selectCls} defaultValue="" required>
                <option value="" disabled>선택...</option>
                {OPINIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">회계법인명 *</label>
              <Input name="audit_firm" placeholder="예: 삼일회계법인" required />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">담당 회계사</label>
              <Input name="auditor_name" placeholder="예: 홍길동 CPA" />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">감사 완료일 *</label>
              <Input name="audit_date" type="date" className="max-w-xs" required />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">감사 의견 요약</label>
              <textarea
                name="summary"
                rows={3}
                placeholder="감사 결과 주요 내용을 요약하세요..."
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 resize-none"
              />
            </div>

            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-muted-foreground">감사 보고서 PDF</label>
              <div className="flex items-center gap-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={e => setFileName(e.target.files?.[0]?.name ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                >
                  <Paperclip className="size-3.5 mr-1.5" />
                  파일 선택
                </Button>
                <span className="text-xs text-muted-foreground">
                  {fileName ?? '최대 50MB · PDF만 허용 · SHA-256 자동 계산'}
                </span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중...' : '저장 후 지적사항 입력 →'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => router.back()}
              disabled={isPending}
            >
              취소
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
