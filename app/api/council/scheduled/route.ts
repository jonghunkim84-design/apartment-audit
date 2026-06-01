import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 60

/**
 * Vercel Cron Job — 매일 KST 09:00 (UTC 00:00) 실행
 * 액션 마감 알림 (D-7, D-3, D-0) + overdue 자동 변경
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayStr = today.toISOString().split('T')[0]

  const d3 = new Date(today); d3.setDate(today.getDate() + 3)
  const d7 = new Date(today); d7.setDate(today.getDate() + 7)
  const d3Str = d3.toISOString().split('T')[0]
  const d7Str = d7.toISOString().split('T')[0]

  let totalNotifications = 0
  let overdueUpdated = 0

  try {
    // 1. 모든 단지의 pending/in_progress 액션 조회
    const { data: actions } = await db
      .from('council_actions')
      .select('id, title, due_date, status, assignee_id, apartment_complex_id, assignee_name')
      .in('status', ['pending', 'in_progress'])

    const allActions = (actions ?? []) as {
      id: string; title: string; due_date: string; status: string
      assignee_id: string | null; apartment_complex_id: string; assignee_name: string | null
    }[]

    const overdueIds: string[] = []
    const notifications: { user_id: string; apartment_complex_id: string; title: string; message: string; severity: 'INFO' | 'WARNING' | 'CRITICAL' }[] = []

    for (const action of allActions) {
      const due = action.due_date
      const assigneeId = action.assignee_id

      // overdue 처리
      if (due < todayStr) {
        overdueIds.push(action.id)
        // 담당자에게 지연 알림
        if (assigneeId) {
          const daysDiff = Math.ceil((today.getTime() - new Date(due).getTime()) / 86400000)
          notifications.push({
            user_id: assigneeId,
            apartment_complex_id: action.apartment_complex_id,
            title: '액션 기한 초과',
            message: `[대표회의] "${action.title}" 액션이 ${daysDiff}일 초과되었습니다. 즉시 처리 또는 에스컬레이션하세요.`,
            severity: 'CRITICAL',
          })
        }
      }
      // D-0 (오늘 마감)
      else if (due === todayStr && assigneeId) {
        notifications.push({
          user_id: assigneeId,
          apartment_complex_id: action.apartment_complex_id,
          title: '액션 마감일 D-0',
          message: `[대표회의] "${action.title}" 오늘이 마감일입니다.`,
          severity: 'WARNING',
        })
      }
      // D-3
      else if (due === d3Str && assigneeId) {
        notifications.push({
          user_id: assigneeId,
          apartment_complex_id: action.apartment_complex_id,
          title: '액션 마감 D-3',
          message: `[대표회의] "${action.title}" 마감까지 3일 남았습니다.`,
          severity: 'INFO',
        })
      }
      // D-7
      else if (due === d7Str && assigneeId) {
        notifications.push({
          user_id: assigneeId,
          apartment_complex_id: action.apartment_complex_id,
          title: '액션 마감 D-7',
          message: `[대표회의] "${action.title}" 마감까지 7일 남았습니다.`,
          severity: 'INFO',
        })
      }
    }

    // overdue 상태 업데이트
    if (overdueIds.length > 0) {
      await db
        .from('council_actions')
        .update({ status: 'overdue', updated_at: new Date().toISOString() })
        .in('id', overdueIds)
      overdueUpdated = overdueIds.length
    }

    // 알림 일괄 저장
    if (notifications.length > 0) {
      await supabase.from('notifications').insert(notifications)
      totalNotifications = notifications.length
    }

    return NextResponse.json({
      ok: true,
      date: todayStr,
      overdueUpdated,
      notificationsSent: totalNotifications,
    })
  } catch (err) {
    console.error('[council/scheduled]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
