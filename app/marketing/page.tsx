// app/marketing/page.tsx

import Link from 'next/link'
import { ArrowRight, Check } from 'lucide-react'

const industries = [
  'Lawn & Landscaping',
  'Plumbing',
  'HVAC',
  'Electrical',
  'Cleaning',
  'Home Services',
]

const highlights = [
  {
    label: 'New leads',
    value: '24',
    note: 'this month',
  },
  {
    label: 'Active customers',
    value: '186',
    note: 'in workspace',
  },
  {
    label: 'Jobs this week',
    value: '42',
    note: 'scheduled',
  },
]

const quickFeatures = [
  {
    title: 'Customers & Leads',
    body: 'Keep new inquiries, follow-ups, customer history, and next actions organized.',
  },
  {
    title: 'Jobs & Scheduling',
    body: 'Turn customer work into scheduled jobs, recurring services, assignments, and clear next steps.',
  },
  {
    title: 'Automations & AI',
    body: 'Automate repetitive work and use workspace-aware AI to surface what needs attention.',
  },
]

const workflowExamples = [
  {
    title: 'Lead → Customer',
    body: 'Capture inquiries, track follow-ups, and keep customer records connected from the first conversation.',
  },
  {
    title: 'Customer → Job',
    body: 'Turn customer work into jobs, assignments, and clear next steps.',
  },
  {
    title: 'Job → Schedule → Complete',
    body: 'Coordinate calendars, recurring services, team availability, automations, and reporting in one place.',
  },
]

export default function MarketingHomePage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HERO */}
      <section className="px-6 pb-24 pt-24 lg:pb-32 lg:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.3fr,1fr]">
          {/* LEFT */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/80 px-3 py-1 text-xs font-medium text-slate-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Business operations and intelligence for growing service
              businesses
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Run your business from one intelligent workspace.
            </h1>

            <p className="mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Manage leads, customers, jobs, scheduling, automations, and
              business insights without stitching together multiple tools.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_32px_-12px_rgba(37,99,235,0.8)] transition hover:bg-blue-700 sm:text-base"
              >
                Start 14-day free trial
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/marketing/demo"
                className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-200 sm:text-base"
              >
                Book a walkthrough
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-slate-600 dark:text-zinc-300 sm:text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                14-day free trial
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Cancel before trial ends
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Setup built around your business
              </div>
            </div>
          </div>

          {/* RIGHT: Mock dashboard */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-sky-400/10 blur-3xl" />

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white/95 shadow-2xl shadow-slate-200/70 dark:border-zinc-800 dark:bg-zinc-950/80 dark:shadow-none">
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3 dark:border-zinc-800/80">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                  Operations overview
                </span>
                <span className="text-xs text-emerald-500">Live</span>
              </div>

              <div className="space-y-4 p-5">
                {/* Stat row */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {highlights.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                    >
                      <div className="text-[11px] text-slate-600 dark:text-zinc-300">
                        {item.label}
                      </div>
                      <div className="text-sm font-semibold">{item.value}</div>
                      <div className="text-[11px] text-slate-600 dark:text-zinc-300">
                        {item.note}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Automation list */}
                <div className="mt-2 space-y-2">
                  {[
                    'New lead ➝ Follow-up',
                    'Estimate visit scheduled',
                    'Job assigned to crew',
                    'Follow-up automation completed',
                  ].map((rule) => (
                    <div
                      key={rule}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/70"
                    >
                      <span className="text-zinc-600 dark:text-zinc-300">
                        {rule}
                      </span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-t border-slate-200/80 py-10 dark:border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-zinc-300">
            BUILT FOR MODERN SERVICE BUSINESSES
          </p>
          <div className="grid grid-cols-2 gap-4 text-center text-xs font-medium text-slate-800 sm:grid-cols-4 sm:text-sm md:grid-cols-6">
            {industries.map((item) => (
              <div
                key={item}
                className="rounded-xl border border-sky-200 bg-sky-50/70 py-3 shadow-sm shadow-sky-100/50 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-50"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE STRIP */}
      <section className="bg-slate-50 py-20 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          {quickFeatures.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 transition hover:border-blue-200 hover:bg-blue-50/20 dark:border-zinc-800 dark:bg-black dark:shadow-none dark:hover:border-blue-500/30"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* WORKFLOW PROOF */}
      <section className="border-t border-slate-200 bg-white py-20 dark:border-zinc-800/70 dark:bg-black">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-semibold">
                Built around the way service businesses actually work
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                Skillify connects customer acquisition, operations, scheduling,
                automation, and reporting without presenting unverified
                testimonials as proof.
              </p>
            </div>
            <Link
              href="/marketing/features"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              Explore the workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {workflowExamples.map((item) => (
              <div
                key={item.title}
                className="flex h-full flex-col rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-sm shadow-slate-200/70 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none"
              >
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {item.title}
                </h3>
                <p className="mt-3 flex-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="border-t border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 py-20 text-zinc-50 dark:border-zinc-800/70">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-semibold">
            Turn more inquiries into customers — and keep the work moving.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-300">
            Capture inquiries, organize customer work, schedule jobs, and
            automate follow-up from the same workspace.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/40 transition hover:bg-blue-700"
            >
              Start 14-day free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/marketing/demo"
              className="inline-flex items-center gap-2 rounded-full border border-slate-400/70 px-6 py-3 text-sm font-medium text-zinc-100 transition hover:border-blue-300 hover:bg-blue-500/10"
            >
              Book a walkthrough
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
