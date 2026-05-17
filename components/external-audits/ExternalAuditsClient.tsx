'use client'

import Link from 'next/link'
import { ExternalLink, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ExternalAuditRow } from '@/lib/actions/external-audits'

const OPINION_CLS: Record<string, string> = {
  '적정':   'border-green-300 bg-green-50 text-green-700',
  '한정':   'border-yellow-300 bg-yellow-50 text-yellow-700',
  '부적정': 'border-red-300 bg-red-50 text-red-700',
  '의견거절': 'border-gray-300 bg-gray-100 text-gray-700',
}

function fmtDate(d: string) {
  return d.slice(0, 10)
}

export function ExternalAuditsClient({ initialRows }: { initialRows: ExternalAuditRow[] }) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button asChild size="sm">
          <Link href="/external-audits/new">
            <Plus className="size-3.5 mr-1.5" />
            외부감사 등록
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">외부감사 이력 ({initialRows.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {initialRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              등록된 외부감사 보고서가 없습니다.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    {['연도', '회계법인', '담당 CPA', '감사 완료일', '감사 의견', '보고서', '지적사항'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-xs font-medium text-muted-foreground whitespace-nowrap text-left">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {initialRows.map(row => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium tabular-nums">{row.audit_year}</td>
                      <td className="px-4 py-3">{row.audit_firm}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.auditor_name ?? '—'}</td>
                      <td className="px-4 py-3 tabular-nums">{fmtDate(row.audit_date)}</td>
                      <td className="px-4 py-3">
                        {row.opinion ? (
                          <Badge variant="outline" className={cn('text-xs', OPINION_CLS[row.opinion])}>
                            {row.opinion}
                          </Badge>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.report_url ? (
                          <a
                            href={row.report_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/external-audits/${row.id}/findings`}
                          className="text-xs text-primary hover:underline"
                        >
                          지적사항 입력
                        </Link>
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
