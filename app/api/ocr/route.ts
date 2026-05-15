import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 60
import { GoogleGenerativeAI } from '@google/generative-ai'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

// ── 타입 ──────────────────────────────────────────────────────────────────────

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

// ── Gemini 멀티모달: 이미지 → OCR 텍스트 + 13요소 파싱 (한 번에) ─────────────

async function analyzeReceiptImage(base64: string, mimeType: string): Promise<GeminiResult> {
  const apiKey = (process.env.GOOGLE_GEMINI_API_KEY ?? '').replace(/^﻿/, '').trim()
  const genAI = new GoogleGenerativeAI(apiKey)
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

  // 첫 번째 { 와 마지막 } 사이를 추출 (코드블록·설명 텍스트 방어)
  const raw = result.response.text()
  const first = raw.indexOf('{')
  const last = raw.lastIndexOf('}')
  const text = first !== -1 && last > first
    ? raw.slice(first, last + 1)
    : raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()

  try {
    return JSON.parse(text) as GeminiResult
  } catch {
    console.error('[OCR route] JSON 파싱 실패, 원문:', raw.slice(0, 300))
    // 파싱 실패 시 raw_text는 보존하고 parsed는 기본값으로 반환
    return {
      raw_text: raw,
      parsed: {
        date: null, merchant: null, business_no: null,
        supply_amount: null, vat: null, total: null,
        payment_method: null, card_company: null, approval_no: null,
        currency: 'KRW', category: null, confidence: 0.3,
        notes: 'AI 응답 파싱 실패 — 수동 검수 필요',
      },
    }
  }
}

// ── CoV-1: supply_amount + vat = total ────────────────────────────────────────

function covMismatch(p: ParsedReceipt): boolean {
  if (p.supply_amount === null || p.vat === null || p.total === null) return false
  return Math.abs(p.supply_amount + p.vat - p.total) > 1
}

// ── CoV-2: 흐림·잘림·해상도 부족 패턴 탐지 ──────────────────────────────────

const BLUR_PATTERNS = [
  /[?□■◻◼▪▫]{3,}/,
  /\.{5,}/,
  /_{4,}/,
  /판독\s*불가/,
  /흐림|번짐|불명확/,
]

function covBlur(rawText: string, parsed: ParsedReceipt): { detected: boolean; blurFields: string[] } {
  const hasBlurIndicator = BLUR_PATTERNS.some(re => re.test(rawText))
  const tooShort = rawText.trim().replace(/\s/g, '').length < 30

  const blurFields: string[] = []
  if (parsed.merchant === null) blurFields.push('가맹점명')
  if (parsed.date === null) blurFields.push('날짜')
  if (parsed.total === null) blurFields.push('합계금액')

  return {
    detected: hasBlurIndicator || tooShort || blurFields.length >= 2,
    blurFields,
  }
}

// ── EXIF 메타데이터 확인 (캡처화면 탐지) ─────────────────────────────────────

function hasExifMetadata(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/png') {
    const header = buffer.slice(0, 256).toString('binary')
    return header.includes('tEXt') || header.includes('iTXt') || header.includes('eXIf')
  }
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    const limit = Math.min(buffer.length - 1, 512)
    for (let i = 2; i < limit; i++) {
      if (buffer[i] === 0xFF && buffer[i + 1] === 0xE1) return true
    }
    return false
  }
  return true
}

// ── Confidence → status ───────────────────────────────────────────────────────

function resolveStatus(confidence: number): 'approved' | 'manual_review' | 'rejected' {
  if (confidence >= 0.85) return 'approved'
  if (confidence >= 0.65) return 'manual_review'
  return 'rejected'
}

// ── Route handler ─────────────────────────────────────────────────────────────

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
      return NextResponse.json({ error: '이미지 파일만 업로드 가능합니다.' }, { status: 400 })
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

    const tags: string[] = []
    let confidenceAdj = 0

    // ── CoV-2: 흐림·잘림·해상도 부족 ─────────────────────────────────────────
    const blur = covBlur(raw_text, parsed)
    if (blur.detected) {
      tags.push(blur.blurFields.length > 0 ? `[불명: ${blur.blurFields.join(', ')}]` : '[불명]')
      confidenceAdj -= 0.3
    }

    // ── 엣지 1: 간이영수증 ────────────────────────────────────────────────────
    if (!parsed.business_no) {
      tags.push('[간이영수증]')
      parsed.vat = 0
    }

    // ── 엣지 2: 해외영수증 ────────────────────────────────────────────────────
    if (/\b(USD|EUR|JPY|CNY|GBP|AUD)\b/i.test(raw_text) || (parsed.currency && parsed.currency !== 'KRW')) {
      tags.push('[환율적용필요]')
      confidenceAdj -= 0.1
    }

    // ── 엣지 3: 카드전표 ──────────────────────────────────────────────────────
    if (/전표|이용대금명세서/.test(raw_text)) {
      tags.push('[카드전표-부가세별도확인]')
    }

    // ── 엣지 4: 캡처화면 (EXIF 메타데이터 부재) ──────────────────────────────
    if (!hasExifMetadata(buffer, file.type)) {
      tags.push('[캡처화면-메타부재]')
      confidenceAdj -= 0.05
    }

    // ── CoV-3 + 엣지 5: 중복/이중결제 탐지 ──────────────────────────────────
    let forcedConfidence: number | null = null
    if (parsed.date && parsed.merchant && parsed.total !== null) {
      const { data: duplicates } = await supabase
        .from('receipts')
        .select('id, review_note')
        .eq('apartment_complex_id', profile.apartment_complex_id)
        .eq('receipt_date', parsed.date)
        .eq('merchant_name', parsed.merchant)
        .eq('amount', parsed.total)

      if (duplicates && duplicates.length > 0) {
        tags.push('[중복가능]')
        forcedConfidence = 0.7

        // 이중결제: 첫 번째 건에 [원본] 태그 추가
        const original = duplicates[0]
        const existingNote = original.review_note ?? ''
        if (!existingNote.includes('[원본]')) {
          await supabase
            .from('receipts')
            .update({ review_note: `${existingNote} [원본]`.trim() })
            .eq('id', original.id)
        }
      }
    }

    // notes 병합
    if (tags.length > 0) {
      parsed.notes = [parsed.notes, ...tags].filter(Boolean).join(' ')
    }

    // ── CoV-1 검산 ────────────────────────────────────────────────────────────
    const hasCovMismatch = covMismatch(parsed)
    const policyFlags: Record<string, unknown> = {}
    if (hasCovMismatch) {
      policyFlags['cov_mismatch'] = {
        expected_total: (parsed.supply_amount ?? 0) + (parsed.vat ?? 0),
        actual_total: parsed.total,
      }
    }

    // ── 최종 confidence 계산 ──────────────────────────────────────────────────
    // 우선순위: CoV-3 강제값 > CoV-2+엣지 누적 조정 > CoV-1 상한
    let finalConfidence: number
    if (forcedConfidence !== null) {
      finalConfidence = forcedConfidence
    } else {
      finalConfidence = Math.max(0, Math.min(1, parsed.confidence + confidenceAdj))
    }
    if (hasCovMismatch) finalConfidence = Math.min(finalConfidence, 0.79)
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
      return NextResponse.json(
        { error: 'AI 요청 한도 초과입니다. 잠시 후 다시 시도해 주세요.' },
        { status: 429 }
      )
    }
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
