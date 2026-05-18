import { createClient } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export type NotificationSeverity = 'INFO' | 'WARNING' | 'CRITICAL'

export interface CreateNotificationPayload {
  complexId: string
  actorUserId: string
  title: string
  message: string
  severity: NotificationSeverity
  category?: string
  referenceId?: string
  /** 지정 시 해당 역할만 수신. 미지정 시 기존 로직(auditor 전체 + CRITICAL→admin) */
  targetRoles?: string[]
}

export async function createNotificationsForComplex(
  payload: CreateNotificationPayload,
  supabaseClient?: SupabaseClient<Database>,
): Promise<void> {
  const supabase = supabaseClient ?? await createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, role, email')
    .eq('apartment_complex_id', payload.complexId)

  if (!profiles?.length) return

  const eligible = profiles.filter((p) => {
    if (payload.targetRoles?.length) {
      return payload.targetRoles.includes(p.role ?? '')
    }
    if (p.role === 'auditor') return true
    if (p.role === 'admin') return payload.severity === 'CRITICAL'
    // viewer: only if they triggered the action
    return p.id === payload.actorUserId
  })

  if (!eligible.length) return

  type InsertRow = {
    apartment_complex_id: string
    user_id: string
    title: string
    message: string
    severity: NotificationSeverity
    category: string | null
    reference_id: string | null
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const rows: InsertRow[] = []
  const emailTargets: string[] = []

  for (const profile of eligible) {
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('title', payload.title)
      .gte('created_at', oneHourAgo)

    if ((count ?? 0) > 0) continue

    rows.push({
      apartment_complex_id: payload.complexId,
      user_id: profile.id,
      title: payload.title,
      message: payload.message,
      severity: payload.severity,
      category: payload.category ?? null,
      reference_id: payload.referenceId ?? null,
    })

    if (payload.severity === 'CRITICAL' && profile.email) {
      emailTargets.push(profile.email)
    }
  }

  if (!rows.length) return

  await supabase.from('notifications').insert(rows)

  if (emailTargets.length) {
    await sendCriticalEmails(emailTargets, payload.title, payload.message)
  }
}

async function sendCriticalEmails(emails: string[], title: string, message: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return

  for (const to of emails) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'noreply@apartment-audit.kr',
          to,
          subject: `[긴급] ${title}`,
          html: `<h2 style="color:#dc2626">[CRITICAL] ${title}</h2><p>${message}</p><hr/><p style="color:#6b7280;font-size:12px">아파트 감사 시스템에서 발송된 알림입니다.</p>`,
        }),
      })
    } catch {
      // non-critical: email failure does not block the main flow
    }
  }
}
