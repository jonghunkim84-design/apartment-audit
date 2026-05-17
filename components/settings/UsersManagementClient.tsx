'use client'

import { useEffect, useState, useTransition } from 'react'
import { UserPlus, RefreshCw, ShieldCheck, BookUser, Building2, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// ── 타입 ──────────────────────────────────────────────────────────────────────

type UserRow = {
  id: string
  email: string
  full_name: string
  role: string
  created_at: string
  last_sign_in_at: string | null
}

// ── 역할 메타 ─────────────────────────────────────────────────────────────────

const ROLE_OPTIONS = [
  { value: 'auditor',     label: '감사인',     icon: ShieldCheck, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'accountant',  label: '회계담당자', icon: BookUser,    cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'manager',     label: '관리소장',   icon: Building2,   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'external',    label: '외부인',     icon: Eye,         cls: 'bg-zinc-50 text-zinc-600 border-zinc-200' },
] as const

function roleMeta(value: string) {
  return ROLE_OPTIONS.find(r => r.value === value) ?? ROLE_OPTIONS[3]
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

// ── 컴포넌트 ──────────────────────────────────────────────────────────────────

export function UsersManagementClient() {
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [isPending, startTransition] = useTransition()

  // 초대 폼 상태
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('viewer')

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3000)
  }

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/users')
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      setUsers(data.users)
    } catch (e) {
      showToast((e as Error).message, false)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  // ── 역할 변경 ────────────────────────────────────────────────────────────────
  const handleRoleChange = (id: string, role: string) => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, role }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        setUsers(prev => prev.map(u => u.id === id ? { ...u, role } : u))
        showToast('역할이 변경되었습니다.', true)
      } catch (e) {
        showToast((e as Error).message, false)
      }
    })
  }

  // ── 유저 초대 ────────────────────────────────────────────────────────────────
  const handleInvite = () => {
    if (!inviteEmail.trim()) return
    startTransition(async () => {
      try {
        const res = await fetch('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        showToast(`${inviteEmail} 에게 초대 이메일을 발송했습니다.`, true)
        setInviteEmail('')
        fetchUsers()
      } catch (e) {
        showToast((e as Error).message, false)
      }
    })
  }

  return (
    <div className="space-y-6">

      {/* 토스트 */}
      {toast && (
        <div className={cn(
          'fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm text-white shadow-lg',
          toast.ok ? 'bg-emerald-600' : 'bg-red-500'
        )}>
          {toast.msg}
        </div>
      )}

      {/* 유저 초대 카드 */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <UserPlus className="h-4 w-4 text-blue-500" />
          <h2 className="text-sm font-semibold text-zinc-700">유저 초대</h2>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="email"
            placeholder="초대할 이메일 주소"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className="flex-1"
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <Button
            onClick={handleInvite}
            disabled={isPending || !inviteEmail.trim()}
            className="bg-blue-500 hover:bg-blue-600 text-white shrink-0"
          >
            {isPending ? '발송 중...' : '초대 발송'}
          </Button>
        </div>
      </div>

      {/* 유저 목록 테이블 */}
      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-700">
            구성원 목록
            <span className="ml-2 text-xs font-normal text-zinc-400">({users.length}명)</span>
          </h2>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="text-zinc-400 hover:text-zinc-700 transition-colors"
            title="새로고침"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-sm text-zinc-400">불러오는 중...</div>
        ) : users.length === 0 ? (
          <div className="py-16 text-center text-sm text-zinc-400">등록된 구성원이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50/50">
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">이메일</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">이름</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">역할</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">가입일</th>
                  <th className="text-left px-6 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wide">마지막 로그인</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {users.map(u => {
                  const meta = roleMeta(u.role)
                  return (
                    <tr key={u.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 text-zinc-800 font-medium">{u.email}</td>
                      <td className="px-6 py-4 text-zinc-600">{u.full_name || '—'}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn('text-xs border shrink-0', meta.cls)}>
                            {meta.label}
                          </Badge>
                          <select
                            value={u.role}
                            onChange={e => handleRoleChange(u.id, e.target.value)}
                            disabled={isPending}
                            className="h-7 rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-600 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.map(r => (
                              <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-zinc-500">{fmt(u.created_at)}</td>
                      <td className="px-6 py-4 text-zinc-500">{fmt(u.last_sign_in_at)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
