import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import type { AIMinutesResult } from '@/lib/council-types'

export const maxDuration = 60

const SYSTEM_PROMPT = `당신은 아파트 입주자대표회의 간사입니다.
회의 녹음 전사 텍스트를 입력받아 4단 표준 회의록을 JSON으로 생성합니다.

규칙:
- 안건은 4유형으로 분류: info(정보공유) / discussion(논의) / decision(결정) / review(실행점검)
- 결정사항은 Drucker 5단계 명시 (d1~d5)
- 액션은 4요소 강제: title / assignee_hint(직책) / due_date_hint(YYYY-MM-DD) / verification_method
- 발언자는 직책만 표시 (성명, 호수 금지): "대표회장, 감사, 관리소장, 동대표" 등
- 개인정보(이름·호수·연락처) 기재 금지
- 코드 블록 없이 JSON 객체만 출력

출력 형식 (엄격히 준수):
{
  "agenda_summary": [
    { "index": 1, "type": "info|discussion|decision|review", "title": "안건명", "time_pct": 20 }
  ],
  "discussion_summary": [
    {
      "agenda_index": 1,
      "summary": "3~5줄 핵심 요약",
      "key_opinions": [
        { "role": "대표회장", "opinion": "1줄 의견" }
      ]
    }
  ],
  "decisions": [
    {
      "title": "결정사항 제목",
      "agenda_type": "decision",
      "d1_classification": "general|exception|crisis",
      "d2_definition": "무엇을 결정했는가",
      "d3_criteria": "만족 조건",
      "d4_execution": "누가/언제/어떻게",
      "d5_feedback": "검증 시점과 방법",
      "legal_type": "manager_only|president_approval|full_council|legal_procedure",
      "actions": [
        {
          "title": "액션 내용",
          "assignee_hint": "담당 직책",
          "due_date_hint": "YYYY-MM-DD",
          "verification_method": "검증 방법"
        }
      ]
    }
  ]
}`

export async function POST(req: NextRequest) {
  try {
    const { meetingId, transcript, heldAt } = await req.json() as {
      meetingId: string
      transcript: string
      heldAt: string
    }

    if (!meetingId || !transcript?.trim()) {
      return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
    }

    // 인증 확인
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    // 전사 텍스트 저장 (새 테이블 — any 캐스팅)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('council_meetings')
      .update({ raw_transcript: transcript, updated_at: new Date().toISOString() })
      .eq('id', meetingId)

    // Gemini API 호출
    const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').replace(/^﻿/, '').trim()
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const heldDate = heldAt ? new Date(heldAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
    const userPrompt = `회의 날짜: ${heldDate}
오늘 날짜: ${new Date().toISOString().split('T')[0]}

아래 전사 텍스트를 분석해서 4단 표준 회의록 JSON을 생성하세요.
due_date_hint는 회의 날짜 이후의 현실적인 기한으로 설정하세요.

=== 전사 텍스트 ===
${transcript.slice(0, 30000)}`

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userPrompt },
    ])

    const raw = result.response.text().trim()

    // JSON 파싱
    let parsed: AIMinutesResult
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('JSON 없음')
      parsed = JSON.parse(jsonMatch[0]) as AIMinutesResult
    } catch {
      return NextResponse.json(
        { error: 'AI 응답 파싱 실패', raw: raw.slice(0, 500) },
        { status: 422 }
      )
    }

    return NextResponse.json({ result: parsed })
  } catch (err) {
    console.error('[council/generate-minutes]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
