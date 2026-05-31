import { NextRequest } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createPublicClient } from '@/lib/supabase/public'
import { buildRegulationsContext, REGULATIONS_LAST_UPDATED } from '@/lib/regulations'

export const maxDuration = 30

interface ChatMessage {
  role: 'user' | 'model'
  content: string
}

// ── 공개 데이터 요약 텍스트 생성 ──────────────────────────────────────────────

function buildContext(
  complexName: string,
  address: string | null,
  unitCount: number | null,
  disclosures: Array<{
    disclosure_type: string
    period: string
    title: string
    data: Record<string, unknown>
    approved_at: string
  }>
): string {
  const lines: string[] = [
    `=== 아파트 단지 정보 ===`,
    `단지명: ${complexName}`,
    address ? `주소: ${address}` : '',
    unitCount ? `총 세대수: ${unitCount.toLocaleString()}세대` : '',
    '',
  ]

  for (const d of disclosures) {
    lines.push(`--- [${d.period}] ${d.title} (승인일: ${new Date(d.approved_at).toLocaleDateString('ko-KR')}) ---`)

    if (d.disclosure_type === 'monthly_expenses') {
      const data = d.data as Record<string, unknown>
      lines.push(`총 지출액: ${(data.total_expense as number ?? 0).toLocaleString()}원`)
      lines.push(`영수증 건수: ${data.receipt_count ?? 0}건`)
      const cats = (data.by_category as Array<{ category: string; amount: number; count: number }>) ?? []
      if (cats.length) {
        lines.push(`항목별 지출:`)
        cats.forEach(c => lines.push(`  - ${c.category}: ${c.amount.toLocaleString()}원 (${c.count}건)`))
      }
      const receipts = (data.receipts as Array<{ merchant_name: string | null; amount: number | null; receipt_date: string | null; category: string; flagged: boolean }>) ?? []
      const flagged = receipts.filter(r => r.flagged)
      if (flagged.length) {
        lines.push(`이상 감지 영수증 (${flagged.length}건):`)
        flagged.forEach(r => lines.push(`  - ${r.receipt_date} ${r.merchant_name ?? '(상호미상)'} ${(r.amount ?? 0).toLocaleString()}원`))
      }
    }

    if (d.disclosure_type === 'misc_income') {
      const data = d.data as Record<string, unknown>
      lines.push(`총 잡수입: ${(data.total as number ?? 0).toLocaleString()}원`)
      const byType = (data.by_type as Array<{ type: string; amount: number; count: number }>) ?? []
      const typeLabel: Record<string, string> = { recycling: '재활용', parking: '주차', rental: '임대', interest: '이자', late_fee: '연체료', other: '기타' }
      byType.forEach(t => lines.push(`  - ${typeLabel[t.type] ?? t.type}: ${t.amount.toLocaleString()}원 (${t.count}건)`))
    }

    if (d.disclosure_type === 'long_term_repair') {
      const data = d.data as Record<string, unknown>
      lines.push(`장기수선충당금 잔액: ${(data.balance as number ?? 0).toLocaleString()}원`)
      lines.push(`계획액: ${(data.planned_amount as number ?? 0).toLocaleString()}원`)
      lines.push(`집행액: ${(data.actual_amount as number ?? 0).toLocaleString()}원`)
      lines.push(`이행률: ${data.exec_rate ?? 0}%`)
    }

    if (d.disclosure_type === 'audit_report') {
      const data = d.data as Record<string, unknown>
      lines.push(`지적사항 총계: ${data.findings_count ?? 0}건`)
      lines.push(`  - 고위험: ${data.high_severity ?? 0}건, 중위험: ${data.medium_severity ?? 0}건, 저위험: ${data.low_severity ?? 0}건`)
      lines.push(`조치완료: ${data.resolved_count ?? 0}건`)
      if (data.summary) lines.push(`요약: ${data.summary}`)
    }

    lines.push('')
  }

  return lines.filter(l => l !== null).join('\n')
}

// ── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { complexCode, message, history = [] } = (await req.json()) as {
      complexCode: string
      message: string
      history: ChatMessage[]
    }

    if (!complexCode || !message?.trim()) {
      return new Response('Bad Request', { status: 400 })
    }

    // 공개 데이터 조회
    const supabase = createPublicClient()

    const { data: complex } = await supabase
      .from('apartment_complexes')
      .select('id, name, address, unit_count')
      .eq('public_code', complexCode)
      .single()

    if (!complex) return new Response('Not Found', { status: 404 })

    const { data: disclosures } = await supabase
      .from('public_disclosures')
      .select('disclosure_type, period, title, data, approved_at')
      .eq('apartment_complex_id', complex.id)
      .eq('is_active', true)
      .order('period', { ascending: false })
      .limit(20)

    const context = buildContext(
      complex.name,
      complex.address,
      complex.unit_count,
      (disclosures ?? []) as Parameters<typeof buildContext>[3]
    )

    const regulationsContext = buildRegulationsContext()

    const systemPrompt = `당신은 ${complex.name} 아파트 입주민을 위한 관리비·감사·시설 안내 챗봇입니다.
공동주택관리법 제26조에 따라 공개된 아파트 관리 정보와 단지 운영 규정을 바탕으로 입주민 질문에 친절하고 정확하게 답변하세요.

아래 두 가지 자료를 참고하여 답변하세요.

━━━ [A] 공개된 실제 재무·감사 데이터 ━━━
${context}

━━━ [B] 단지 운영 규정 (최종 업데이트: ${REGULATIONS_LAST_UPDATED}) ━━━
${regulationsContext}

답변 원칙:
1. [A] 데이터(관리비·감사 수치)와 [B] 규정(시설·주차·커뮤니티 등) 모두 활용하세요.
2. 금액은 항상 "원" 단위, 세 자리마다 쉼표를 사용하세요.
3. 이상 감지 영수증이 있으면 해당 내용을 구체적으로 설명하세요.
4. 규정에 명시된 내용은 정확히 전달하고, 없는 내용은 "규정에서 확인되지 않습니다"라고 솔직하게 안내하세요.
5. 규정은 입주자대표회의 의결로 수시 개정될 수 있으므로, 중요한 사항은 관리사무소에 확인을 권장하세요.
6. 답변은 간결하게 (복잡한 내용 제외 3~5문장), 입주민 눈높이에 맞게 설명하세요.
7. 법적·전문적 조언이 필요한 사항은 관리사무소나 전문가 상담을 권유하세요.`

    // Gemini 스트리밍
    const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').replace(/^﻿/, '').trim()
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
    })

    const geminiHistory = history.map(m => ({
      role: m.role,
      parts: [{ text: m.content }],
    }))

    const chat = model.startChat({ history: geminiHistory })
    const result = await chat.sendMessageStream(message)

    // SSE 스트리밍 응답
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[portal/chat]', err)
    return new Response('Internal Server Error', { status: 500 })
  }
}
