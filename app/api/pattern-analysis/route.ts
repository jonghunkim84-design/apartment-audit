import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { validateBusinessNumber } from '@/lib/utils/business-number'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ── 상수 ──────────────────────────────────────────────────────────────────────

const SIGMA_NORMAL = 2
const SIGMA_HIGH_RISK = 1.5
const VENDOR_THRESHOLD_NORMAL = 0.3
const VENDOR_THRESHOLD_HIGH_RISK = 0.2

// ACFE 카테고리 → 강화 대상 탐지 종류 매핑
const ACFE_TIGHTENS_TIMESERIES = new Set(['재무제표부정', '자산횡령', '가공거래'])
const ACFE_TIGHTENS_VENDOR     = new Set(['자산횡령', '부패'])

const CATEGORY_LIMITS: Record<string, number> = {
  식대: 30_000,
  식비: 30_000,
  접대비: 50_000,
  출장비: 100_000,
  DEFAULT: 100_000,
}

function getCategoryLimit(category: string | null): number {
  return CATEGORY_LIMITS[category ?? ''] ?? CATEGORY_LIMITS.DEFAULT
}

const ENTERTAINMENT_KEYWORDS = ['노래방', '유흥', '룸살롱', '카지노']

// Benford's Law: p(d) = log10(1 + 1/d)
const BENFORD_PROBS: Record<number, number> = Object.fromEntries(
  Array.from({ length: 9 }, (_, i) => [i + 1, Math.log10(1 + 1 / (i + 1))])
)

// χ² 임계값: df=8, p=0.05
const CHI_SQ_CRITICAL = 15.507
const CHI_SQ_P01 = 20.090
const CHI_SQ_P001 = 26.125

// ── 타입 ──────────────────────────────────────────────────────────────────────

type ReceiptRow = {
  id: string
  amount: number
  receipt_date: string | null
  merchant_name: string | null
  merchant_category: string | null
  business_number: string | null
  reviewed_by: string | null
  status: string
  created_at: string
}

type AcfeCategory = '자산횡령' | '부패' | '재무제표부정' | '가공거래' | '김영란법위반'
type FindingSeverity = 'low' | 'medium' | 'high' | 'critical'

interface PatternFinding {
  title: string
  description: string
  severity: FindingSeverity
  acfeCategory: AcfeCategory
  affectedReceiptIds: string[]
  details: Record<string, unknown>
}

// ── 수학 헬퍼 ─────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
}

function stdDev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  void request

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

    const complexId = profile.apartment_complex_id

    // ── 0. 외부감사 리스크 가중치 집계 ───────────────────────────────────────────
    // 최근 2개년 외부감사 지적사항(source='external')에서 ACFE 카테고리 빈도 산출
    const cutoffYear = new Date().getFullYear() - 2
    const acfeFreq = new Map<string, number>()

    const { data: extAuditRows } = await supabase
      .from('external_audits')
      .select('id')
      .eq('complex_id', complexId)
      .gte('audit_year', cutoffYear)

    const extAuditIds = (extAuditRows ?? []).map(a => a.id)

    if (extAuditIds.length > 0) {
      const { data: extFindings } = await supabase
        .from('audit_findings')
        .select('description')
        .eq('source', 'external')
        .in('external_audit_id', extAuditIds)
        .not('description', 'is', null)

      for (const f of extFindings ?? []) {
        const cat = f.description?.match(/ACFE:\s*([^\]]+)/)?.[1]?.trim()
        if (cat) acfeFreq.set(cat, (acfeFreq.get(cat) ?? 0) + 1)
      }
    }

    // Top 3 ACFE 카테고리
    const topRiskAcfe = Array.from(acfeFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    const riskAcfeSet = new Set(topRiskAcfe.map(([cat]) => cat))

    const sigmaMultiplier     = [...riskAcfeSet].some(c => ACFE_TIGHTENS_TIMESERIES.has(c)) ? SIGMA_HIGH_RISK      : SIGMA_NORMAL
    const vendorThreshold     = [...riskAcfeSet].some(c => ACFE_TIGHTENS_VENDOR.has(c))     ? VENDOR_THRESHOLD_HIGH_RISK : VENDOR_THRESHOLD_NORMAL
    const riskWeightingApplied = topRiskAcfe.length > 0

    const { data: rawReceipts, error: fetchError } = await supabase
      .from('receipts')
      .select('id, amount, receipt_date, merchant_name, merchant_category, business_number, reviewed_by, status, created_at')
      .eq('apartment_complex_id', complexId)
      .not('amount', 'is', null)
      .order('receipt_date', { ascending: true })

    if (fetchError) throw fetchError

    const rows = (rawReceipts ?? []).filter(r => r.amount != null) as ReceiptRow[]

    if (rows.length < 10) {
      return NextResponse.json(
        { message: '데이터 부족: 최소 10건 이상의 영수증이 필요합니다.', totalReceipts: rows.length },
        { status: 422 }
      )
    }

    const findings: PatternFinding[] = []

    // ── 1. 시계열 이상 탐지 ──────────────────────────────────────────────────────
    // 일별·월별 지출 합산 → 평균 ±2σ 초과 시 [시계열이상]
    {
      const dailyMap = new Map<string, { total: number; ids: string[] }>()
      const monthlyMap = new Map<string, { total: number; ids: string[] }>()
      const dowTotals: Record<number, number> = {}

      for (const r of rows) {
        const date = r.receipt_date ?? r.created_at.slice(0, 10)
        const ym = date.slice(0, 7)
        const dow = new Date(date).getUTCDay()

        const daily = dailyMap.get(date) ?? { total: 0, ids: [] }
        daily.total += r.amount; daily.ids.push(r.id)
        dailyMap.set(date, daily)

        const monthly = monthlyMap.get(ym) ?? { total: 0, ids: [] }
        monthly.total += r.amount; monthly.ids.push(r.id)
        monthlyMap.set(ym, monthly)

        dowTotals[dow] = (dowTotals[dow] ?? 0) + r.amount
      }

      const dailyVals = Array.from(dailyMap.values()).map(v => v.total)
      const avgD = avg(dailyVals); const stdD = stdDev(dailyVals, avgD)
      const threshD = avgD + sigmaMultiplier * stdD

      const monthlyVals = Array.from(monthlyMap.values()).map(v => v.total)
      const avgM = avg(monthlyVals); const stdM = stdDev(monthlyVals, avgM)
      const threshM = avgM + sigmaMultiplier * stdM

      const anomalousDates = Array.from(dailyMap.entries())
        .filter(([, v]) => v.total > threshD)
        .map(([date, v]) => ({ date, total: v.total, ids: v.ids }))

      const anomalousMonths = Array.from(monthlyMap.entries())
        .filter(([, v]) => v.total > threshM)
        .map(([ym, v]) => ({ ym, total: v.total, ids: v.ids }))

      if (anomalousDates.length > 0 || anomalousMonths.length > 0) {
        const affectedIds = [
          ...new Set([
            ...anomalousDates.flatMap(d => d.ids),
            ...anomalousMonths.flatMap(m => m.ids),
          ]),
        ]
        const parts: string[] = []
        if (riskWeightingApplied)
          parts.push(`[외부감사가중치적용 ±${sigmaMultiplier}σ — ${topRiskAcfe.map(([c, n]) => `${c}:${n}건`).join(', ')}]`)
        if (anomalousDates.length > 0)
          parts.push(`이상 일자 ${anomalousDates.length}건 (임계: ${Math.round(threshD).toLocaleString()}원): ${anomalousDates.map(d => d.date).join(', ')}`)
        if (anomalousMonths.length > 0)
          parts.push(`이상 월 ${anomalousMonths.length}건 (임계: ${Math.round(threshM).toLocaleString()}원): ${anomalousMonths.map(m => m.ym).join(', ')}`)

        findings.push({
          title: '[시계열이상] 비정상적 지출 급증 탐지',
          description: parts.join(' | '),
          severity: 'medium',
          acfeCategory: '재무제표부정',
          affectedReceiptIds: affectedIds,
          details: {
            daily: { avg: Math.round(avgD), std: Math.round(stdD), threshold: Math.round(threshD), anomalous: anomalousDates.map(d => ({ date: d.date, total: d.total })) },
            monthly: { avg: Math.round(avgM), std: Math.round(stdM), threshold: Math.round(threshM), anomalous: anomalousMonths.map(m => ({ ym: m.ym, total: m.total })) },
            dowTotals: Object.fromEntries(
              Object.entries(dowTotals).map(([d, t]) => [['일', '월', '화', '수', '목', '금', '토'][Number(d)], t])
            ),
          },
        })
      }
    }

    // ── 2. 거래처 집중도 분석 ────────────────────────────────────────────────────
    // 단일 거래처가 전체의 30% 초과 시 [거래처집중위험]
    {
      const vendorMap = new Map<string, { total: number; name: string; ids: string[] }>()
      let grandTotal = 0
      for (const r of rows) {
        const key = r.business_number ?? r.merchant_name ?? '(미상)'
        const entry = vendorMap.get(key) ?? { total: 0, name: r.merchant_name ?? key, ids: [] }
        entry.total += r.amount; entry.ids.push(r.id)
        vendorMap.set(key, entry)
        grandTotal += r.amount
      }

      for (const [key, { total, name, ids }] of vendorMap) {
        const ratio = grandTotal > 0 ? total / grandTotal : 0
        if (ratio > vendorThreshold) {
          const weightNote = riskWeightingApplied && vendorThreshold < VENDOR_THRESHOLD_NORMAL
            ? ` [외부감사가중치적용 임계값 ${Math.round(vendorThreshold * 100)}%]` : ''
          findings.push({
            title: `[거래처집중위험] ${name} 단일 거래처 ${Math.round(ratio * 100)}% 집중`,
            description: `사업자번호/거래처 ${key}(${name})의 거래액(${total.toLocaleString()}원)이 전체(${grandTotal.toLocaleString()}원)의 ${Math.round(ratio * 100)}%를 차지합니다. 수의계약 반복 또는 특혜 발주 여부를 검토하십시오.${weightNote}`,
            severity: 'high',
            acfeCategory: '자산횡령',
            affectedReceiptIds: ids,
            details: { vendor: key, merchantName: name, total, grandTotal, ratio: Math.round(ratio * 100) },
          })
        }
      }
    }

    // ── 3. 한도 직전 금액 다발 탐지 ──────────────────────────────────────────────
    // 카테고리 한도의 80~95% 금액이 동일 거래처에서 7일 내 3건 이상 → [쪼개기의심]
    {
      const candidateMap = new Map<string, { receipts: Array<{ id: string; amount: number; date: Date }>; limit: number }>()

      for (const r of rows) {
        if (!r.business_number || !r.receipt_date) continue
        const limit = getCategoryLimit(r.merchant_category)
        if (r.amount < limit * 0.8 || r.amount > limit * 0.95) continue

        const entry = candidateMap.get(r.business_number) ?? { receipts: [], limit }
        entry.receipts.push({ id: r.id, amount: r.amount, date: new Date(r.receipt_date) })
        candidateMap.set(r.business_number, entry)
      }

      for (const [bno, { receipts: candidates, limit }] of candidateMap) {
        candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
        let left = 0
        for (let right = 2; right < candidates.length; right++) {
          while (candidates[right].date.getTime() - candidates[left].date.getTime() > 7 * 86_400_000) left++
          if (right - left + 1 >= 3) {
            const window = candidates.slice(left, right + 1)
            findings.push({
              title: `[쪼개기의심] 사업자 ${bno} — 7일 내 한도직전 ${window.length}건`,
              description: `사업자번호 ${bno}: ${window.length}건이 7일 이내에 카테고리 한도(${limit.toLocaleString()}원)의 80~95%(${Math.round(limit * 0.8).toLocaleString()}~${Math.round(limit * 0.95).toLocaleString()}원) 금액으로 반복 집행. 예산 한도 회피를 위한 고의 분할 가능성이 있습니다.`,
              severity: 'medium',
              acfeCategory: '자산횡령',
              affectedReceiptIds: window.map(c => c.id),
              details: {
                businessNumber: bno,
                categoryLimit: limit,
                receipts: window.map(c => ({ date: c.date.toISOString().slice(0, 10), amount: c.amount })),
              },
            })
            break
          }
        }
      }
    }

    // ── 4. 반복 승인 패턴 ────────────────────────────────────────────────────────
    // 동일 (reviewed_by + business_no + amount) 조합이 월 3회 이상 → [반복승인패턴]
    {
      const approvalMap = new Map<string, { count: number; ids: string[] }>()
      for (const r of rows) {
        if (!r.reviewed_by || !r.business_number) continue
        const ym = (r.receipt_date ?? r.created_at).slice(0, 7)
        const key = `${r.reviewed_by}||${r.business_number}||${r.amount}||${ym}`
        const entry = approvalMap.get(key) ?? { count: 0, ids: [] }
        entry.count++; entry.ids.push(r.id)
        approvalMap.set(key, entry)
      }

      for (const [key, { count, ids }] of approvalMap) {
        if (count >= 3) {
          const [, bno, amountStr, ym] = key.split('||')
          findings.push({
            title: `[반복승인패턴] ${ym} 동일 조합 월 ${count}회 반복 승인`,
            description: `${ym}: 사업자 ${bno} / 금액 ${parseInt(amountStr).toLocaleString()}원 조합이 동일 검수자에 의해 ${count}회 승인되었습니다. 내부 공모 또는 허위 청구 가능성을 검토하십시오.`,
            severity: 'high',
            acfeCategory: '부패',
            affectedReceiptIds: ids,
            details: { businessNumber: bno, amount: parseInt(amountStr), yearMonth: ym, count },
          })
        }
      }
    }

    // ── 5. Benford's Law 검증 ─────────────────────────────────────────────────────
    // 전체 금액 첫 자릿수 분포 카이제곱 검정: p < 0.05 시 [벤포드법칙위반]
    const digitCounts: Record<number, number> = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i + 1, 0])
    )
    let validN = 0
    for (const r of rows) {
      const d = parseInt(String(Math.abs(r.amount))[0])
      if (d >= 1 && d <= 9) { digitCounts[d]++; validN++ }
    }

    let chiSquare = 0
    const benfordDist: Record<number, { observed: number; expected: number; observedPct: number; expectedPct: number }> = {}
    for (let d = 1; d <= 9; d++) {
      const obs = digitCounts[d]
      const exp = validN * BENFORD_PROBS[d]
      chiSquare += exp > 0 ? (obs - exp) ** 2 / exp : 0
      benfordDist[d] = {
        observed: obs,
        expected: Math.round(exp * 10) / 10,
        observedPct: Math.round((obs / validN) * 1000) / 10,
        expectedPct: Math.round(BENFORD_PROBS[d] * 1000) / 10,
      }
    }
    chiSquare = Math.round(chiSquare * 100) / 100

    const benfordViolation = chiSquare > CHI_SQ_CRITICAL && validN >= 30
    if (benfordViolation) {
      const pLabel = chiSquare > CHI_SQ_P001 ? 'p<0.001' : chiSquare > CHI_SQ_P01 ? 'p<0.01' : 'p<0.05'
      findings.push({
        title: `[벤포드법칙위반] 금액 첫 자릿수 이상 (χ²=${chiSquare}, ${pLabel})`,
        description: `${validN}건 금액의 Benford's Law 검정: χ²=${chiSquare} > 임계값 ${CHI_SQ_CRITICAL}(df=8). 자연 발생 분포에서 벗어난 금액 패턴이 감지되었습니다. 의도적 금액 조작 또는 허위 영수증을 의심하십시오.`,
        severity: 'high',
        acfeCategory: '재무제표부정',
        affectedReceiptIds: [],
        details: { chiSquare, criticalValue: CHI_SQ_CRITICAL, n: validN, distribution: benfordDist },
      })
    }

    // ── 6. 한국 특화 패턴 ────────────────────────────────────────────────────────

    // 6a. 유흥반복: 금지업종 동일 거래처 3회 이상
    {
      const entertainMap = new Map<string, { count: number; ids: string[]; name: string }>()
      for (const r of rows) {
        const name = r.merchant_name ?? ''
        if (!ENTERTAINMENT_KEYWORDS.some(k => name.includes(k))) continue
        const key = r.business_number ?? name
        const entry = entertainMap.get(key) ?? { count: 0, ids: [], name }
        entry.count++; entry.ids.push(r.id)
        entertainMap.set(key, entry)
      }
      for (const [key, { count, ids, name }] of entertainMap) {
        if (count >= 3) {
          findings.push({
            title: `[유흥반복] ${name} 유흥업소 ${count}회 반복 결제`,
            description: `유흥·향락업소 ${name}(${key})에서 ${count}회 반복 결제 감지. 업무추진비 부당 집행 및 청탁금지법(김영란법) 위반 가능성이 있습니다.`,
            severity: 'high',
            acfeCategory: '김영란법위반',
            affectedReceiptIds: ids,
            details: { vendor: key, merchantName: name, count },
          })
        }
      }
    }

    // 6b. 심야주말과다: 주말·KST 23:00~05:00 결제가 20% 초과
    {
      let offHourCount = 0
      for (const r of rows) {
        const baseDate = new Date(r.receipt_date ?? r.created_at)
        const dow = baseDate.getUTCDay() // 0=일, 6=토
        const kstH = new Date(new Date(r.created_at).getTime() + 9 * 3_600_000).getUTCHours()
        if (dow === 0 || dow === 6 || kstH >= 23 || kstH < 5) offHourCount++
      }
      const rate = rows.length > 0 ? offHourCount / rows.length : 0
      if (rate > 0.2) {
        findings.push({
          title: `[심야주말과다] 주말·심야 결제 ${Math.round(rate * 100)}% (기준 20% 초과)`,
          description: `전체 ${rows.length}건 중 ${offHourCount}건(${Math.round(rate * 100)}%)이 주말 또는 심야(KST 23:00~05:00)에 발생. 업무 외 집행 또는 김영란법 위반 가능성이 있습니다.`,
          severity: 'medium',
          acfeCategory: '김영란법위반',
          affectedReceiptIds: [],
          details: { total: rows.length, offHourCount, rate: Math.round(rate * 100) },
        })
      }
    }

    // 6c. 가공거래의심: 사업자번호 체크섬 오류
    {
      const bnoValidity = new Map<string, boolean>()
      const invalidList: Array<{ id: string; bno: string; name: string }> = []

      for (const r of rows) {
        if (!r.business_number) continue
        const bno = r.business_number
        if (!bnoValidity.has(bno)) {
          bnoValidity.set(bno, validateBusinessNumber(bno))
        }
        if (!bnoValidity.get(bno)) {
          invalidList.push({ id: r.id, bno, name: r.merchant_name ?? '' })
        }
      }

      if (invalidList.length > 0) {
        const uniqueVendors = [...new Map(invalidList.map(i => [i.bno, i])).values()]
        findings.push({
          title: `[가공거래의심] 체크섬 오류 사업자번호 ${uniqueVendors.length}종 (${invalidList.length}건)`,
          description: `유효하지 않은 사업자번호 ${uniqueVendors.length}종 탐지: ${uniqueVendors.map(i => `${i.bno}(${i.name})`).join(', ')}. 국세청 미등록 가공 거래처로 허위 영수증 위험이 높습니다.`,
          severity: 'critical',
          acfeCategory: '가공거래',
          affectedReceiptIds: invalidList.map(i => i.id),
          details: { invalidVendors: uniqueVendors.map(i => ({ bno: i.bno, merchantName: i.name })) },
        })
      }
    }

    // ── ACFE Fraud Tree 분류 ──────────────────────────────────────────────────────
    const acfeMap: Record<AcfeCategory, PatternFinding[]> = {
      '자산횡령': [],
      '부패': [],
      '재무제표부정': [],
      '가공거래': [],
      '김영란법위반': [],
    }
    for (const f of findings) acfeMap[f.acfeCategory].push(f)

    // ── audit_findings 등록 ──────────────────────────────────────────────────────
    let insertedCount = 0
    if (findings.length > 0) {
      const toInsert = findings.map(f => ({
        apartment_complex_id: complexId,
        created_by: user.id,
        title: f.title,
        description: `[P4 자동탐지 · ACFE: ${f.acfeCategory}] ${f.description}`,
        severity: f.severity,
        status: 'open',
        receipt_id: f.affectedReceiptIds[0] ?? null,
      }))
      const { data: inserted, error: insertError } = await supabase
        .from('audit_findings')
        .insert(toInsert)
        .select('id')
      if (insertError) console.error('[pattern-analysis] findings insert error:', insertError)
      else insertedCount = inserted?.length ?? 0
    }

    // ── anomaly_detections 등록 (Benford's) ──────────────────────────────────────
    if (benfordViolation) {
      const bfSeverity: 'low' | 'medium' | 'high' =
        chiSquare > CHI_SQ_P001 ? 'high' : chiSquare > CHI_SQ_P01 ? 'medium' : 'low'
      const { error: anomalyError } = await supabase.from('anomaly_detections').insert({
        apartment_complex_id: complexId,
        detection_type: 'benfords_law',
        detection_date: new Date().toISOString().slice(0, 10),
        severity: bfSeverity,
        status: 'open',
        description: `Benford's Law χ²=${chiSquare}, n=${validN}`,
        details: { chiSquare, n: validN, distribution: benfordDist },
        affected_receipt_ids: [],
      })
      if (anomalyError) console.error('[pattern-analysis] anomaly_detections insert error:', anomalyError)
    }

    // ── 응답 ─────────────────────────────────────────────────────────────────────
    return NextResponse.json({
      summary: {
        totalReceipts: rows.length,
        analyzedAt: new Date().toISOString(),
        findingsCount: findings.length,
        findingsCreated: insertedCount,
      },
      externalAuditRiskWeighting: {
        applied: riskWeightingApplied,
        cutoffYear,
        topRiskCategories: topRiskAcfe.map(([category, citedCount]) => ({
          category,
          citedCount,
          reason: `최근 2개년(${cutoffYear}년 이후) 외부감사에서 ${citedCount}건 지적`,
        })),
        adjustments: riskWeightingApplied ? [
          ...(sigmaMultiplier < SIGMA_NORMAL ? [{
            target: '시계열 이상탐지 (섹션 1)',
            before: `±${SIGMA_NORMAL}σ`,
            after: `±${sigmaMultiplier}σ`,
            reason: `${topRiskAcfe.filter(([c]) => ACFE_TIGHTENS_TIMESERIES.has(c)).map(([c]) => c).join(', ')} 카테고리 중점 지적`,
          }] : []),
          ...(vendorThreshold < VENDOR_THRESHOLD_NORMAL ? [{
            target: '거래처 집중도 (섹션 2)',
            before: `${Math.round(VENDOR_THRESHOLD_NORMAL * 100)}%`,
            after: `${Math.round(vendorThreshold * 100)}%`,
            reason: `${topRiskAcfe.filter(([c]) => ACFE_TIGHTENS_VENDOR.has(c)).map(([c]) => c).join(', ')} 카테고리 중점 지적`,
          }] : []),
        ] : [],
        message: riskWeightingApplied
          ? `외부감사 중점 리스크 반영: ${topRiskAcfe.map(([c, n]) => `${c}(${n}건)`).join(', ')} → 탐지 임계값 강화`
          : `최근 ${cutoffYear}년 이후 외부감사 지적사항 없음 — 기본 임계값(±${SIGMA_NORMAL}σ, 집중도 ${Math.round(VENDOR_THRESHOLD_NORMAL * 100)}%) 적용`,
      },
      benfordsLaw: {
        chiSquare,
        criticalValue: CHI_SQ_CRITICAL,
        violated: benfordViolation,
        n: validN,
        distribution: benfordDist,
      },
      acfeCategories: Object.fromEntries(
        (Object.entries(acfeMap) as [AcfeCategory, PatternFinding[]][]).map(([cat, catFindings]) => [
          cat,
          catFindings.map(f => ({
            title: f.title,
            severity: f.severity,
            affectedCount: f.affectedReceiptIds.length,
            details: f.details,
          })),
        ])
      ),
      findings: findings.map(f => ({
        title: f.title,
        severity: f.severity,
        acfeCategory: f.acfeCategory,
        affectedCount: f.affectedReceiptIds.length,
      })),
    })
  } catch (err) {
    console.error('[pattern-analysis]', err)
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
