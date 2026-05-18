'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Plus, Trash2, FileDown, Save } from 'lucide-react'
import { getLatestBankBalance, saveBankBalance } from '@/lib/actions/bank-balance'
import type { AccountRow } from '@/lib/actions/bank-balance'

interface Props {
  open: boolean
  onClose: () => void
}

function emptyRow(): AccountRow {
  return { bank: '', purpose: '', type: '', accountNo: '', bookAmount: null, confirmedAmount: null, note: '' }
}

function fmtNum(n: number | null): string {
  if (n === null) return ''
  return n.toLocaleString('ko-KR')
}

function parseNum(s: string): number | null {
  const cleaned = s.replace(/,/g, '').trim()
  if (cleaned === '' || cleaned === '-') return null
  const n = parseInt(cleaned, 10)
  return isNaN(n) ? null : n
}

function yearMonthOf(y: number, m: number) {
  return `${y}-${String(m).padStart(2, '0')}`
}

export function BalanceInputModal({ open, onClose }: Props) {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [rows, setRows] = useState<AccountRow[]>([emptyRow()])
  const [verificationNote, setVerificationNote] = useState('이상 없음')

  const [prefilling, setPrefilling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saveMsg, setSaveMsg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const yearMonth = yearMonthOf(year, month)

  // Pre-fill from previous month when modal opens or year/month changes
  const prefill = useCallback(async () => {
    setPrefilling(true)
    setSaveMsg(null)
    setError(null)
    try {
      const prev = await getLatestBankBalance(yearMonth)
      if (prev && prev.accounts.length > 0) {
        setRows(prev.accounts)
        setVerificationNote(prev.verificationNote)
      }
    } finally {
      setPrefilling(false)
    }
  }, [yearMonth])

  useEffect(() => {
    if (open) prefill()
  }, [open, prefill])

  function updateRow(index: number, field: keyof AccountRow, raw: string) {
    setRows((prev) => {
      const next = [...prev]
      if (field === 'bookAmount' || field === 'confirmedAmount') {
        next[index] = { ...next[index], [field]: parseNum(raw) }
      } else {
        next[index] = { ...next[index], [field]: raw }
      }
      return next
    })
  }

  function addRow() {
    setRows((prev) => [...prev, emptyRow()])
  }

  function deleteRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index))
  }

  const totalBook = rows.reduce((s, r) => s + (r.bookAmount ?? 0), 0)
  const totalConfirmed = rows.reduce((s, r) => s + (r.confirmedAmount ?? 0), 0)
  const totalDiff = totalConfirmed - totalBook

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    setError(null)
    try {
      const result = await saveBankBalance(yearMonth, rows, verificationNote)
      if (result.error) {
        setError(result.error)
      } else {
        setSaveMsg('저장되었습니다.')
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleGeneratePDF() {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch('/api/reports/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, accounts: rows, verificationNote }),
      })

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg || `HTTP ${res.status}`)
      }

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `예금잔액대조_${year}년${month}월.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF 생성 실패')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className="w-[95vw] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>예금잔액 대조 확인 입력 — 별지 제3-2호서식</DialogTitle>
        </DialogHeader>

        {/* 연도 / 월 선택 */}
        <div className="flex gap-3 items-end">
          <div className="space-y-1">
            <label className="text-sm font-medium">연도</label>
            <Input
              type="number"
              min={2000}
              max={2099}
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="w-24"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">월</label>
            <Input
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value, 10))}
              className="w-16"
            />
          </div>
          <Button variant="outline" size="sm" onClick={prefill} disabled={prefilling}>
            {prefilling ? <Loader2 className="h-3 w-3 animate-spin" /> : '이전 월 불러오기'}
          </Button>
        </div>

        {/* 계좌 입력 테이블 */}
        <div className="overflow-x-auto rounded border">
          <table className="text-sm border-collapse" style={{ minWidth: '1100px', width: '100%' }}>
            <thead className="bg-muted/50">
              <tr>
                <th className="border px-2 py-2 whitespace-nowrap text-center" style={{ width: '40px' }}>#</th>
                <th className="border px-3 py-2 whitespace-nowrap" style={{ width: '140px' }}>금융기관</th>
                <th className="border px-3 py-2 whitespace-nowrap" style={{ width: '130px' }}>용도</th>
                <th className="border px-3 py-2 whitespace-nowrap" style={{ width: '110px' }}>종류</th>
                <th className="border px-3 py-2 whitespace-nowrap" style={{ width: '170px' }}>계좌번호</th>
                <th className="border px-3 py-2 whitespace-nowrap text-right" style={{ width: '145px' }}>장부금액 (원)</th>
                <th className="border px-3 py-2 whitespace-nowrap text-right" style={{ width: '145px' }}>확인금액 (원)</th>
                <th className="border px-3 py-2 whitespace-nowrap text-right" style={{ width: '145px' }}>차이금액 (원)</th>
                <th className="border px-3 py-2 whitespace-nowrap">비고</th>
                <th className="border px-2 py-2" style={{ width: '44px' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const diff =
                  row.bookAmount !== null && row.confirmedAmount !== null
                    ? row.confirmedAmount - row.bookAmount
                    : null
                return (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="border px-2 py-1.5 text-center text-muted-foreground text-sm">{i + 1}</td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.bank}
                        onChange={(e) => updateRow(i, 'bank', e.target.value)}
                        placeholder="국민은행"
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
                      />
                    </td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.purpose}
                        onChange={(e) => updateRow(i, 'purpose', e.target.value)}
                        placeholder="관리비"
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
                      />
                    </td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.type}
                        onChange={(e) => updateRow(i, 'type', e.target.value)}
                        placeholder="보통예금"
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
                      />
                    </td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.accountNo}
                        onChange={(e) => updateRow(i, 'accountNo', e.target.value)}
                        placeholder="123-456-789"
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
                      />
                    </td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.bookAmount !== null ? row.bookAmount.toLocaleString('ko-KR') : ''}
                        onChange={(e) => updateRow(i, 'bookAmount', e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0 text-right"
                      />
                    </td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.confirmedAmount !== null ? row.confirmedAmount.toLocaleString('ko-KR') : ''}
                        onChange={(e) => updateRow(i, 'confirmedAmount', e.target.value)}
                        placeholder="0"
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0 text-right"
                      />
                    </td>
                    <td className={`border px-3 py-1.5 text-right text-sm font-medium ${diff !== null && diff !== 0 ? 'text-destructive' : ''}`}>
                      {diff !== null ? fmtNum(diff) : ''}
                    </td>
                    <td className="border px-2 py-1.5">
                      <Input
                        value={row.note}
                        onChange={(e) => updateRow(i, 'note', e.target.value)}
                        className="h-8 text-sm border-0 p-0 focus-visible:ring-0"
                      />
                    </td>
                    <td className="border px-2 py-1.5 text-center">
                      <button
                        onClick={() => deleteRow(i)}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                        disabled={rows.length === 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}

              {/* 합계 행 */}
              <tr className="bg-muted/40 font-semibold text-sm">
                <td className="border px-3 py-2 text-center" colSpan={5}>합계</td>
                <td className="border px-3 py-2 text-right">{fmtNum(totalBook)}</td>
                <td className="border px-3 py-2 text-right">{fmtNum(totalConfirmed)}</td>
                <td className={`border px-3 py-2 text-right ${totalDiff !== 0 ? 'text-destructive' : ''}`}>
                  {fmtNum(totalDiff)}
                </td>
                <td className="border px-3 py-2" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <Button variant="outline" size="sm" onClick={addRow} className="w-fit">
          <Plus className="h-3.5 w-3.5 mr-1" />
          계좌 추가
        </Button>

        {/* 대조 확인 문구 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium">대조 확인 문구</label>
          <Textarea
            rows={3}
            value={verificationNote}
            onChange={(e) => setVerificationNote(e.target.value)}
            placeholder="이상 없음"
            className="text-sm resize-none"
          />
        </div>

        {/* 메시지 */}
        {saveMsg && (
          <p className="text-sm text-green-600">{saveMsg}</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter className="gap-2 flex-row justify-end">
          <Button variant="outline" onClick={onClose}>닫기</Button>
          <Button variant="outline" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            저장
          </Button>
          <Button onClick={handleGeneratePDF} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                PDF 생성 중…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4 mr-2" />
                PDF 생성
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
