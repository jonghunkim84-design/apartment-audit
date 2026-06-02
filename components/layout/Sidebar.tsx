'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Receipt,
  ClipboardCheck,
  ShieldAlert,
  Scale,
  Wrench,
  Wallet,
  FileSignature,
  FileText,
  BookCheck,
  Globe,
  ShieldCheck,
  Building2,
  ClipboardList,
  CheckSquare,
  BarChart2,
  CalendarDays,
  Package,
  Search,
  Users,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

// ── 타입 ─────────────────────────────────────────────────────

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  extraPaths?: string[]
}

type NavGroup = {
  id: string
  label: string
  items: NavItem[]
}

// ── 그룹 정의 ────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'audit',
    label: '감사 업무',
    items: [
      {
        href: '/receipts',
        label: '영수증 & 검수',
        icon: Receipt,
        extraPaths: ['/receipts/review'],
      },
      { href: '/audit',           label: '감사 체크리스트', icon: ClipboardCheck },
      { href: '/findings',        label: '지적사항',         icon: ShieldAlert },
      { href: '/reconsideration', label: '재심의 요청',      icon: Scale },
    ],
  },
  {
    id: 'finance',
    label: '재무 현황',
    items: [
      { href: '/long-term-repair', label: '장기수선충당금', icon: Wrench },
      { href: '/misc-income',      label: '잡수입',          icon: Wallet },
      { href: '/contracts',        label: '입찰·계약',       icon: FileSignature },
    ],
  },
  {
    id: 'report',
    label: '보고 & 공개',
    items: [
      { href: '/reports',         label: '보고서',       icon: FileText },
      { href: '/external-audits', label: '외부 회계감사', icon: BookCheck },
      { href: '/disclosure',      label: '공개 포털',    icon: Globe },
    ],
  },
  {
    id: 'council',
    label: '대표회의 운영',
    items: [
      { href: '/council',                   label: '운영 현황',   icon: Building2,     exact: true },
      { href: '/council/meetings',          label: '회의',         icon: ClipboardList },
      { href: '/council/actions',           label: '액션 현황',   icon: CheckSquare },
      { href: '/council/reports/quarterly', label: '분기 보고서', icon: BarChart2 },
      { href: '/council/reports/annual',    label: '연간 마무리', icon: CalendarDays },
      { href: '/council/handover',          label: '인수인계',    icon: Package },
      { href: '/council/search',            label: '지식 검색',   icon: Search },
    ],
  },
]

// ── 활성 판단 헬퍼 ───────────────────────────────────────────

function itemActive(pathname: string, item: NavItem): boolean {
  const main = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(item.href + '/')
  const extra = item.extraPaths?.some(p => pathname === p || pathname.startsWith(p + '/'))
  return main || !!extra
}

function groupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some(i => itemActive(pathname, i))
}

// ── 공통 NavLink ─────────────────────────────────────────────

function NavLink({ href, label, Icon, active }: {
  href: string
  label: string
  Icon: React.ElementType
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 pl-6 pr-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active
          ? 'bg-white/20 text-white'
          : 'text-blue-100 hover:bg-white/10 hover:text-white'
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  )
}

// ── 메인 컴포넌트 ────────────────────────────────────────────

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname()
  const isAuditor = role === 'auditor'

  // 현재 경로가 속한 그룹만 기본 펼침
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_GROUPS.map(g => [g.id, groupActive(pathname, g)]))
  )

  function toggle(id: string) {
    setOpenGroups(prev => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <aside className="w-56 shrink-0 flex flex-col" style={{ backgroundColor: '#8BADD9' }}>

      {/* 로고 */}
      <div
        className="flex items-center gap-3 px-4 py-4 border-b"
        style={{ borderColor: '#7A9FD0', background: 'rgba(0,0,0,0.18)' }}
      >
        <div className="shrink-0 w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
          <ShieldCheck className="h-4 w-4 text-white" />
        </div>
        <div className="leading-snug">
          <p className="text-white font-bold text-[14px] tracking-tight">입주자대표회의</p>
          <p className="text-blue-100 text-[10px] font-medium tracking-widest uppercase">감사시스템</p>
        </div>
      </div>

      {/* 네비게이션 */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">

        {/* 대시보드 — 항상 표시 */}
        <Link
          href="/dashboard"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
            pathname === '/dashboard'
              ? 'bg-white/20 text-white'
              : 'text-blue-100 hover:bg-white/10 hover:text-white'
          )}
        >
          <LayoutDashboard className="h-4 w-4 shrink-0" />
          대시보드
        </Link>

        {/* 그룹 */}
        {NAV_GROUPS.map(group => {
          const isActive = groupActive(pathname, group)
          const isOpen   = openGroups[group.id] ?? false

          return (
            <div key={group.id} className="pt-1">
              {/* 그룹 헤더 */}
              <button
                onClick={() => toggle(group.id)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors text-left',
                  isActive
                    ? 'text-white font-semibold bg-white/10'
                    : 'text-white/50 hover:text-white/80 font-medium'
                )}
              >
                <span className="text-sm">{group.label}</span>
                {isOpen
                  ? <ChevronDown className="h-4 w-4 shrink-0" />
                  : <ChevronRight className="h-4 w-4 shrink-0" />
                }
              </button>

              {/* 그룹 아이템 */}
              {isOpen && (
                <div className="mt-0.5 space-y-0.5">
                  {group.items.map(item => (
                    <NavLink
                      key={item.href}
                      href={item.href}
                      label={item.label}
                      Icon={item.icon}
                      active={itemActive(pathname, item)}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}

        {/* 사용자 관리 (감사인 전용) */}
        {isAuditor && (
          <div className="pt-1">
            <div className="px-3 py-1.5">
              <span className="text-xs font-medium text-blue-200 uppercase tracking-wider">시스템</span>
            </div>
            <NavLink
              href="/settings/users"
              label="사용자 관리"
              Icon={Users}
              active={pathname.startsWith('/settings/users')}
            />
          </div>
        )}
      </nav>

      {/* 하단 — 사용 안내 */}
      <div className="px-2 pb-3 border-t pt-2" style={{ borderColor: '#7A9FD0' }}>
        <Link
          href="/council/help"
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
            pathname === '/council/help'
              ? 'text-white bg-white/20'
              : 'text-blue-200 hover:text-white hover:bg-white/10'
          )}
        >
          <HelpCircle className="h-4 w-4 shrink-0" />
          대표회의 사용안내
        </Link>
      </div>
    </aside>
  )
}
