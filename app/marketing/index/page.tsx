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
      <section className="px-6 pb-20 pt-24 lg:pb-28 lg:pt-28">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.3fr,1fr]">
          {/* Left */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50/70 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Skillify · AI automation workspace for modern teams
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Automate calendars, follow-ups, and content in one workspace.
            </h1>

            <p className="mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Skillify gives operators, agencies, and service businesses an
              AI-powered command center for scheduling, client communication,
              and automation flows.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_32px_-12px_rgba(37,99,235,0.8)] transition hover:bg-blue-700 sm:text-base"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/marketing/demo"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-3 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 sm:text-base"
              >
                Book a live demo
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Built for agencies & operators
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Works with your existing tools
              </div>
            </div>
          </div>

          {/* Right "mock dashboard" */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-sky-400/10 blur-3xl" />
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white/90 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-zinc-800/80">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Automation overview
                </span>
                <span className="text-xs text-emerald-500">Live</span>
              </div>
              <div className="space-y-4 p-5">
                {/* Stat row */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { label: 'Appointments', value: '+38%', note: 'this week' },
                    { label: 'Follow-ups', value: '92%', note: 'auto-handled' },
                    { label: 'Response time', value: '1.4m', note: 'avg' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                    >
                      <div className="text-[11px] text-zinc-500">
                        {item.label}
                      </div>
                      <div className="text-sm font-semibold">{item.value}</div>
                      <div className="text-[11px] text-zinc-500">
                        {item.note}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Automation list */}
                <div className="mt-3 space-y-2">
                  {[
                    'New lead ➝ auto-email + SMS follow-up',
                    'Missed call ➝ send booking link',
                    'No-show ➝ reschedule sequence',
                    'New client ➝ welcome + onboarding drip',
                  ].map((rule) => (
                    <div
                      key={rule}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/70"
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
      <section className="border-t border-zinc-200/70 py-10 dark:border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
            BUILT FOR MODERN SERVICE BUSINESSES
          </p>
          <div className="grid grid-cols-2 gap-6 text-center text-xs text-zinc-400 sm:grid-cols-4 sm:text-sm md:grid-cols-6">
            {[
              'Agencies',
              'Consultants',
              'Coaches',
              'Studios',
              'Salons',
              'Local Services',
            ].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-dashed border-zinc-200/60 py-3 dark:border-zinc-800/80"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CORE PILLARS */}
      <section className="bg-zinc-50 py-20 dark:bg-zinc-900">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-10 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">
                One workspace. Four pillars.
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                Skillify unifies scheduling, communication, automation flows,
                and analytics in a single, AI-powered dashboard.
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
              title="Automation builder"
              body="Drag-and-drop flows for triggers, delays, webhooks, AI nodes, and more — with autosave and history."
            />
            <FeaturePillar
              icon={<Bot className="h-5 w-5" />}
              title="AI follow-ups"
              body="LLM-driven emails and SMS that stay on-brand, handle objections, and keep leads warm."
            />
            <FeaturePillar
              icon={<Clock className="h-5 w-5" />}
              title="Calendar engine"
              body="Calendars, reminders, no-show flows, and reschedules handled automatically."
            />
            <FeaturePillar
              icon={<BarChart3 className="h-5 w-5" />}
              title="Analytics & AI Coach"
              body="Heatmaps, failure hotspots, and an AI Coach that explains performance in plain language."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center text-2xl font-semibold sm:text-3xl">
            How teams use Skillify in 3 steps
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-600 dark:text-zinc-400">
            You don&apos;t need to be “technical.” Skillify guides you through
            every step with templates, AI suggestions, and onboarding tours.
          </p>

          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <HowItWorksStep
              label="01"
              title="Pick a template or start from scratch"
              body="Choose from pre-built flows for leads, no-shows, onboarding, and more — or open a blank canvas."
            />
            <HowItWorksStep
              label="02"
              title="Customize messages & rules"
              body="Tell Skillify how you speak, what you offer, and when to follow up. AI Coach helps you tune everything."
            />
            <HowItWorksStep
              label="03"
              title="Turn it on and watch it run"
              body="Monitor runs in real-time. Use the heatmap and replay tools to improve performance over time."
            />
          </div>
        </div>
      </section>

      {/* PRICING PREVIEW */}
      <section className="bg-zinc-50 py-16 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 px-6 text-center">
          <Sparkles className="h-5 w-5 text-blue-500" />
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Start small, scale to Elite.
          </h2>
          <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
            Basic gets you unlimited flows and core automations. Pro and Elite
            unlock AI nodes, advanced analytics, and white-glove support.
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
      <section className="border-t border-zinc-200 py-14 text-center dark:border-zinc-800">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to stop patching tools together?
          </h2>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
            Give Skillify a week and watch your calendars, follow-ups, and
            client communication start running themselves.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/marketing/demo"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-3 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Talk to our team
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
    <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
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
    <div className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-zinc-900 text-[11px] font-semibold text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900">
        {label}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  )
}
