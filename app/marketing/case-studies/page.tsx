// app/marketing/case-studies/page.tsx

import Link from 'next/link'
import { caseStudies } from '@/lib/caseStudies'

export default function CaseStudiesIndexPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Customer stories
        </h1>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          See how teams use Skillify to automate calendars, follow-ups, and
          content — while keeping clients moving through their funnel.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {caseStudies.map((study) => (
            <Link
              key={study.slug}
              href={`/marketing/case-studies/${study.slug}`}
              className="group flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 text-sm shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-zinc-500">
                  {study.industry}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-medium text-emerald-500">
                  {study.headlineStat}
                </span>
              </div>
              <h2 className="mt-3 text-base font-semibold group-hover:text-zinc-900 dark:group-hover:text-zinc-50">
                {study.title}
              </h2>
              <p className="mt-2 line-clamp-3 text-xs text-zinc-600 dark:text-zinc-400">
                {study.summary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-zinc-500">
                {study.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-zinc-200 px-2 py-0.5 dark:border-zinc-800"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
