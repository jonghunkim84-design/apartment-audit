'use client'

import { useState, useTransition } from 'react'
import { Globe, EyeOff, CheckCircle2, Clock, ExternalLink } from 'lucide-react'
import { approveDisclosure, revokeDisclosure } from '@/lib/actions/disclosure'
import type { DisclosureType, PublicDisclosure } from '@/lib/actions/disclosure'

const TYPE_LABEL: Record<DisclosureType, string> = {
  monthly_expenses:  '월별 관리비 지출',
  misc_income:       '잡수입 현황',
  long_term_repair:  '장기수선충당금',
  audit_report:      '감사 결과 요약',
}

const TYPE_ORDER: DisclosureType[] = [
  'monthly_expenses', 'misc_income', 'long_term_repair', 'audit_report',
]

interface Props {
  availablePeriods: Record<string, string[]>
  disclosures: PublicDisclosure[]
  publicCode: string | null
}

export function DisclosureClient({ availablePeriods, disclosures, publicCode }: Props) {
  const [activeType, setActiveType] = useState<DisclosureType>('monthly_expenses')
  const [pending, startTransition] = useTransition()
  const [loadingKey, setLoadingKey] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const isApproved = (type: DisclosureType, period: string) =>
    disclosures.find(d => d.disclosure_type === type && d.period === period && d.is_active)

  const handleApprove = (type: DisclosureType, period: string) => {
    const key = `${type}:${period}`
    setLoadingKey(key)
    startTransition(async () => {
      try {
        await approveDisclosure(type, period)
        showToast(`${period} 공개 승인 완료`, true)
      } catch (e) {
        showToast(e instanceof Error ? e.message : '오류', false)
      } finally {
        setLoadingKey(null)
      }
    })
  }

  const handleRevoke = (id: string, period: string) => {
    setLoadingKey(id)
    startTransition(async () => {
      try {
        await revokeDisclosure(id)
        showToast(`${period} 공개 취소`, true)
      } catch (e) {
        showToast(e instanceof Error ? e.message : '오류', false)
      } finally {
        setLoadingKey(null)
      }
    })
  }

  const periods = availablePeriods[activeType] ?? []

  return (
    <div className="space-y-6">
      {/* 공개 URL */}
      {publicCode && (
        <div className="flex items-center gap-3 rounded-lg border bg-blue-50 px-4 py-3 text-sm">
          <Globe className="h-4 w-4 text-blue-600 shrink-0" />
          <span className="text-blue-700 font-medium">공개 포털 URL:</span>
          <code className="text-blue-800 font-mono text-xs">/portal/{publicCode}</code>
          <a
            href={`/portal/${publicCode}`}
            target="_blank"
            className="ml-auto flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            열기
          </a>
        </div>
      )}

      {/* 탭 */}
      <div className="flex gap-1 border-b">
        {TYPE_ORDER.map(type => (
          <button
            key={type}
            onClick={() => setActiveType(type)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeType === type
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      {/* 기간 목록 */}
      <div>
        <p className="text-sm text-gray-500 mb-3">
          공개 승인할 기간을 선택하세요. 승인된 항목은 입주민 공개 포털에 즉시 표시됩니다.
        </p>

        {periods.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            공개 가능한 데이터 기간이 없습니다.
          </p>
        ) : (
          <div className="space-y-2">
            {periods.map(period => {
              const approved = isApproved(activeType, period)
              const key = approved ? approved.id : `${activeType}:${period}`
              const isLoading = loadingKey === key || (!approved && loadingKey === `${activeType}:${period}`)

              return (
                <div
                  key={period}
                  className={`flex items-center justify-between rounded-lg border px-4 py-3 ${
                    approved ? 'border-green-200 bg-green-50' : 'bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {approved
                      ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                      : <Clock className="h-4 w-4 text-gray-300 shrink-0" />
                    }
                    <div>
                      <p className="text-sm font-medium">{period}</p>
                      {approved && (
                        <p className="text-xs text-gray-400">
                          승인일: {new Date(approved.approved_at).toLocaleDateString('ko-KR')}
                          {approved.kapt_match !== null && (
                            <span className={`ml-2 ${approved.kapt_match ? 'text-green-600' : 'text-red-500'}`}>
                              · K-apt {approved.kapt_match ? '일치 ✓' : '불일치 ✗'}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {approved ? (
                      <button
                        onClick={() => handleRevoke(approved.id, period)}
                        disabled={isLoading || pending}
                        className="flex items-center gap-1.5 text-xs border border-gray-200 text-gray-500 px-3 py-1.5 rounded-md hover:bg-gray-50 disabled:opacity-40"
                      >
                        <EyeOff className="h-3.5 w-3.5" />
                        {isLoading ? '처리중…' : '공개 취소'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleApprove(activeType, period)}
                        disabled={isLoading || pending}
                        className="flex items-center gap-1.5 text-xs bg-blue-600 text-white px-3 py-1.5 rounded-md hover:bg-blue-700 disabled:opacity-40"
                      >
                        <Globe className="h-3.5 w-3.5" />
                        {isLoading ? '처리중…' : '공개 승인'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 토스트 */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-lg text-sm text-white shadow-lg z-50 ${
          toast.ok ? 'bg-green-600' : 'bg-red-500'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
