import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

// ── 한국 법정 공휴일 (2025–2026) ──────────────────────────────────────────────

const KR_HOLIDAYS = new Set([
  '2025-01-01', '2025-01-28', '2025-01-29', '2025-01-30',
  '2025-03-01', '2025-05-05', '2025-05-06', '2025-06-06',
  '2025-08-15', '2025-10-03', '2025-10-05', '2025-10-06',
  '2025-10-07', '2025-10-08', '2025-10-09', '2025-12-25',
  '2026-01-01', '2026-01-27', '2026-01-28', '2026-01-29',
  '2026-03-01', '2026-05-05', '2026-06-06',
  '2026-08-15', '2026-09-24', '2026-09-25', '2026-09-26',
  '2026-10-03', '2026-10-09', '2026-12-25',
])

const PROHIBITED_KEYWORDS = ['노래방', '유흥', '룸살롱', '카지노']
const MEAL_LIMIT = 30_000

// ── 타입 ──────────────────────────────────────────────────────────────────────

type CheckType = 'split_payment' | 'time_restriction' | 'prohibited_category' | 'limit_exceeded'

interface PolicyFlag {
  type: string
  [key: string]: unknown
}

// ── 헬퍼: UTC ISO → KST 시(0-23) ─────────────────────────────────────────────

function kstHour(utcIso: string): number {
  return new Date(new Date(utcIso).getTime() + 9 * 3_600_000).getUTCHours()
}

// OCR 원문에서 HH:MM 패턴 추출
function extractHourFromRaw(raw: string | null): number | null {
  if (!raw) return null
  const m = raw.match(/\b([01]?\d|2[0-3]):([0-5]\d)/)
  return m ? parseInt(m[1], 10) : null
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
      return NextResponse.json({ error: '아파트 단지가 설정되지 않았습니다.' }, { status: 400 })
    }

    const body = await request.json().catch(() => ({}))
    const receiptId = body?.receipt_id as string | undefined
    if (!receiptId) {
      return NextResponse.json({ error: 'receipt_id가 없습니다.' }, { status: 400 })
    }

    // 영수증 조회 (소유권 검증)
    const { data: receipt, error: fetchError } = await supabase
      .from('receipts')
      .select('*')
      .eq('id', receiptId)
      .eq('apartment_complex_id', profile.apartment_complex_id)
      .single()

    if (fetchError || !receipt) {
      return NextResponse.json({ error: '영수증을 찾을 수 없습니다.' }, { status: 404 })
    }

    const flags: PolicyFlag[] = []
    const checks: Array<{
      receipt_id: string
      check_type: CheckType
      is_violation: boolean
      details: Json
    }> = []

    // ── 필터 1: 쪼개기 탐지 ─────────────────────────────────────────────────────
    // 같은 business_no, 7일 이내, 3건 이상이면 쪼개기 의심
    if (receipt.business_number && receipt.receipt_date) {
      const base = new Date(receipt.receipt_date).getTime()
      const from = new Date(base - 7 * 86_400_000).toISOString().slice(0, 10)
      const to   = new Date(base + 7 * 86_400_000).toISOString().slice(0, 10)

      const { data: related } = await supabase
        .from('receipts')
        .select('id, amount, receipt_date')
        .eq('business_number', receipt.business_number)
        .eq('apartment_complex_id', profile.apartment_complex_id)
        .neq('id', receiptId)
        .gte('receipt_date', from)
        .lte('receipt_date', to)

      const relatedCount = (related?.length ?? 0) + 1  // 현재 건 포함
      const isViolation = relatedCount >= 3

      checks.push({
        receipt_id: receiptId,
        check_type: 'split_payment',
        is_violation: isViolation,
        details: { 관련_건수: relatedCount, 조회_기간_일: 7 } as Json,
      })

      if (isViolation) {
        flags.push({ type: '쪼개기의심', 관련_건수: relatedCount })
      }
    }

    // ── 필터 2: 시간대 이상 ───────────────────────────────────────────────────
    // 공휴일 또는 23:00–05:00 거래
    const isHoliday = receipt.receipt_date ? KR_HOLIDAYS.has(receipt.receipt_date) : false
    const txHour = extractHourFromRaw(receipt.ocr_raw_text) ?? kstHour(receipt.created_at)
    const isOffHour = txHour >= 23 || txHour < 5
    const timeViolation = isHoliday || isOffHour

    checks.push({
      receipt_id: receiptId,
      check_type: 'time_restriction',
      is_violation: timeViolation,
      details: { 공휴일: isHoliday, 시간_KST: txHour, 심야시간: isOffHour } as Json,
    })

    if (timeViolation) {
      flags.push({ type: '시간대이상', 공휴일: isHoliday, 시간_KST: txHour })
    }

    // ── 필터 3: 금지업종 ────────────────────────────────────────────────────────
    // 금지 키워드 포함 시 flags 추가 + status → manual_review
    const merchantName = receipt.merchant_name ?? ''
    const matchedKeyword = PROHIBITED_KEYWORDS.find(k => merchantName.includes(k)) ?? null
    const isProhibited = matchedKeyword !== null

    checks.push({
      receipt_id: receiptId,
      check_type: 'prohibited_category',
      is_violation: isProhibited,
      details: { merchant_name: merchantName, 매칭_키워드: matchedKeyword } as Json,
    })

    if (isProhibited) {
      flags.push({ type: '정책위반', 사유: '금지업종', 키워드: matchedKeyword })
    }

    // ── 필터 4: 한도초과 ────────────────────────────────────────────────────────
    // 식비(식대) 카테고리이고 총액 > 30,000원
    const category = receipt.merchant_category ?? ''
    const amount = receipt.amount ?? 0
    const isMealCategory = category === '식비' || category === '식대'
    const isOverLimit = isMealCategory && amount > MEAL_LIMIT

    checks.push({
      receipt_id: receiptId,
      check_type: 'limit_exceeded',
      is_violation: isOverLimit,
      details: { 카테고리: category, 금액: amount, 한도: MEAL_LIMIT } as Json,
    })

    if (isOverLimit) {
      flags.push({ type: '한도초과', 항목: '식대', 한도: MEAL_LIMIT, 실제금액: amount })
    }

    // ── receipt_policy_checks 저장 (기존 기록 교체) ───────────────────────────
    await supabase
      .from('receipt_policy_checks')
      .delete()
      .eq('receipt_id', receiptId)

    if (checks.length > 0) {
      await supabase.from('receipt_policy_checks').insert(checks)
    }

    // ── receipts.policy_flags + status 업데이트 ────────────────────────────────
    const hasViolation = flags.length > 0
    const newStatus = isProhibited || hasViolation
      ? ('manual_review' as const)
      : receipt.status

    // 기존 플래그 중 이번 검사 유형과 겹치지 않는 것만 유지 후 병합
    const existingFlags: PolicyFlag[] = Array.isArray(receipt.policy_flags)
      ? (receipt.policy_flags as PolicyFlag[])
      : []
    const newFlagTypes = new Set(flags.map(f => f.type))
    const mergedFlags = [
      ...existingFlags.filter(f => !newFlagTypes.has(f.type as string)),
      ...flags,
    ]

    await supabase
      .from('receipts')
      .update({
        policy_flags: mergedFlags.length > 0 ? (mergedFlags as unknown as Json) : null,
        ...(hasViolation && { status: newStatus }),
      })
      .eq('id', receiptId)

    return NextResponse.json({
      receipt_id: receiptId,
      flags,
      status: newStatus,
      checks: checks.map(c => ({ check_type: c.check_type, is_violation: c.is_violation })),
    })
  } catch (err) {
    console.error('[validate route]', err)
    return NextResponse.json({ error: '처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
