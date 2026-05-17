import { createClient } from '@/lib/supabase/server'
import { getDisclosures, getAvailablePeriods } from '@/lib/actions/disclosure'
import { DisclosureClient } from '@/components/disclosure/DisclosureClient'
import { Globe } from 'lucide-react'

export default async function DisclosurePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('apartment_complex_id, apartment_complexes(name, public_code)')
    .eq('id', user!.id)
    .single()

  const complexName =
    profile?.apartment_complexes && typeof profile.apartment_complexes === 'object' && 'name' in profile.apartment_complexes
      ? (profile.apartment_complexes as { name: string; public_code: string | null }).name
      : '단지'

  const publicCode =
    profile?.apartment_complexes && typeof profile.apartment_complexes === 'object' && 'public_code' in profile.apartment_complexes
      ? (profile.apartment_complexes as { name: string; public_code: string | null }).public_code
      : null

  const [disclosures, periods] = await Promise.all([
    getDisclosures(),
    getAvailablePeriods(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          <Globe className="h-4 w-4" />
          <span className="text-xs">공개 포털 관리</span>
        </div>
        <h1 className="text-2xl font-bold">입주민 공개 포털 관리</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {complexName} · 공동주택관리법 제26조에 따른 관리비 및 감사 결과 공개
        </p>
      </div>

      <DisclosureClient
        availablePeriods={periods as Record<string, string[]>}
        disclosures={disclosures}
        publicCode={publicCode}
      />
    </div>
  )
}
