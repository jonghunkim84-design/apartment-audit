import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const ROLES = ['auditor', 'accountant', 'manager', 'external'] as const

async function getAuditorContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, apartment_complex_id')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'auditor') return null
  return { user, complexId: profile.apartment_complex_id }
}

// ── GET: 단지 소속 유저 목록 ──────────────────────────────────────────────────
export async function GET() {
  const ctx = await getAuditorContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()

  // 같은 단지 profiles 조회
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, full_name, role, apartment_complex_id, created_at, email')
    .eq('apartment_complex_id', ctx.complexId ?? '')

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 })

  // auth.admin.listUsers 로 마지막 로그인 + user_metadata 병합
  const { data: { users }, error: uErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 })

  const authMap = new Map(users.map(u => [u.id, u]))

  const result = (profiles ?? []).map(p => {
    const au = authMap.get(p.id)
    return {
      id: p.id,
      email: p.email ?? au?.email ?? '',
      full_name: p.full_name ?? '',
      role: (au?.user_metadata?.role as string) ?? p.role ?? 'viewer',
      created_at: au?.created_at ?? p.created_at,
      last_sign_in_at: au?.last_sign_in_at ?? null,
    }
  })

  return NextResponse.json({ users: result })
}

// ── PATCH: user_metadata.role 업데이트 ───────────────────────────────────────
export async function PATCH(request: NextRequest) {
  const ctx = await getAuditorContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { id, role } = body as { id?: string; role?: string }

  if (!id || !role) return NextResponse.json({ error: 'id, role 필요' }, { status: 400 })
  if (!(ROLES as readonly string[]).includes(role))
    return NextResponse.json({ error: '허용되지 않는 역할' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, {
    user_metadata: { role },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// ── POST: 유저 초대 ───────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const ctx = await getAuditorContext()
  if (!ctx) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { email, role } = body as { email?: string; role?: string }

  if (!email) return NextResponse.json({ error: 'email 필요' }, { status: 400 })
  const assignedRole = (ROLES as readonly string[]).includes(role ?? '') ? role : 'viewer'

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { role: assignedRole },
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
