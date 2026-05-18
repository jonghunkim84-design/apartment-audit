'use client'

import { useState } from 'react'
import {
  Receipt,
  Wallet,
  Wrench,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle2,
  FileText,
} from 'lucide-react'

// ────────────── Types ──────────────

type DisclosureType = 'monthly_expenses' | 'misc_income' | 'long_term_repair' | 'audit_report'

interface Disclosure {
  id: string
  disclosure_type: string
  period: string
  title: string
  data: Record<string, unknown>
  approved_at: string
  kapt_match: boolean | null
  report_pdf_url: string | null
}

interface Props {
  disclosures: Disclosure[]
}

// ────────────── Constants ──────────────

const TABS: { type: DisclosureType; label: string; icon: React.ReactNode }[] = [
  { type: 'monthly_expenses', label: '관리비 지출', icon: <Receipt className="h-4 w-4" /> },
  { type: 'misc_income',      label: '잡수입',      icon: <Wallet className="h-4 w-4" /> },
  { type: 'long_term_repair', label: '장기수선충당금', icon: <Wrench className="h-4 w-4" /> },
  { type: 'audit_report',     label: '감사 결과',   icon: <ClipboardList className="h-4 w-4" /> },
]

const MISC_INCOME_LABEL: Record<string, string> = {
  recycling: '재활용', parking: '주차', rental: '임대',
  interest: '이자', late_fee: '연체료', other: '기타',
}

// ────────────── Helpers ──────────────

function formatKRW(n: number) {
  return `${n.toLocaleString('ko-KR')}원`
}

// ────────────── Sub-renderers ──────────────

function MonthlyExpenses({ data }: { data: Record<string, unknown> }) {
  const [expanded, setExpanded] = useState(false)
  const byCategory = (data.by_category as Array<{ category: string; amount: number; count: number }>) ?? []
  const receipts   = (data.receipts as Array<{ merchant_name: string | null; amount: number | null; receipt_date: string | null; category: string; flagged: boolean }>) ?? []
  const total      = (data.total_expense as number) ?? 0
  const count      = (data.receipt_count as number) ?? 0
  const flagged    = receipts.filter(r => r.flagged).length

  return (
    <div className="space-y-5">
      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        <KpiCard label="총 지출액" value={formatKRW(total)} color="blue" />
        <KpiCard label="영수증 건수" value={`${count}건`} color="slate" />
        <KpiCard label="이상 감지" value={`${flagged}건`} color={flagged > 0 ? 'red' : 'green'} />
      </div>

      {/* 카테고리별 */}
      {byCategory.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-2">항목별 지출</h3>
          <div className="rounded-xl border border-slate-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-2.5 text-slate-500 font-medium">항목</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">건수</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">금액</th>
                  <th className="text-right px-4 py-2.5 text-slate-500 font-medium">비율</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((row, i) => (
                  <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                    <td className="px-4 py-2.5 text-slate-700">{row.category}</td>
                    <td className="px-4 py-2.5 text-right text-slate-500">{row.count}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-slate-800">{formatKRW(row.amount)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-400 text-xs">
                      {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 명세서 토글 */}
      {receipts.length > 0 && (
        <div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            지출 명세서 {expanded ? '닫기' : '열기'} ({receipts.length}건)
          </button>
          {expanded && (
            <div className="mt-3 rounded-xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">날짜</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">상호</th>
                    <th className="text-left px-4 py-2.5 text-slate-500 font-medium">항목</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-medium">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r, i) => (
                    <tr key={i} className={`border-t border-slate-50 ${r.flagged ? 'bg-red-50' : 'hover:bg-slate-50'}`}>
                      <td className="px-4 py-2 text-slate-400 text-xs">{r.receipt_date ?? '—'}</td>
                      <td className="px-4 py-2 text-slate-700">
                        {r.flagged && <AlertTriangle className="h-3 w-3 text-red-400 inline mr-1" />}
                        {r.merchant_name ?? '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{r.category}</td>
                      <td className="px-4 py-2 text-right font-medium text-slate-800">{r.amount != null ? formatKRW(r.amount) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MiscIncome({ data }: { data: Record<string, unknown> }) {
  const total   = (data.total as number) ?? 0
  const byType  = (data.by_type as Array<{ type: string; amount: number; count: number }>) ?? []

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <KpiCard label="총 잡수입" value={formatKRW(total)} color="blue" />
        <KpiCard label="수입 유형" value={`${byType.length}종`} color="slate" />
      </div>

      {byType.length > 0 && (
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">유형</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">건수</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">금액</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">비율</th>
              </tr>
            </thead>
            <tbody>
              {byType.map((row, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{MISC_INCOME_LABEL[row.type] ?? row.type}</td>
                  <td className="px-4 py-2.5 text-right text-slate-500">{row.count}</td>
                  <td className="px-4 py-2.5 text-right font-medium text-slate-800">{formatKRW(row.amount)}</td>
                  <td className="px-4 py-2.5 text-right text-slate-400 text-xs">
                    {total > 0 ? `${((row.amount / total) * 100).toFixed(1)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function LongTermRepair({ data }: { data: Record<string, unknown> }) {
  const balance   = (data.balance as number) ?? 0
  const planned   = (data.planned_amount as number) ?? 0
  const actual    = (data.actual_amount as number) ?? 0
  const execRate  = (data.exec_rate as number) ?? 0
  const entries   = (data.entries as Array<{ month: number | null; planned_amount: number; actual_amount: number; balance: number }>) ?? []

  const rateColor = execRate >= 90 ? 'green' : execRate >= 70 ? 'yellow' : 'red'

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="잔액" value={formatKRW(balance)} color="blue" />
        <KpiCard label="계획액" value={formatKRW(planned)} color="slate" />
        <KpiCard label="집행액" value={formatKRW(actual)} color="slate" />
        <KpiCard label="이행률" value={`${execRate}%`} color={rateColor as 'green' | 'yellow' | 'red'} />
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>집행률</span>
          <span>{execRate}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${execRate >= 90 ? 'bg-green-500' : execRate >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${Math.min(execRate, 100)}%` }}
          />
        </div>
      </div>

      {entries.length > 0 && (
        <div className="rounded-xl border border-slate-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-2.5 text-slate-500 font-medium">월</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">계획액</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">집행액</th>
                <th className="text-right px-4 py-2.5 text-slate-500 font-medium">잔액</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-t border-slate-50 hover:bg-slate-50">
                  <td className="px-4 py-2 text-slate-600">{e.month != null ? `${e.month}월` : '연간'}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatKRW(e.planned_amount)}</td>
                  <td className="px-4 py-2 text-right font-medium text-slate-800">{formatKRW(e.actual_amount)}</td>
                  <td className="px-4 py-2 text-right text-slate-500">{formatKRW(e.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AuditReport({ data, reportUrl }: { data: Record<string, unknown>; reportUrl: string | null }) {
  const total    = (data.findings_count as number) ?? 0
  const high     = (data.high_severity as number) ?? 0
  const medium   = (data.medium_severity as number) ?? 0
  const low      = (data.low_severity as number) ?? 0
  const resolved = (data.resolved_count as number) ?? 0
  const summary  = (data.summary as string) ?? ''
  const resolveRate = total > 0 ? Math.round((resolved / total) * 100) : 100

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="총 지적사항" value={`${total}건`} color="slate" />
        <KpiCard label="고위험" value={`${high}건`} color={high > 0 ? 'red' : 'green'} />
        <KpiCard label="중위험" value={`${medium}건`} color={medium > 0 ? 'yellow' : 'green'} />
        <KpiCard label="조치완료" value={`${resolved}건`} color="green" />
      </div>

      {/* 조치율 */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>조치 완료율</span>
          <span>{resolveRate}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${resolveRate >= 80 ? 'bg-green-500' : resolveRate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`}
            style={{ width: `${resolveRate}%` }}
          />
        </div>
      </div>

      {/* 심각도 분포 */}
      {total > 0 && (
        <div className="bg-slate-50 rounded-xl p-4 space-y-2">
          <p className="text-xs font-semibold text-slate-500 mb-3">심각도 분포</p>
          {[
            { label: '고위험', count: high, color: 'bg-red-400' },
            { label: '중위험', count: medium, color: 'bg-yellow-400' },
            { label: '저위험', count: low, color: 'bg-blue-300' },
          ].map(row => (
            <div key={row.label} className="flex items-center gap-3">
              <span className="w-14 text-xs text-slate-500 text-right">{row.label}</span>
              <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${row.color}`}
                  style={{ width: total > 0 ? `${(row.count / total) * 100}%` : '0%' }}
                />
              </div>
              <span className="w-8 text-xs text-slate-600 text-right">{row.count}</span>
            </div>
          ))}
        </div>
      )}

      {summary && (
        <div className="border border-slate-100 rounded-xl px-4 py-3 bg-white">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
            <p className="text-sm text-slate-600">{summary}</p>
          </div>
        </div>
      )}

      {reportUrl && (
        <a
          href={reportUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          <FileText className="h-4 w-4" />
          감사 보고서 PDF 다운로드
        </a>
      )}
    </div>
  )
}

// ────────────── KPI Card ──────────────

type KpiColor = 'blue' | 'slate' | 'green' | 'red' | 'yellow'

const KPI_STYLE: Record<KpiColor, { bg: string; text: string; label: string }> = {
  blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',  label: 'text-blue-500' },
  slate:  { bg: 'bg-slate-50',  text: 'text-slate-800', label: 'text-slate-400' },
  green:  { bg: 'bg-green-50',  text: 'text-green-700', label: 'text-green-500' },
  red:    { bg: 'bg-red-50',    text: 'text-red-700',   label: 'text-red-400' },
  yellow: { bg: 'bg-yellow-50', text: 'text-yellow-700',label: 'text-yellow-500' },
}

function KpiCard({ label, value, color }: { label: string; value: string; color: KpiColor }) {
  const s = KPI_STYLE[color]
  return (
    <div className={`${s.bg} rounded-xl px-4 py-3`}>
      <p className={`text-xs ${s.label} mb-0.5`}>{label}</p>
      <p className={`text-lg font-bold ${s.text}`}>{value}</p>
    </div>
  )
}

// ────────────── Main ──────────────

export function PortalClient({ disclosures }: Props) {
  const availableTypes = TABS.filter(t => disclosures.some(d => d.disclosure_type === t.type))
  const [activeType, setActiveType] = useState<DisclosureType>(availableTypes[0]?.type ?? 'monthly_expenses')

  const periodsForType = disclosures
    .filter(d => d.disclosure_type === activeType)
    .sort((a, b) => b.period.localeCompare(a.period))

  const [activePeriod, setActivePeriod] = useState<string>(periodsForType[0]?.period ?? '')

  const handleTypeChange = (type: DisclosureType) => {
    setActiveType(type)
    const first = disclosures.find(d => d.disclosure_type === type)
    setActivePeriod(first?.period ?? '')
  }

  const activeDisclosure = disclosures.find(
    d => d.disclosure_type === activeType && d.period === activePeriod
  )

  if (availableTypes.length === 0) return null

  return (
    <div className="space-y-4">
      {/* 탭 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100">
          {availableTypes.map(tab => (
            <button
              key={tab.type}
              onClick={() => handleTypeChange(tab.type)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-3.5 text-sm font-medium transition-colors ${
                activeType === tab.type
                  ? 'text-[#8BADD9] border-b-2 border-[#8BADD9] -mb-px bg-blue-50/50'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* 기간 셀렉터 */}
        {periodsForType.length > 1 && (
          <div className="flex gap-2 px-4 py-3 border-b border-slate-50 overflow-x-auto">
            {periodsForType.map(d => (
              <button
                key={d.period}
                onClick={() => setActivePeriod(d.period)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  activePeriod === d.period
                    ? 'bg-[#8BADD9] text-white border-[#8BADD9]'
                    : 'border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
              >
                {d.period}
              </button>
            ))}
          </div>
        )}

        {/* 콘텐츠 */}
        <div className="p-5">
          {activeDisclosure ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-semibold text-slate-800">{activeDisclosure.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    승인일: {new Date(activeDisclosure.approved_at).toLocaleDateString('ko-KR')}
                    {activeDisclosure.kapt_match !== null && (
                      <span className={`ml-2 ${activeDisclosure.kapt_match ? 'text-green-600' : 'text-red-500'}`}>
                        · K-apt {activeDisclosure.kapt_match ? '기준 부합 ✓' : '기준 초과 ✗'}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {activeType === 'monthly_expenses' && (
                <MonthlyExpenses data={activeDisclosure.data} />
              )}
              {activeType === 'misc_income' && (
                <MiscIncome data={activeDisclosure.data} />
              )}
              {activeType === 'long_term_repair' && (
                <LongTermRepair data={activeDisclosure.data} />
              )}
              {activeType === 'audit_report' && (
                <AuditReport data={activeDisclosure.data} reportUrl={activeDisclosure.report_pdf_url} />
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">기간을 선택하세요.</p>
          )}
        </div>
      </div>
    </div>
  )
}
