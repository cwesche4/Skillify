import Link from 'next/link'
import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'

import { GlobalAdminNav } from '@/components/admin/GlobalAdminNav'

export function GlobalAdminLayout({
  backHref,
  children,
}: {
  backHref: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5">
        <header className="rounded-xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-sm shadow-slate-950/30">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to Dashboard
            </Link>

            <GlobalAdminNav />
          </div>
        </header>

        {children}
      </div>
    </main>
  )
}
