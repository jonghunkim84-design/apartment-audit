import { createAdminClient } from '@/lib/supabase/admin'
import { createNotificationsForComplex } from './create'

// ── 날짜 헬퍼 ─────────────────────────────────────────────────────────────────

function todayKST(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
}

function isLastDayOfMonth(): boolean {
  const now = new Date(Date.now() + 9 * 3_600_000)
  const tomorrow = new Date(now)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return tomorrow.getUTCDate() === 1
}

function isLastDayOfQuarter(): boolean {
  if (!isLastDayOfMonth()) return false
  const month = new Date(Date.now() + 9 * 3_600_000).getUTCMonth() + 1 // 1-12
  return [3, 6, 9, 12].includes(month)
}

async function getAllComplexIds(supabase: ReturnType<typeof createAdminClient>): Promise<string[]> {
  const { data } = await supabase.from('apartment_complexes').select('id')
  return (data ?? []).map((d) => d.id)
}

// 시스템 발신용 더미 UUID (actorUserId — targetRoles 사용 시 무시됨)
const SYSTEM_ACTOR = '00000000-0000-0000-0000-000000000000'

// ── 알림 1: 매월 말일 — 예금잔액 ↔ 관계장부 대조 확인 ─────────────────────────
// 조건: 해당 월 체크리스트에 월간 항목 pass 완료가 없으면 말일에 발송

export async function checkMonthlyBalanceVerification(): Promise<void> {
  if (!isLastDayOfMonth()) return

  const supabase = createAdminClient()
  const today = todayKST()
  const monthStart = today.slice(0, 7) + '-01'
  const complexIds = await getAllComplexIds(supabase)

  for (const complexId of complexIds) {
    const { data: checklist } = await supabase
      .from('audit_checklists')
      .select('id')
      .eq('apartment_complex_id', complexId)
      .gte('period_start', monthStart)
      .lte('period_start', today)
      .maybeSingle()

    if (checklist) {
      const { count } = await supabase
        .from('audit_checklist_items')
        .select('id', { count: 'exact', head: true })
        .eq('checklist_id', checklist.id)
        .eq('category', '월간')
        .eq('status', 'pass')

      if ((count ?? 0) > 0) continue // 대조 확인 완료
    }

    await createNotificationsForComplex(
      {
        complexId,
        actorUserId: SYSTEM_ACTOR,
        title: '예금잔액 ↔ 관계장부 대조 확인 필요',
        message:
          '이번 달 예금잔액 ↔ 관계장부 대조 확인이 필요합니다 (별지 제3-2호서식)',
        severity: 'WARNING',
        category: 'schedule',
        targetRoles: ['auditor'],
      },
      supabase,
    )
  }
}

// ── 알림 2: 매 분기 말 — 분기 지출 증빙·시설·계약 감사 알림 ────────────────────
// 조건: 해당 분기 체크리스트가 completed가 아니면 발송

export async function checkQuarterlyAuditReminder(): Promise<void> {
  if (!isLastDayOfQuarter()) return

  const supabase = createAdminClient()
  const now = new Date(Date.now() + 9 * 3_600_000)
  const year = now.getUTCFullYear()
  const q = Math.floor(now.getUTCMonth() / 3) + 1
  const quarterStart = `${year}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`
  const complexIds = await getAllComplexIds(supabase)

  for (const complexId of complexIds) {
    const { data: checklist } = await supabase
      .from('audit_checklists')
      .select('status')
      .eq('apartment_complex_id', complexId)
      .gte('period_start', quarterStart)
      .maybeSingle()

    if (checklist?.status === 'completed') continue

    await createNotificationsForComplex(
      {
        complexId,
        actorUserId: SYSTEM_ACTOR,
        title: '분기 감사 실시 필요',
        message:
          '분기 지출 증빙 감사 및 시설·계약 감사 실시가 필요합니다 (감사 업무규정 제5조, 제6조)',
        severity: 'WARNING',
        category: 'schedule',
        targetRoles: ['auditor'],
      },
      supabase,
    )
  }
}

// ── 알림 3: 감사결과 제출 기한 경고 ─────────────────────────────────────────────
// - resolved_at이 있고 remediation_due가 없으면 → resolved_at + 7일을 자동 설정
// - status='draft' && remediation_due < today → [제출기한초과] CRITICAL

export async function checkSubmissionDeadline(): Promise<void> {
  const supabase = createAdminClient()
  const today = todayKST()

  // resolved_at이 있고 remediation_due가 미설정인 건에 due 자동 부여
  // status: 'open' | 'investigating' (아직 종결되지 않은 활성 건)
  const { data: noDue } = await supabase
    .from('audit_findings')
    .select('id, resolved_at')
    .not('resolved_at', 'is', null)
    .is('remediation_due', null)
    .in('status', ['open', 'investigating'])

  for (const finding of noDue ?? []) {
    const due = new Date(new Date(finding.resolved_at!).getTime() + 7 * 86_400_000)
      .toISOString()
      .slice(0, 10)
    await supabase
      .from('audit_findings')
      .update({ remediation_due: due })
      .eq('id', finding.id)
  }

  // 제출 기한이 오늘보다 이전이고 아직 종결되지 않은 건 조회
  const { data: overdue } = await supabase
    .from('audit_findings')
    .select('id, apartment_complex_id, title')
    .in('status', ['open', 'investigating'])
    .not('remediation_due', 'is', null)
    .lt('remediation_due', today)

  // 단지별 그룹핑
  const byComplex = new Map<string, string[]>()
  for (const f of overdue ?? []) {
    const list = byComplex.get(f.apartment_complex_id) ?? []
    list.push(f.title ?? '(제목 없음)')
    byComplex.set(f.apartment_complex_id, list)
  }

  for (const [complexId, titles] of byComplex) {
    const summary =
      titles.slice(0, 3).join(', ') +
      (titles.length > 3 ? ` 외 ${titles.length - 3}건` : '')

    await createNotificationsForComplex(
      {
        complexId,
        actorUserId: SYSTEM_ACTOR,
        title: '[제출기한초과] 감사결과 보고서 제출 기한 초과',
        message: `감사결과 보고서 제출 기한이 초과되었습니다 (감사 업무규정 제12조) — ${summary}`,
        severity: 'CRITICAL',
        category: 'deadline',
        targetRoles: ['auditor'],
      },
      supabase,
    )
  }
}

// ── 알림 4: 입주자대표회의 조치 기한 경고 ────────────────────────────────────────
// - resolved_at + 15일 초과 && remediation_status가 미완료 → [조치기한초과] CRITICAL
// - 수신: auditor + manager

export async function checkRemediationDeadline(): Promise<void> {
  const supabase = createAdminClient()
  const cutoff = new Date(Date.now() - 15 * 86_400_000).toISOString()

  const { data: overdue } = await supabase
    .from('audit_findings')
    .select('id, apartment_complex_id, title, remediation_status')
    .not('resolved_at', 'is', null)
    .lt('resolved_at', cutoff)
    .not('remediation_status', 'eq', 'completed')

  const byComplex = new Map<string, string[]>()
  for (const f of overdue ?? []) {
    const list = byComplex.get(f.apartment_complex_id) ?? []
    list.push(f.title ?? '(제목 없음)')
    byComplex.set(f.apartment_complex_id, list)
  }

  for (const [complexId, titles] of byComplex) {
    const summary =
      titles.slice(0, 3).join(', ') +
      (titles.length > 3 ? ` 외 ${titles.length - 3}건` : '')

    await createNotificationsForComplex(
      {
        complexId,
        actorUserId: SYSTEM_ACTOR,
        title: '[조치기한초과] 감사결과 조치 기한 15일 초과',
        message: `감사결과 조치 기한 15일이 초과되었습니다 (감사 업무규정 제12조제4항) — ${summary}`,
        severity: 'CRITICAL',
        category: 'deadline',
        targetRoles: ['auditor', 'manager'],
      },
      supabase,
    )
  }
}

// ── 전체 실행 ─────────────────────────────────────────────────────────────────

export async function runAllScheduledChecks(): Promise<{ results: string[] }> {
  const results: string[] = []

  const run = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn()
      results.push(`${name}: ok`)
    } catch (e) {
      console.error(`[scheduled] ${name}`, e)
      results.push(`${name}: error`)
    }
  }

  await run('monthly_balance', checkMonthlyBalanceVerification)
  await run('quarterly_audit', checkQuarterlyAuditReminder)
  await run('submission_deadline', checkSubmissionDeadline)
  await run('remediation_deadline', checkRemediationDeadline)

  return { results }
}
