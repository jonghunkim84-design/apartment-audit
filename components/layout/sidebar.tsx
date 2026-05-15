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
} from 'lucide-react'

const navItems = [
  { href: '/dashboard',        label: '대시보드',       icon: LayoutDashboard, exact: false },
  { href: '/receipts',         label: '영수증',          icon: Receipt,         exact: true },
  { href: '/receipts/review',  label: '검수',            icon: ScanSearch,      exact: false },
  { href: '/audit',            label: '감사 체크리스트', icon: ClipboardCheck,  exact: false },
  { href: '/reports',          label: '보고서',          icon: FileText,        exact: false },
  { href: '/misc-income',      label: '잡수입',          icon: Wallet,          exact: false },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-60 shrink-0 border-r bg-background flex flex-col">
      <div className="h-14 flex items-center gap-2.5 px-5 border-b">
        <ShieldCheck className="h-5 w-5 text-primary" />
        <span className="font-semibold text-sm leading-tight">
          입주자대표회의<br />
          <span className="text-muted-foreground font-normal">감사시스템</span>
        </span>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact ? pathname === href : (pathname === href || pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
