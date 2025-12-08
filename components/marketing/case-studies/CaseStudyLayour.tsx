// components/marketing/case-studies/CaseStudyLayout.tsx

'use client'

import type { CaseStudy } from '@/lib/caseStudies'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export function CaseStudyLayout({ study }: { study: CaseStudy }) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <main className="mx-auto max-w-5xl px-6 py-16">
        <Link
          href="/marketing/enterprise"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Enterprise
        </Link>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Case study • {study.industry}
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              {study.title}
            </h1>
            <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              {study.summary}
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Customer
            </div>
            <div className="mt-1 text-sm font-medium">{study.customer}</div>
            <div className="mt-3 text-[11px] text-zinc-500">
              Key result:{' '}
              <span className="font-semibold text-emerald-500">
                {study.headlineStat}
              </span>
            </div>
          </div>
        </div>

        {/* Stats row */}
        {study.metrics.length > 0 && (
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {study.metrics.map((m) => (
              <div
                key={m.label}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/80"
              >
                <div className="text-xs text-zinc-500">{m.label}</div>
                <div className="mt-1 text-xl font-semibold">{m.value}</div>
                {m.caption && (
                  <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {m.caption}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Body sections */}
        <div className="mt-10 space-y-8">
          {study.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-lg font-semibold">{section.heading}</h2>
              <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {section.body}
              </p>
            </section>
          ))}
        </div>

        {/* Quote */}
        {study.quote && (
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-zinc-700 dark:text-zinc-200">
              “{study.quote.text}”
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              {study.quote.person} • {study.quote.role}
            </p>
          </div>
        )}
      </main>
    </div>
  )
}
