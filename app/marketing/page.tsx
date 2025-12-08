// app/marketing/page.tsx

import Link from 'next/link'
import {
  ArrowRight,
  Check,
  Star,
  Sparkles,
  Clock,
  BarChart3,
} from 'lucide-react'

const industries = [
  'Agencies',
  'Consultants',
  'Coaches',
  'Studios',
  'Salons',
  'Local Services',
]

const highlights = [
  {
    label: 'Avg. time saved',
    value: '8–12 hrs /week',
    note: 'per workspace',
  },
  {
    label: 'Lead response time',
    value: '1.4 min',
    note: 'median across users',
  },
  {
    label: 'Show-up rate',
    value: '+27%',
    note: 'after automation',
  },
]

const quickFeatures = [
  {
    title: 'AI follow-ups that don’t forget',
    body: 'Every new lead, missed call, and no-show gets a fast, on-brand reply — across email and SMS.',
  },
  {
    title: 'Calendar that runs itself',
    body: 'Skillify handles reminders, reschedules, confirmations, and time zones so your team doesn’t have to.',
  },
  {
    title: 'Content that sounds like you',
    body: 'Generate campaigns, posts, and scripts that match each business’s tone, not generic robot copy.',
  },
]

const testimonials = [
  {
    name: 'Jordan M.',
    role: 'Agency Owner',
    quote:
      'We replaced three tools and stopped chasing no-shows. Clients actually show up to calls now.',
  },
  {
    name: 'Taylor R.',
    role: 'Online Coach',
    quote:
      'My entire lead-to-booking pipeline runs in Skillify. I just open my calendar and focus on calls.',
  },
  {
    name: 'Alex P.',
    role: 'Consultant',
    quote:
      'The AI follow-ups feel on-brand and natural. It’s like having a full-time SDR that never sleeps.',
  },
]

const stats = [
  {
    icon: Clock,
    label: 'Automated reminders',
    description:
      'Reduce no-shows with multi-channel reminders and smart reschedules.',
  },
  {
    icon: Sparkles,
    label: 'AI-qualified leads',
    description:
      'Let AI ask the right questions before calls, so your calendar only fills with buyers.',
  },
  {
    icon: BarChart3,
    label: 'Performance analytics',
    description:
      'See which automations actually drive revenue — not just clicks.',
  },
]

export default function MarketingHomePage() {
  return (
    <main className="bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HERO */}
      <section className="px-6 pb-24 pt-24 lg:pb-32 lg:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.3fr,1fr]">
          {/* LEFT */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50/70 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AI-powered automations for modern service businesses
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Automate calendars, follow-ups, and content in one workspace.
            </h1>

            <p className="mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Skillify saves businesses hours every week by automating
              scheduling, client communication, and content — while keeping
              everything organized across workspaces.
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
                Cancel anytime
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Built for agencies & operators
              </div>
            </div>
          </div>

          {/* RIGHT: Mock dashboard */}
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
                  {highlights.map((item) => (
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
                <div className="mt-2 space-y-2">
                  {[
                    'New lead ➝ AI email + SMS follow-up',
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

      {/* SOCIAL PROOF */}
      <section className="border-t border-zinc-200/70 py-10 dark:border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
            BUILT FOR MODERN SERVICE BUSINESSES
          </p>
          <div className="grid grid-cols-2 gap-6 text-center text-xs text-zinc-400 sm:grid-cols-4 sm:text-sm md:grid-cols-6">
            {industries.map((item) => (
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

      {/* FEATURE STRIP */}
      <section className="bg-zinc-50 py-20 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          {quickFeatures.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIAL PREVIEW */}
      <section className="border-t border-zinc-200/70 bg-white py-20 dark:border-zinc-800/70 dark:bg-black">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-8 flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
            <div>
              <h2 className="text-2xl font-semibold">
                Teams already running on Skillify
              </h2>
              <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
                Skillify replaces a patchwork of tools — schedulers, CRMs, and
                autoresponders — with a single, automation-first workspace.
              </p>
            </div>
            <Link
              href="/marketing/testimonials"
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700"
            >
              View more stories
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="mb-3 flex items-center gap-1 text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <p className="flex-1 text-sm text-zinc-700 dark:text-zinc-300">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">
                    {t.name}
                  </div>
                  <div>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="border-t border-zinc-200/70 bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-900 py-20 text-zinc-50 dark:border-zinc-800/70">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-3xl font-semibold">
            Turn missed opportunities into booked, qualified calls.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-300">
            Start with a free workspace, wire up your calendars and channels,
            and let Skillify handle the busywork while you focus on calls and
            clients.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/40 transition hover:bg-blue-700"
            >
              Get started in minutes
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/marketing/demo"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-500/60 px-6 py-3 text-sm text-zinc-100 transition hover:bg-zinc-800"
            >
              Book a live walkthrough
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
