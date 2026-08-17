// app/marketing/index/page.tsx

import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Sparkles,
  Workflow,
  BarChart3,
  Bot,
  Clock,
} from 'lucide-react'

export default function MarketingHomePage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HERO */}
      <section className="px-6 pb-20 pt-24 lg:pb-28 lg:pt-20">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.3fr,1fr]">
          {/* Left */}
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
              Skillify brings leads, customers, jobs, scheduling, automations,
              and operational visibility into one workspace.
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
                Setup built around your business
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Cancel before trial ends
              </div>
            </div>
          </div>

          {/* Right "mock dashboard" */}
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
                  {[
                    { label: 'New leads', value: '24', note: 'this month' },
                    {
                      label: 'Active customers',
                      value: '186',
                      note: 'workspace',
                    },
                    { label: 'Jobs this week', value: '42', note: 'scheduled' },
                  ].map((item) => (
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
                <div className="mt-3 space-y-2">
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

      {/* SOCIAL PROOF / USE CASES */}
      <section className="border-t border-slate-200/80 py-10 dark:border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 dark:text-zinc-300">
            BUILT FOR MODERN SERVICE BUSINESSES
          </p>
          <div className="grid grid-cols-2 gap-4 text-center text-xs font-medium text-slate-800 sm:grid-cols-4 sm:text-sm md:grid-cols-6">
            {[
              'Lawn & Landscaping',
              'Plumbing',
              'HVAC',
              'Electrical',
              'Cleaning',
              'Home Services',
            ].map((item) => (
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

      {/* CORE PILLARS */}
      <section className="bg-slate-50 py-20 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">
                One workspace for customers, work, scheduling, and insights.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                Skillify connects customer records, jobs, scheduling, workflows,
                and business visibility in a single dashboard.
              </p>
            </div>
            <Link
              href="/marketing/features"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500"
            >
              Explore all features
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <FeaturePillar
              icon={<Workflow className="h-5 w-5" />}
              title="Customers & leads"
              body="Track inquiries, customer history, notes, follow-ups, and connected records from one place."
            />
            <FeaturePillar
              icon={<Bot className="h-5 w-5" />}
              title="Jobs & operations"
              body="Organize customer work, jobs, assignments, and clear next steps."
            />
            <FeaturePillar
              icon={<Clock className="h-5 w-5" />}
              title="Scheduling"
              body="Use calendar views, appointments, recurring services, event types, and team availability."
            />
            <FeaturePillar
              icon={<BarChart3 className="h-5 w-5" />}
              title="Automations & AI"
              body="Build repeatable workflows and use workspace-aware AI for recommendations and explanations."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            How service businesses use Skillify in 3 steps
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 dark:text-zinc-400">
            Start with the customer work you already do, then connect the
            follow-up, scheduling, and automation around it.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <HowItWorksStep
              label="01"
              title="Capture the customer request"
              body="Organize new inquiries, customer details, notes, and next actions before they fall through the cracks."
            />
            <HowItWorksStep
              label="02"
              title="Schedule and assign the work"
              body="Turn customer needs into jobs, visits, recurring services, team assignments, and calendar activity."
            />
            <HowItWorksStep
              label="03"
              title="Automate and monitor operations"
              body="Use workflow runs, dashboards, reports, and AI explanations to see what needs attention."
            />
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="bg-slate-50 py-16 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Start small, scale to Elite.
          </h2>
          <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Basic helps you organize customers and core operations. Pro and
            Elite expand scheduling, workflow, AI, reporting, and governance.
          </p>
          <Link
            href="/marketing/pricing"
            className="mt-2 inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
          >
            View pricing
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="border-t border-slate-200 py-14 text-center dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to stop patching tools together?
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Give Skillify a week to organize your customers, jobs, scheduling,
            follow-up, and workflow visibility.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              Start 14-day free trial
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/marketing/demo"
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-200"
            >
              Book a walkthrough
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

/* ------------- Local components ------------- */

function FeaturePillar({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-md shadow-slate-200/60 transition hover:border-blue-200 hover:bg-blue-50/20 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none dark:hover:border-blue-500/30">
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-600/10 text-blue-600">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  )
}

function HowItWorksStep({
  label,
  title,
  body,
}: {
  label: string
  title: string
  body: string
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 text-sm shadow-md shadow-slate-200/60 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
        {label}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  )
}
