import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

// ── Gemini multimodal: 이미지 → OCR 텍스트 + 13요소 파싱 (한 번에) ────────

interface ParsedReceipt {
  date: string | null
  merchant: string | null
  business_no: string | null
  supply_amount: number | null
  vat: number | null
  total: number | null
  payment_method: 'card' | 'cash' | 'transfer' | 'other' | null
  card_company: string | null
  approval_no: string | null
  currency: string
  category: string | null
  confidence: number
  notes: string | null
}

interface GeminiResult {
  raw_text: string
  parsed: ParsedReceipt
}

async function analyzeReceiptImage(
  base64: string,
  mimeType: string
): Promise<GeminiResult> {
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `이 영수증 이미지를 분석하세요. 코드 블록 없이 JSON 객체만 출력하세요.

다음 형식으로 반환하세요:
{
  "raw_text": "이미지에서 읽은 모든 텍스트 (줄바꿈 포함)",
  "parsed": {
    "date": "YYYY-MM-DD 또는 null",
    "merchant": "가맹점명 또는 null",
    "business_no": "XXX-XX-XXXXX 또는 null",
    "supply_amount": 공급가액 정수 또는 null,
    "vat": 부가세 정수 또는 null,
    "total": 합계금액 정수 또는 null,
    "payment_method": "card|cash|transfer|other 또는 null",
    "card_company": "카드사명 또는 null",
    "approval_no": "승인번호 또는 null",
    "currency": "KRW",
    "category": "식비|교통|사무용품|시설관리|인건비|기타 또는 null",
    "confidence": 0.0~1.0 신뢰도,
    "notes": "특이사항 또는 null"
  }
}`

  const result = await model.generateContent([
    { inlineData: { mimeType, data: base64 } },
    { text: prompt },
  ])

  const text = result.response
    .text()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  return JSON.parse(text) as GeminiResult
}

// ── CoV-1: supply_amount + vat = total ────────────────────────────────────

function covMismatch(p: ParsedReceipt): boolean {
  if (p.supply_amount === null || p.vat === null || p.total === null) return false
  return Math.abs(p.supply_amount + p.vat - p.total) > 1
}

// ── Confidence → status ───────────────────────────────────────────────────

function resolveStatus(
  confidence: number
): 'approved' | 'manual_review' | 'rejected' {
  if (confidence >= 0.85) return 'approved'
  if (confidence >= 0.65) return 'manual_review'
  return 'rejected'
}

// ── Route handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('apartment_complex_id')
      .eq('id', user.id)
      .single()

    if (!profile?.apartment_complex_id) {
      return NextResponse.json(
        { error: '아파트 단지가 설정되지 않았습니다.' },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })

    if (!file.type.startsWith('image/')) {
      return NextResponse.json(
        { error: '이미지 파일만 업로드 가능합니다.' },
        { status: 400 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')

    // 이미지 Storage 업로드 (실패해도 계속 진행)
    let imageUrl: string | null = null
    const storagePath = `${profile.apartment_complex_id}/${user.id}/${Date.now()}_${file.name}`
    const { data: storageData } = await supabase.storage
      .from('receipts')
      .upload(storagePath, file, { contentType: file.type, upsert: false })
    if (storageData) {
      const { data: signedData } = await supabase.storage
        .from('receipts')
        .createSignedUrl(storageData.path, 60 * 60 * 24 * 365)
      imageUrl = signedData?.signedUrl ?? null
    }

    // Gemini 멀티모달 분석 (OCR + 13요소 파싱 한 번에)
    const { raw_text, parsed } = await analyzeReceiptImage(base64, file.type)

    if (!raw_text.trim()) {
      return NextResponse.json(
        { error: '이미지에서 텍스트를 추출할 수 없습니다.' },
        { status: 422 }
      )
    }

    // CoV-1 검산
    const hasCovMismatch = covMismatch(parsed)
    const policyFlags: Record<string, unknown> = {}
    if (hasCovMismatch) {
      policyFlags['cov_mismatch'] = {
        expected_total: (parsed.supply_amount ?? 0) + (parsed.vat ?? 0),
        actual_total: parsed.total,
      }
    }

    const finalConfidence = hasCovMismatch
      ? Math.min(parsed.confidence, 0.79)
      : parsed.confidence
    const status = resolveStatus(finalConfidence)

    const { data: receipt, error: insertError } = await supabase
      .from('receipts')
      .insert({
        uploaded_by: user.id,
        apartment_complex_id: profile.apartment_complex_id,
        ocr_raw_text: raw_text,
        original_image_url: imageUrl,
        ai_parsed_data: parsed as unknown as Json,
        receipt_date: parsed.date,
        merchant_name: parsed.merchant,
        business_number: parsed.business_no,
        supply_amount: parsed.supply_amount,
        tax_amount: parsed.vat,
        amount: parsed.total,
        payment_method: parsed.payment_method,
        card_company: parsed.card_company,
        approval_number: parsed.approval_no,
        merchant_category: parsed.category,
        confidence_score: finalConfidence,
        policy_flags: Object.keys(policyFlags).length > 0
          ? (policyFlags as unknown as Json)
          : null,
        status,
      })
      .select('id, status, confidence_score')
      .single()

    if (insertError) throw insertError

    return NextResponse.json({
      receipt_id: receipt.id,
      confidence: finalConfidence,
      status: receipt.status,
      flags: policyFlags,
      parsed,
    })
  } catch (err) {
    console.error('[OCR route]', err)
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('429') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('rate')) {
      return NextResponse.json({ error: 'AI 요청 한도 초과입니다. 잠시 후 다시 시도해 주세요.' }, { status: 429 })
    }
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
