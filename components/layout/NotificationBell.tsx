'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

type NotificationRow = {
  id: string
  title: string
  message: string
  severity: Severity
  category: string | null
  reference_id: string | null
  is_read: boolean
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return '방금 전'
  if (mins < 60) return `${mins}분 전`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}시간 전`
  return `${Math.floor(hours / 24)}일 전`
}

const SEVERITY_STYLE: Record<Severity, string> = {
  INFO: 'text-blue-500',
  WARNING: 'text-yellow-500',
  CRITICAL: 'text-red-500',
}

const SEVERITY_ICON: Record<Severity, string> = {
  INFO: 'ℹ️',
  WARNING: '⚠️',
  CRITICAL: '🚨',
}

export function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const fetchNotifications = useCallback(async () => {
    const res = await fetch('/api/notifications')
    if (!res.ok) return
    const data = await res.json() as { notifications: NotificationRow[]; unread_count: number }
    setNotifications(data.notifications)
    setUnreadCount(data.unread_count)
  }, [])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as NotificationRow
          setNotifications((prev) => [newRow, ...prev].slice(0, 30))
          setUnreadCount((c) => c + 1)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId])

  useEffect(() => {
    const interval = setInterval(fetchNotifications, 60_000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    })
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
    setUnreadCount((c) => Math.max(0, c - 1))
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="ghost"
        size="icon"
        className="relative text-slate-300 hover:text-slate-100 hover:bg-slate-700"
        onClick={() => setOpen((o) => !o)}
        aria-label="알림"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 rounded-md border bg-background shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <span className="font-semibold text-sm">알림</span>
            {unreadCount > 0 && (
              <button
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={markAllRead}
              >
                모두 읽음
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">알림이 없습니다.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b last:border-0 hover:bg-muted/50 transition-colors',
                    !n.is_read && 'bg-blue-50 dark:bg-blue-950/20'
                  )}
                  onClick={() => { if (!n.is_read) markRead(n.id) }}
                >
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 text-base leading-none">{SEVERITY_ICON[n.severity]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs font-semibold truncate', SEVERITY_STYLE[n.severity])}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
