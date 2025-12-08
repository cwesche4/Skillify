// components/marketing/WhitepaperCTA.tsx

'use client'

import { ArrowDownToLine } from 'lucide-react'

export function WhitepaperCTA() {
  return (
    <section className="bg-zinc-50 py-12 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-6 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-base font-semibold">
            Download the GTM Automation Playbook
          </h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            A practical guide to cleaning up your funnel, consolidating tools,
            and automating demos, follow-ups, and onboarding.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          <ArrowDownToLine className="h-4 w-4" />
          Download PDF
        </button>
      </div>
    </section>
  )
}
