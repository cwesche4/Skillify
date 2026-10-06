// app/marketing/testimonials/page.tsx

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export default function TestimonialsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HEADER */}
      <section className="px-6 pb-10 pt-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            CONTROLLED LAUNCH
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Verified customer evidence is coming after the launch cohort.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            We do not publish fictional testimonials or unverified outcomes.
            Customer quotes will appear only with participant approval.
          </p>
        </div>
      </section>

      {/* GRID */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
            No verified customer testimonials are published yet.
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Curious if Skillify fits your use case? Let&apos;s walk through a
              live example based on your funnel.
            </span>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/marketing/demo"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
              >
                Book a live demo
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Request controlled access
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
