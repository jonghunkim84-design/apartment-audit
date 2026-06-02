'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Bot, ChevronRight, AlertCircle } from 'lucide-react'
import { createMeeting, saveMinutes } from '@/lib/actions/council'
import type { CouncilTerm, MeetingType, AIMinutesResult } from '@/lib/council-types'
import { MEETING_TYPE_LABEL } from '@/lib/council-types'

interface Props { activeTerm: CouncilTerm | null }

const CONSENT_SCRIPT =
  '본 회의는 회의록 작성을 위해 녹음·전사됩니다. 녹음 파일은 5년 보관 후 폐기되며, 회의록은 결정사항 및 액션 추출 목적으로만 사용됩니다. 동의하지 않으시는 분은 회의 시작 전 간사에게 알려주시기 바랍니다.'

export function NewMeetingClient({ activeTerm }: Props) {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  // Step 1 fields
  const [title, setTitle] = useState('')
  const [meetingType, setMeetingType] = useState<MeetingType>('regular')
  const [heldAt, setHeldAt] = useState('')

  useEffect(() => {
    const d = new Date(); d.setMinutes(0, 0, 0)
    setHeldAt(d.toISOString().slice(0, 16))
  }, [])
  const [location, setLocation] = useState('')
  const [quorumRequired, setQuorumRequired] = useState('')
  const [quorumPresent, setQuorumPresent] = useState('')
  const [consentConfirmed, setConsentConfirmed] = useState(false)

  // Step 2 fields
  const [transcript, setTranscript] = useState('')
  const [meetingId, setMeetingId] = useState('')
  const [aiResult, setAiResult] = useState<AIMinutesResult | null>(null)

  // Step 1 → 회의 등록
  async function handleStep1() {
    if (!title.trim() || !heldAt || !consentConfirmed) {
      setError('제목, 일시, 녹음 동의 확인은 필수입니다.')
      return
    }
    setSaving(true); setError('')
    try {
      const meeting = await createMeeting({
        title,
        meeting_type: meetingType,
        held_at: new Date(heldAt).toISOString(),
        location: location || undefined,
        quorum_required: quorumRequired ? parseInt(quorumRequired) : undefined,
        quorum_present: quorumPresent ? parseInt(quorumPresent) : undefined,
        quorum_met: quorumRequired && quorumPresent
          ? parseInt(quorumPresent) >= parseInt(quorumRequired)
          : undefined,
        recording_consent_confirmed: consentConfirmed,
        term_id: activeTerm?.id,
      })
      setMeetingId(meeting.id)
      setStep(2)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  // Step 2 → AI 회의록 생성
  async function handleGenerate() {
    if (!transcript.trim()) { setError('전사 텍스트를 입력하세요.'); return }
    setGenerating(true); setError('')
    try {
      const res = await fetch('/api/council/generate-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId, transcript, heldAt: new Date(heldAt).toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '생성 실패')
      setAiResult(json.result as AIMinutesResult)
      setStep(3)
    } catch (e) {
      setError(String(e))
    } finally {
      setGenerating(false)
    }
  }

  // Step 3 → 저장
  async function handleSave() {
    if (!aiResult) return
    setSaving(true); setError('')
    try {
      await saveMinutes(meetingId, aiResult)
      router.push(`/council/meetings/${meetingId}`)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">새 회의 등록</h1>

      {/* 스텝 인디케이터 */}
      <div className="flex items-center gap-2 text-sm">
        {[['1', '기본 정보'], ['2', '전사 입력'], ['3', '회의록 검토']].map(([n, label], i) => (
          <div key={n} className="flex items-center gap-2">
            {i > 0 && <ChevronRight className="h-4 w-4 text-slate-300" />}
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
              step === (i + 1) ? 'bg-[#8BADD9] text-white' :
              step > (i + 1) ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'
            }`}>
              {n}. {label}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 text-red-700 text-sm px-4 py-3 rounded-xl border border-red-100">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">회의 제목 *</label>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="예: 2026년 6월 정기 입주자대표회의"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">회의 유형</label>
              <select
                value={meetingType}
                onChange={e => setMeetingType(e.target.value as MeetingType)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]"
              >
                {(Object.entries(MEETING_TYPE_LABEL) as [MeetingType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">일시 *</label>
              <input
                type="datetime-local"
                value={heldAt}
                onChange={e => setHeldAt(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">장소</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="예: 관리사무소 회의실"
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">의결 정족수</label>
              <input
                type="number"
                value={quorumRequired}
                onChange={e => setQuorumRequired(e.target.value)}
                placeholder="필요 인원"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">실제 참석</label>
              <input
                type="number"
                value={quorumPresent}
                onChange={e => setQuorumPresent(e.target.value)}
                placeholder="참석 인원"
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9]"
              />
            </div>
          </div>

          {/* 녹음 동의 */}
          <div className="bg-blue-50 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-slate-700">📢 회의 시작 표준 멘트 (낭독 필수)</p>
            <p className="text-sm text-slate-600 leading-relaxed">{CONSENT_SCRIPT}</p>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={e => setConsentConfirmed(e.target.checked)}
                className="w-4 h-4 accent-[#8BADD9]"
              />
              <span className="text-sm text-slate-700 font-medium">
                회의 시작 전 녹음 동의 멘트를 완료했습니다 *
              </span>
            </label>
          </div>

          <button
            onClick={handleStep1}
            disabled={saving}
            className="w-full bg-[#8BADD9] text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            회의 등록 후 다음 단계
          </button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Bot className="h-5 w-5 text-[#8BADD9]" />
              <label className="text-sm font-medium text-slate-700">전사 텍스트 입력</label>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              클로바노트 등 전사 결과를 붙여넣으세요. AI가 4단 표준 회의록을 자동 생성합니다.
            </p>
            <textarea
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              rows={14}
              placeholder="전사 텍스트를 여기에 붙여넣으세요..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#8BADD9] resize-none"
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{transcript.length.toLocaleString()}자</p>
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating || !transcript.trim()}
            className="w-full bg-[#8BADD9] text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating
              ? <><Loader2 className="h-4 w-4 animate-spin" />AI 회의록 생성 중 (10~30초)...</>
              : <><Bot className="h-4 w-4" />AI 회의록 자동 생성</>
            }
          </button>

          <button
            onClick={() => router.push(`/council/meetings/${meetingId}`)}
            className="w-full border border-slate-200 text-slate-600 py-2 rounded-xl text-sm hover:bg-slate-50 transition-colors"
          >
            나중에 입력 (회의만 저장)
          </button>
        </div>
      )}

      {/* Step 3 — AI 결과 미리보기 */}
      {step === 3 && aiResult && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-[#8BADD9]" />
              <h2 className="font-semibold text-slate-800">AI 생성 회의록 미리보기</h2>
            </div>

            {/* 1단 안건 */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">1단 — 안건</p>
              <div className="space-y-1">
                {aiResult.agenda_summary.map((a, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      a.type === 'decision' ? 'bg-blue-100 text-blue-700' :
                      a.type === 'review' ? 'bg-yellow-100 text-yellow-700' :
                      a.type === 'discussion' ? 'bg-purple-100 text-purple-700' :
                      'bg-slate-100 text-slate-500'
                    }`}>
                      {a.type === 'decision' ? '결정' : a.type === 'review' ? '점검' : a.type === 'discussion' ? '논의' : '정보'}
                    </span>
                    <span className="text-slate-700">{a.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 3단 결정사항 */}
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">3단 — 결정사항 ({aiResult.decisions.length}건)</p>
              <div className="space-y-3">
                {aiResult.decisions.map((d, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-4 text-sm">
                    <p className="font-medium text-slate-800">{d.title}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      분류: {d.d1_classification === 'crisis' ? '위기' : d.d1_classification === 'exception' ? '예외' : '일반'} ·
                      {d.legal_type === 'full_council' ? ' 전체의결 필요' : d.legal_type === 'president_approval' ? ' 대표회장 승인' : ' 관리소장 자율'}
                    </p>
                    {d.actions.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {d.actions.map((a, j) => (
                          <div key={j} className="text-xs text-slate-600 flex items-start gap-1">
                            <span className="text-[#8BADD9] font-bold">→</span>
                            <span>{a.title} ({a.assignee_hint} / {a.due_date_hint})</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-400 bg-yellow-50 rounded-xl p-3">
              ⚠️ AI 생성 내용입니다. 저장 후 상세 화면에서 수정·검수·공개 처리를 진행하세요.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep(2); setAiResult(null) }}
              className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm hover:bg-slate-50"
            >
              ← 다시 생성
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-[#8BADD9] text-white py-2.5 rounded-xl font-medium text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              저장 & 검수 화면으로
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
