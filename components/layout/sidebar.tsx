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

const AUDITOR_ITEMS = [
  { href: '/settings/users', label: '사용자 관리', icon: Users, exact: false },
]

export function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname()
  const isAuditor = role === 'auditor'

  const allItems = isAuditor ? [...NAV_ITEMS, ...AUDITOR_ITEMS] : NAV_ITEMS

  return (
    <aside className="w-60 shrink-0 flex flex-col bg-blue-500">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b border-blue-400">
        <ShieldCheck className="h-5 w-5 text-white" />
        <span className="font-semibold text-sm leading-tight text-white">
          입주자대표회의<br />
          <span className="text-blue-100 font-normal">감사시스템</span>
        </span>
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
      </nav>
    </aside>
  )
}
