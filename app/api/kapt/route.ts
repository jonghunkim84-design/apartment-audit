import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const CATEGORY_MAP: Record<string, string> = {
  general_manage: '일반관리비',
  security:       '경비비',
  cleaning:       '청소비',
  repair:         '수선유지비',
  elevator:       '승강기유지비',
  other:          '기타관리비',
}

const BASE_FEE_URL = 'https://apis.data.go.kr/1613000/AptCmnuseManageCostServiceV2'

// 신규 공용관리비 API (AptCmnuseManageCostServiceV2) 엔드포인트 매핑
const KAPT_FEE_ENDPOINTS: Record<string, string> = {
  general_manage: 'getHsmpConsignManageFeeInfoV2',
  security:       'getHsmpGuardCostInfoV2',
  cleaning:       'getHsmpCleaningCostInfoV2',
  repair:         'getHsmpRepairsCostInfoV2',
  elevator:       'getHsmpElevatorMntncCostInfoV2',
  other:          'getHsmpEtcCostInfoV2',
}

// ── GET — return latest kapt_comparison rows for the current complex ──────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return NextResponse.json({ error: 'No complex' }, { status: 400 })

  const { data, error } = await supabase
    .from('kapt_comparison')
    .select('*')
    .eq('apartment_complex_id', profile.apartment_complex_id)
    .order('year_month', { ascending: false })
    .limit(60)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// ── POST — fetch K-apt API, compute peer avg, upsert kapt_comparison ─────────

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id')
    .eq('id', user.id)
    .single()
  if (!profile?.apartment_complex_id) return NextResponse.json({ error: 'No complex' }, { status: 400 })

  const complexId = profile.apartment_complex_id

  const { data: complex } = await supabase
    .from('apartment_complexes')
    .select('kapt_code, region_code, unit_count, name')
    .eq('id', complexId)
    .single()

  if (!complex?.kapt_code || !complex?.region_code) {
    return NextResponse.json({
      error: 'K-apt 코드 또는 지역 코드가 설정되지 않았습니다. 단지 설정에서 kapt_code와 region_code를 입력하세요.',
    }, { status: 400 })
  }

  const apiKey = process.env.KAPT_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'KAPT_API_KEY 환경변수가 없습니다.' }, { status: 500 })

  const now = new Date()
  const ourUnits = complex.unit_count ?? 0

  // K-apt 데이터는 실제로 약 12개월 지연 공개됨 — 12개월 전부터 스캔하여 최신 가용 월 탐색
  async function fetchFeeForKapt(kaptCode: string, endpoint: string, searchDate: string): Promise<number> {
    const url = new URL(`${BASE_FEE_URL}/${endpoint}`)
    url.searchParams.set('serviceKey', apiKey!)
    url.searchParams.set('kaptCode', kaptCode)
    url.searchParams.set('searchDate', searchDate)
    url.searchParams.set('numOfRows', '1')
    url.searchParams.set('pageNo', '1')
    try {
      const r = await fetch(url.toString())
      if (!r.ok) return 0
      const j = await r.json()
      const item = j?.response?.body?.item
      if (!item) return 0
      const numVal = Object.values(item).find(v => typeof v === 'number' && (v as number) > 0)
      return numVal ? Math.round(numVal as number) : 0
    } catch {
      return 0
    }
  }

  // 최신 가용 searchDate 탐색 (12~18개월 전부터 시도)
  let searchDate = ''
  let yearMonth = ''
  for (let mo = 12; mo <= 18; mo++) {
    const d = new Date(now.getFullYear(), now.getMonth() - mo, 1)
    const sd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`
    const testAmt = await fetchFeeForKapt(complex.kapt_code!, 'getHsmpGuardCostInfoV2', sd)
    if (testAmt > 0) {
      searchDate = sd
      yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      break
    }
  }
  if (!searchDate) {
    return NextResponse.json({ error: 'K-apt 이용 가능한 관리비 데이터가 없습니다.' }, { status: 404 })
  }

  // 1. 유사단지 목록 조회 (신규: AptListService3/getLegaldongAptList3)
  const listUrl = new URL('https://apis.data.go.kr/1613000/AptListService3/getLegaldongAptList3')
  listUrl.searchParams.set('serviceKey', apiKey)
  listUrl.searchParams.set('bjdCode', complex.region_code)
  listUrl.searchParams.set('numOfRows', '100')
  listUrl.searchParams.set('pageNo', '1')

  const listRes = await fetch(listUrl.toString())
  if (!listRes.ok) return NextResponse.json({ error: `K-apt 단지목록 API 오류: ${listRes.status}` }, { status: 502 })
  const listJson = await listRes.json()
  const aptList: Record<string, string>[] = listJson?.response?.body?.items ?? []
  const aptArr = Array.isArray(aptList) ? aptList : [aptList]

  // 세대수 정보가 목록 API에 없으므로 우리 단지 제외 후 전체 포함
  const similarCodes = aptArr
    .filter(a => a.kaptCode !== complex.kapt_code)
    .map(a => a.kaptCode)
    .filter(Boolean)
    .slice(0, 15) // cap peer set (API 호출 수 제한)

  // 유사단지 세대수 조회 (AptBasisInfoServiceV4) — 원/세대 정규화에 필요
  const peerUnitCounts = Object.fromEntries(
    await Promise.all(
      similarCodes.map(async code => {
        try {
          const u = new URL('https://apis.data.go.kr/1613000/AptBasisInfoServiceV4/getAphusBassInfoV4')
          u.searchParams.set('serviceKey', apiKey!)
          u.searchParams.set('kaptCode', code)
          u.searchParams.set('numOfRows', '1')
          u.searchParams.set('pageNo', '1')
          const r = await fetch(u.toString())
          if (!r.ok) return [code, ourUnits] as [string, number]
          const j = await r.json()
          const item = j?.response?.body?.item
          const cnt = Array.isArray(item) ? item[0]?.kaptdaCnt : item?.kaptdaCnt
          return [code, typeof cnt === 'number' && cnt > 0 ? cnt : ourUnits] as [string, number]
        } catch {
          return [code, ourUnits] as [string, number]
        }
      })
    )
  )

  // 2. 카테고리별 우리 단지 + 유사단지 관리비 조회
  const upserts = await Promise.all(
    Object.entries(KAPT_FEE_ENDPOINTS).map(async ([catKey, endpoint]) => {
      // 우리 단지 — 총액을 세대수로 나눠 원/세대 환산
      const ourTotal = await fetchFeeForKapt(complex.kapt_code!, endpoint, searchDate)
      const ourAmt = ourUnits > 0 && ourTotal > 0 ? Math.round(ourTotal / ourUnits) : 0

      // 유사단지 평균 — 각 단지의 실제 세대수로 정규화
      const peerAmts = (await Promise.all(
        similarCodes.map(async code => {
          const total = await fetchFeeForKapt(code, endpoint, searchDate)
          const units = peerUnitCounts[code] ?? ourUnits
          return units > 0 && total > 0 ? Math.round(total / units) : 0
        })
      )).filter(v => v > 0)

      const avgAmt = peerAmts.length > 0
        ? Math.round(peerAmts.reduce((s, v) => s + v, 0) / peerAmts.length)
        : 0

      return {
        apartment_complex_id: complexId,
        year_month:  yearMonth,
        category:    catKey,
        our_amount:  ourAmt,
        avg_amount:  avgAmt,
        sample_count: peerAmts.length,
        updated_at:  new Date().toISOString(),
      }
    })
  )

  const { error: upsertErr } = await supabase
    .from('kapt_comparison')
    .upsert(upserts, { onConflict: 'apartment_complex_id,year_month,category' })

  if (upsertErr) return NextResponse.json({ error: upsertErr.message }, { status: 500 })

  // 130% 초과 항목 → audit_findings 등록
  const exceeded = upserts.filter(u => u.avg_amount > 0 && u.our_amount > u.avg_amount * 1.3)
  if (exceeded.length > 0) {
    const findings = exceeded.map(u => ({
      apartment_complex_id: complexId,
      title: `[K-apt] ${CATEGORY_MAP[u.category]} 평균 130% 초과`,
      description: `[평균초과] ${yearMonth} 기준 ${CATEGORY_MAP[u.category]}: 우리 단지 ${u.our_amount.toLocaleString()}원/세대, 유사단지 평균 ${u.avg_amount.toLocaleString()}원/세대 (${Math.round(u.our_amount / u.avg_amount * 100)}%)`,
      severity: 'medium',
      status: 'open',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))
    await supabase.from('audit_findings').insert(findings)
  }

  return NextResponse.json({
    summary: {
      yearMonth,
      categoriesUpdated: upserts.length,
      peerCount: similarCodes.length,
      exceededCategories: exceeded.map(u => CATEGORY_MAP[u.category]),
    },
  })
}
