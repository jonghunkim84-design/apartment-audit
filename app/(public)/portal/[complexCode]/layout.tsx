import type { ReactNode } from 'react'
import { Building2, ShieldCheck } from 'lucide-react'

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-[#8BADD9]" />
            <span className="font-semibold text-slate-800 text-sm">아파트 감사 공개 포털</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
            공동주택관리법 제26조 의거 공개
          </div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">
        {children}
      </main>
      <footer className="border-t border-slate-200 mt-16">
        <div className="max-w-4xl mx-auto px-4 py-6 text-center text-xs text-slate-400">
          본 포털은 공동주택관리법 제26조에 따라 입주자대표회의가 의무적으로 공개하는 정보입니다.
        </div>
      </footer>
    </div>
  )
}
