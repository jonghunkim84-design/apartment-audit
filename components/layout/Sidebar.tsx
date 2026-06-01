'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Receipt,
  ScanSearch,
  ClipboardCheck,
  FileText,
  Wallet,
  ShieldCheck,
  Wrench,
  FileSignature,
  Scale,
  ShieldAlert,
  Globe,
  BookCheck,
  Users,
  Building2,
  ClipboardList,
  CheckSquare,
  BarChart2,
  CalendarDays,
  Package,
  Search,
  HelpCircle,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',          label: '대시보드',        icon: LayoutDashboard, exact: false },
  { href: '/receipts',           label: '영수증',           icon: Receipt,         exact: true },
  { href: '/receipts/review',    label: '검수',             icon: ScanSearch,      exact: false },
  { href: '/audit',              label: '감사 체크리스트',  icon: ClipboardCheck,  exact: false },
  { href: '/long-term-repair',   label: '장기수선충당금',   icon: Wrench,          exact: false },
  { href: '/contracts',          label: '입찰·계약',        icon: FileSignature,   exact: false },
  { href: '/misc-income',        label: '잡수입',           icon: Wallet,          exact: false },
  { href: '/reconsideration',    label: '재심의 요청',      icon: Scale,           exact: false },
  { href: '/findings',           label: '감사 지적사항',    icon: ShieldAlert,     exact: false },
  { href: '/external-audits',    label: '외부 회계감사',    icon: BookCheck,       exact: false },
  { href: '/reports',            label: '보고서',           icon: FileText,        exact: false },
  { href: '/disclosure',         label: '공개 포털 관리',   icon: Globe,           exact: false },
]

const COUNCIL_ITEMS = [
  { href: '/council',                          label: '운영 대시보드', icon: Building2,     exact: true },
  { href: '/council/meetings',                 label: '회의 목록',     icon: ClipboardList, exact: false },
  { href: '/council/actions',                  label: '액션 현황',     icon: CheckSquare,   exact: false },
  { href: '/council/reports/quarterly',        label: '분기 보고서',   icon: BarChart2,     exact: false },
  { href: '/council/reports/annual',           label: '연간 마무리',   icon: CalendarDays,  exact: false },
  { href: '/council/handover',                 label: '인수인계',      icon: Package,       exact: false },
  { href: '/council/search',                   label: '지식 검색',     icon: Search,        exact: false },
  { href: '/council/help',                     label: '사용 안내',     icon: HelpCircle,    exact: false },
]

const AUDITOR_ITEMS = [
  { href: '/settings/users', label: '사용자 관리', icon: Users, exact: false },
]

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname()
  const isAuditor = role === 'auditor'

  const allItems = isAuditor ? [...NAV_ITEMS, ...AUDITOR_ITEMS] : NAV_ITEMS

  return (
    <aside className="w-60 shrink-0 flex flex-col" style={{ backgroundColor: '#8BADD9' }}>
      <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: '#7A9FD0', background: 'rgba(0,0,0,0.18)' }}>
        <div className="shrink-0 w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <div className="leading-snug">
          <p className="text-white font-bold text-[15px] tracking-tight">입주자대표회의</p>
          <p className="text-blue-100 text-xs font-medium tracking-widest uppercase">감사시스템</p>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {allItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}

        {/* 대표회의 운영 섹션 */}
        <div className="pt-3 pb-1 px-3">
          <p className="text-xs font-semibold text-blue-200 uppercase tracking-wider">대표회의 운영</p>
        </div>
        {COUNCIL_ITEMS.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
