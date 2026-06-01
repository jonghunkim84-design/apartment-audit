import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 30

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json() as { query: string }
    if (!query?.trim()) {
      return NextResponse.json({ error: '검색어를 입력하세요.' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('apartment_complex_id')
      .eq('id', user.id)
      .single()
    const complexId = profile?.apartment_complex_id
    if (!complexId) return NextResponse.json({ error: '단지 미설정' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const q = query.trim()

    // ── 회의 검색 ────────────────────────────────────────────
    const { data: meetings } = await db
      .from('council_meetings')
      .select('id, title, held_at, meeting_type, status')
      .eq('apartment_complex_id', complexId)
      .ilike('title', `%${q}%`)
      .order('held_at', { ascending: false })
      .limit(5)

    // ── 결정사항 검색 ─────────────────────────────────────────
    const { data: decisions } = await db
      .from('council_decisions')
      .select(`
        id, title, d2_definition, d3_criteria, d4_execution, legal_type,
        council_meetings!meeting_id(id, title, held_at)
      `)
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(8)

    // ── 결정 내용(definition)으로도 검색 ──────────────────────
    const { data: decisions2 } = await db
      .from('council_decisions')
      .select(`
        id, title, d2_definition, d3_criteria, d4_execution, legal_type,
        council_meetings!meeting_id(id, title, held_at)
      `)
      .ilike('d2_definition', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    // ── 액션 검색 ─────────────────────────────────────────────
    const { data: actions } = await db
      .from('council_actions')
      .select('id, title, status, due_date, assignee_name')
      .eq('apartment_complex_id', complexId)
      .ilike('title', `%${q}%`)
      .order('created_at', { ascending: false })
      .limit(5)

    // 결정사항 중복 제거
    const decisionMap = new Map()
    for (const d of [...(decisions ?? []), ...(decisions2 ?? [])]) {
      if (!decisionMap.has(d.id)) decisionMap.set(d.id, d)
    }
    const allDecisions = Array.from(decisionMap.values()).slice(0, 10)

    const hasResults =
      (meetings ?? []).length > 0 ||
      allDecisions.length > 0 ||
      (actions ?? []).length > 0

    // ── Gemini AI 요약 ────────────────────────────────────────
    let aiSummary = ''
    if (hasResults) {
      const context = [
        meetings?.length
          ? `[회의] ${meetings.map((m: { title: string; held_at: string }) =>
              `${m.title}(${m.held_at?.slice(0, 10)})`).join(', ')}`
          : '',
        allDecisions.length
          ? `[결정사항] ${allDecisions.map((d: { title: string; d2_definition?: string }) =>
              `${d.title}${d.d2_definition ? ': ' + d.d2_definition.slice(0, 60) : ''}`).join(' / ')}`
          : '',
        actions?.length
          ? `[액션] ${actions.map((a: { title: string; status: string }) =>
              `${a.title}(${a.status})`).join(', ')}`
          : '',
      ].filter(Boolean).join('\n')

      const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').replace(/^﻿/, '').trim()
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

      const prompt = `아파트 입주자대표회의 회의록 데이터베이스에서 "${q}"를 검색한 결과입니다.
아래 데이터를 바탕으로 3~5문장으로 간결하게 한국어 요약을 작성하세요.
결정 배경, 기준, 결과를 포함하세요. 없는 정보는 추측하지 마세요.

${context}`

      try {
        const result = await model.generateContent(prompt)
        aiSummary = result.response.text().trim()
      } catch { /* AI 실패 시 빈 문자열 */ }
    }

    return NextResponse.json({
      query: q,
      aiSummary,
      meetings: meetings ?? [],
      decisions: allDecisions,
      actions: actions ?? [],
      total: (meetings?.length ?? 0) + allDecisions.length + (actions?.length ?? 0),
    })
  } catch (err) {
    console.error('[council/search]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
