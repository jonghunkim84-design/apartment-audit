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

// ── 정책 한도 (원 단위) ───────────────────────────────────────────────────────

const LIMITS: Record<string, number> = {
  식대: 20_000,        // 제45조: 1인당 20,000원
  식비: 20_000,        // 제45조: 1인당 20,000원
  접대비: 50_000,
  출장비: 100_000,
  출석수당: 50_000,    // 제45조: 1회 한도
  출석수당_월: 200_000, // 제45조: 동일인 월 합산 한도
  DEFAULT: 100_000,
}

// ── 추가 기준 임계값 (원 단위) ────────────────────────────────────────────────

const BID_THRESHOLD = 700_000_000          // 공사·용역 입찰 의무 기준
const RESIDENT_INSPECTION_THRESHOLD = 10_000_000  // 주민검수 대상 기준

function getCategoryLimit(category: string | null): number {
  return LIMITS[category ?? ''] ?? LIMITS.DEFAULT
}

// ── 금지업종 키워드 ───────────────────────────────────────────────────────────

const PROHIBITED_KEYWORDS = ['노래방', '유흥', '룸살롱', '카지노']

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
    // 같은 business_no, 7일 이내, 금액이 카테고리 한도의 80~95%인 건이 3개 이상
    if (receipt.business_number && receipt.receipt_date) {
      const base = new Date(receipt.receipt_date).getTime()
      const from = new Date(base - 7 * 86_400_000).toISOString().slice(0, 10)
      const to   = new Date(base + 7 * 86_400_000).toISOString().slice(0, 10)

      const categoryLimit = getCategoryLimit(receipt.merchant_category)
      const limitLow  = categoryLimit * 0.80
      const limitHigh = categoryLimit * 0.95

      const { data: related } = await supabase
        .from('receipts')
        .select('id, amount, receipt_date')
        .eq('business_number', receipt.business_number)
        .eq('apartment_complex_id', profile.apartment_complex_id)
        .gte('receipt_date', from)
        .lte('receipt_date', to)

      // 한도의 80~95% 범위에 해당하는 건만 카운트 (현재 건 포함)
      const suspiciousCount = (related ?? []).filter(r => {
        const amt = r.amount ?? 0
        return amt >= limitLow && amt <= limitHigh
      }).length

      const isViolation = suspiciousCount >= 3

      checks.push({
        receipt_id: receiptId,
        check_type: 'split_payment',
        is_violation: isViolation,
        details: {
          관련_건수: suspiciousCount,
          조회_기간_일: 7,
          한도: categoryLimit,
          의심_범위: `${limitLow}~${limitHigh}원`,
        } as Json,
      })

      if (isViolation) {
        flags.push({ type: '쪼개기의심', 관련_건수: suspiciousCount })
      }
    }

    // ── 필터 2: 시간대 이상 ───────────────────────────────────────────────────
    // 공휴일 또는 KST 23:00–05:00 거래
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
    // 금지 키워드 포함 시 flags 추가 → FLAGGED
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
    const category = receipt.merchant_category ?? ''
    const amount = receipt.amount ?? 0
    const limitViolations: PolicyFlag[] = []

    // 4-1: 식대/식비 — 1인당 20,000원 초과 (제45조)
    if ((category === '식비' || category === '식대') && amount > LIMITS['식대']) {
      limitViolations.push({
        type: '한도초과', 항목: '식대',
        한도: LIMITS['식대'], 실제금액: amount,
      })
    }

    // 4-2: 접대비 — 건당 50,000원 초과
    if (category === '접대비' && amount > LIMITS['접대비']) {
      limitViolations.push({
        type: '한도초과', 항목: '접대비',
        한도: LIMITS['접대비'], 실제금액: amount,
      })
    }

    // 4-3: 출장비 — 동일 날짜 일당 합산 100,000원 초과
    if (category === '출장비' && receipt.receipt_date) {
      const { data: sameDayTravel } = await supabase
        .from('receipts')
        .select('amount')
        .eq('merchant_category', '출장비')
        .eq('apartment_complex_id', profile.apartment_complex_id)
        .eq('receipt_date', receipt.receipt_date)

      const dailyTotal = (sameDayTravel ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)

      if (dailyTotal > LIMITS['출장비']) {
        limitViolations.push({
          type: '한도초과', 항목: '출장비',
          한도: LIMITS['출장비'], 일당합계: dailyTotal,
        })
      }
    }

    // 4-4: 출석수당 — 1회 50,000원 초과 (제45조)
    if (category === '출석수당' && amount > LIMITS['출석수당']) {
      limitViolations.push({
        type: '수당한도초과', 항목: '출석수당',
        한도: LIMITS['출석수당'], 실제금액: amount,
      })
    }

    // 4-5: 출석수당 — 동일 인물(reviewed_by) 월 합계 200,000원 초과 (제45조)
    if (category === '출석수당' && receipt.receipt_date && receipt.reviewed_by) {
      const monthStart = receipt.receipt_date.slice(0, 7) + '-01'
      const nextMonth  = new Date(monthStart)
      nextMonth.setMonth(nextMonth.getMonth() + 1)
      const monthEnd = new Date(nextMonth.getTime() - 86_400_000).toISOString().slice(0, 10)

      const { data: monthlyAllowances } = await supabase
        .from('receipts')
        .select('amount')
        .eq('merchant_category', '출석수당')
        .eq('apartment_complex_id', profile.apartment_complex_id)
        .eq('reviewed_by', receipt.reviewed_by)
        .gte('receipt_date', monthStart)
        .lte('receipt_date', monthEnd)

      const monthlyTotal = (monthlyAllowances ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)

      if (monthlyTotal > LIMITS['출석수당_월']) {
        limitViolations.push({
          type: '월수당한도초과', 항목: '출석수당',
          한도: LIMITS['출석수당_월'], 월합계: monthlyTotal,
          reviewer_id: receipt.reviewed_by,
        })
      }
    }

    // 사유서 첨부 여부 확인 (review_note에 "사유서" 포함 시 첨부로 간주)
    // 미첨부 시 → FLAGGED
    const isLimitViolation = limitViolations.length > 0
    if (isLimitViolation) {
      const hasSayuseo = (receipt.review_note ?? '').includes('사유서')
      const enrichedFlags = limitViolations.map(f => ({
        ...f,
        사유서첨부: hasSayuseo,
        ...(!hasSayuseo && { 비고: '사유서 미첨부 — 검수 필요' }),
      }))
      flags.push(...enrichedFlags)
    }

    checks.push({
      receipt_id: receiptId,
      check_type: 'limit_exceeded',
      is_violation: isLimitViolation,
      details: {
        카테고리: category,
        금액: amount,
        위반사항: limitViolations,
      } as Json,
    })

    // ── 필터 5: 입찰 의무 위반 ────────────────────────────────────────────────────
    // 공사: 단건 7억 이상 → contracts 입찰 기록 없으면 위반
    // 용역: 동일 사업자 연간 합계 7억 이상 → contracts 입찰 기록 없으면 위반
    if ((category === '공사' || category === '용역') && receipt.business_number) {
      let bidRequired = false
      const bidDetail: Record<string, unknown> = { 입찰의무: true, 카테고리: category }

      if (category === '공사' && amount >= BID_THRESHOLD) {
        bidRequired = true
        bidDetail['사유'] = '공사 단건 금액'
        bidDetail['금액'] = amount
        bidDetail['기준'] = BID_THRESHOLD
      } else if (category === '용역' && receipt.receipt_date) {
        const yearStart = receipt.receipt_date.slice(0, 4) + '-01-01'
        const yearEnd   = receipt.receipt_date.slice(0, 4) + '-12-31'

        const { data: yearlyService } = await supabase
          .from('receipts')
          .select('amount')
          .eq('merchant_category', '용역')
          .eq('apartment_complex_id', profile.apartment_complex_id)
          .eq('business_number', receipt.business_number)
          .gte('receipt_date', yearStart)
          .lte('receipt_date', yearEnd)

        const yearlyTotal = (yearlyService ?? []).reduce((sum, r) => sum + (r.amount ?? 0), 0)
        if (yearlyTotal >= BID_THRESHOLD) {
          bidRequired = true
          bidDetail['사유'] = '용역 연간 합계'
          bidDetail['연간합계'] = yearlyTotal
          bidDetail['기준'] = BID_THRESHOLD
        }
      }

      if (bidRequired) {
        const { data: bidContracts } = await supabase
          .from('contracts')
          .select('id')
          .eq('apartment_complex_id', profile.apartment_complex_id)
          .eq('business_number', receipt.business_number)
          .eq('contract_type', '입찰')
          .limit(1)

        const hasBid = (bidContracts ?? []).length > 0
        bidDetail['입찰기록존재'] = hasBid

        checks.push({
          receipt_id: receiptId,
          check_type: 'limit_exceeded',
          is_violation: !hasBid,
          details: bidDetail as Json,
        })

        if (!hasBid) {
          flags.push({ type: '입찰의무위반', ...bidDetail })
        }
      }
    }

    // ── 필터 6: 주민검수 대상 표시 ────────────────────────────────────────────
    // 유지보수·수선 카테고리, 1,000만원 이상 → 플래그만 추가 (confidence 유지)
    if ((category === '유지보수' || category === '수선') && amount >= RESIDENT_INSPECTION_THRESHOLD) {
      flags.push({
        type: '주민검수대상', 항목: category,
        금액: amount, 기준: RESIDENT_INSPECTION_THRESHOLD,
      })
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
    // flags가 1개라도 있으면 → manual_review (FLAGGED)
    const hasAnyFlag = flags.length > 0
    const newStatus = hasAnyFlag ? ('manual_review' as const) : receipt.status

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
        status: newStatus,
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
