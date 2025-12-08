// app/marketing/case-studies/[slug]/page.tsx

import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { caseStudies } from '@/lib/marketing/caseStudies'

type CaseStudyPageProps = {
  params: { slug: string }
}

export default function CaseStudyPage({ params }: CaseStudyPageProps) {
  const cs = caseStudies.find((c) => c.slug === params.slug)
  if (!cs) {
    return notFound()
  }

  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      <section className="border-b border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white px-6 pb-16 pt-20 dark:border-zinc-800/70 dark:from-black dark:to-zinc-950">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/marketing/enterprise"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Enterprise overview
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center rounded-full bg-zinc-900 px-3 py-1 text-[11px] font-medium text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
              {cs.logoText}
            </span>
            <span className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1 text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
              {cs.industry}
            </span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight sm:text-4xl">
            {cs.title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            {cs.summary}
          </p>

          <div className="mt-6 grid gap-4 text-sm sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Headline result
              </div>
              <div className="mt-2 text-2xl font-semibold">
                {cs.headlineMetric}
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                {cs.headlineMetricLabel}
              </div>
            </div>
            {cs.results.slice(0, 2).map((r) => (
              <div
                key={r.label}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {r.label}
                </div>
                <div className="mt-2 text-xl font-semibold">{r.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-zinc-200 bg-white px-6 py-16 dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.3fr,1fr]">
          <div className="space-y-8 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Challenges
              </h2>
              <ul className="mt-3 space-y-2">
                {cs.challenges.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[7px] h-[6px] w-[6px] rounded-full bg-zinc-400" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Solution with Skillify
              </h2>
              <ul className="mt-3 space-y-2">
                {cs.solutions.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="mt-[7px] h-[6px] w-[6px] rounded-full bg-emerald-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h2 className="text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                Results
              </h2>
              <ul className="mt-3 space-y-2">
                {cs.results.map((r) => (
                  <li
                    key={r.label}
                    className="flex items-baseline justify-between text-sm"
                  >
                    <span className="text-zinc-500">{r.label}</span>
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">
                      {r.value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <aside className="space-y-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              CLIENT QUOTE
            </p>
            <p className="text-sm text-zinc-800 dark:text-zinc-100">
              &ldquo;{cs.quote.text}&rdquo;
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              {cs.quote.name} · {cs.quote.role}
            </p>

            <div className="mt-6 rounded-xl bg-zinc-900 px-4 py-3 text-xs text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
              <p className="font-medium">
                See how this could look in your pipeline
              </p>
              <p className="mt-2 text-[11px] text-zinc-300 dark:text-zinc-700">
                We’ll map your GTM flows onto Skillify, including scheduling,
                follow-ups, and dashboards.
              </p>
              <Link
                href="/marketing/enterprise#book-demo"
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold"
              >
                Book an enterprise demo
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
