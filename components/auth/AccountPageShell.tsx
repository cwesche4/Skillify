import React, { type ReactNode } from 'react'
import Link from 'next/link'

import { BrandLogo } from '@/components/branding/BrandLogo'

export function AccountPageShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(34,211,238,0.14),transparent_28%),radial-gradient(circle_at_80%_0%,rgba(99,102,241,0.14),transparent_24%)]"
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <BrandLogo
              variant="horizontal"
              theme="dark"
              alt="Skillify"
              className="h-9 w-32"
            />
          </Link>
          <Link
            href="/dashboard"
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            Back to dashboard
          </Link>
        </header>

        <section className="mx-auto flex w-full flex-1 flex-col justify-center py-10">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              User account
            </p>
            <h1 className="mt-3 font-heading text-3xl font-semibold text-white">
              {title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
              {description}
            </p>
          </div>
          {children}
        </section>
      </div>
    </main>
  )
}
