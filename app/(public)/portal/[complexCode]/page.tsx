import { createPublicClient } from '@/lib/supabase/public'
import { notFound } from 'next/navigation'
import { PortalClient } from '@/components/portal/PortalClient'
import { MapPin, Home } from 'lucide-react'

export default async function PublicPortalPage({
  params,
}: {
  params: Promise<{ complexCode: string }>
}) {
  const { complexCode } = await params
  const supabase = createPublicClient()

  const { data: complex } = await supabase
    .from('apartment_complexes')
    .select('id, name, address, unit_count')
    .eq('public_code', complexCode)
    .single()

  if (!complex) notFound()

  const { data: disclosures } = await supabase
    .from('public_disclosures')
    .select('id, disclosure_type, period, title, data, approved_at, kapt_match, report_pdf_url')
    .eq('apartment_complex_id', complex.id)
    .eq('is_active', true)
    .order('period', { ascending: false })

  return (
    <div className="space-y-8">
      {/* 단지 헤더 */}
      <div className="bg-white rounded-2xl shadow-sm px-6 py-5 border border-slate-100">
        <h1 className="text-2xl font-bold text-slate-900">{complex.name}</h1>
        <div className="flex flex-wrap gap-4 mt-2">
          {complex.address && (
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              {complex.address}
            </span>
          )}
          {complex.unit_count && (
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <Home className="h-3.5 w-3.5" />
              총 {complex.unit_count.toLocaleString()}세대
            </span>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-3">
          최근 업데이트: {disclosures?.[0]
            ? new Date(disclosures[0].approved_at).toLocaleDateString('ko-KR')
            : '—'}
        </p>
      </div>

      {disclosures && disclosures.length > 0 ? (
        <PortalClient disclosures={disclosures as Parameters<typeof PortalClient>[0]['disclosures']} />
      ) : (
        <div className="bg-white rounded-2xl shadow-sm px-6 py-16 text-center border border-slate-100">
          <p className="text-slate-400 text-sm">아직 공개된 정보가 없습니다.</p>
          <p className="text-slate-300 text-xs mt-1">관리사무소에 문의하세요.</p>
        </div>
      )}
    </div>
  )
}
