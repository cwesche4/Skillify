// app/marketing/enterprise/page.tsx

'use client'

import { useState } from 'react'
import {
  ArrowRight,
  Check,
  Calendar,
  PhoneCall,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { caseStudies } from '@/lib/marketing/caseStudies'

type DemoBookingFormState = 'idle' | 'submitting' | 'success' | 'error'

export default function EnterprisePage() {
  const [demoState, setDemoState] = useState<DemoBookingFormState>('idle')
  const [consultState, setConsultState] = useState<DemoBookingFormState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleDemoSubmit(formData: FormData) {
    setDemoState('submitting')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/enterprise/demo-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingTypeSlug: 'enterprise-demo',
          guestName: formData.get('name'),
          guestEmail: formData.get('email'),
          guestPhone: formData.get('phone') || undefined,
          start: formData.get('start'),
          end: formData.get('end'),
          answers: {
            companyName: formData.get('company'),
            teamSize: formData.get('teamSize'),
            mainGoal: formData.get('mainGoal'),
          },
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Something went wrong booking your demo.')
      }

      setDemoState('success')
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.message ?? 'Failed to book demo')
      setDemoState('error')
    }
  }

  async function handleConsultSubmit(formData: FormData) {
    setConsultState('submitting')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/enterprise/request-consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.get('name'),
          email: formData.get('email'),
          phone: formData.get('phone') || undefined,
          companySize: formData.get('companySize') || undefined,
          projectGoal: formData.get('projectGoal') || undefined,
          description: formData.get('description'),
          source: 'enterprise-page',
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(
          json.error ?? 'Something went wrong submitting your request.',
        )
      }

      setConsultState('success')
    } catch (err: any) {
      console.error(err)
      setErrorMessage(err.message ?? 'Failed to submit request')
      setConsultState('error')
    }
  }

  const primaryCaseStudy = caseStudies[0]

  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HERO */}
      <section className="border-b border-zinc-200/70 bg-gradient-to-b from-zinc-50 to-white px-6 pb-20 pt-24 dark:border-zinc-800/70 dark:from-black dark:to-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.5fr,1fr]">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-white/70 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              <span>Skillify Enterprise</span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" />
              <span>Built for operators, agencies & GTM teams</span>
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Enterprise-grade automations that you actually launch.
            </h1>

            <p className="mt-5 max-w-xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
              Skillify replaces fragmented tools with one automation workspace
              for your leads, follow-ups, calendars, and client-facing
              workflows. From strategy to launch, we build it with you — or for
              you.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#book-demo"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_32px_-12px_rgba(37,99,235,0.8)] transition hover:bg-blue-700"
              >
                Book a live demo
                <Calendar className="h-4 w-4" />
              </a>
              <a
                href="#consult"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-3 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Talk to our build team
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                No rip-and-replace required
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                AI lead qualification & routing
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                HubSpot-native pipeline tracking
              </div>
            </div>
          </div>

          {/* Right "Enterprise snapshot" */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-sky-400/10 blur-3xl" />
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white/90 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 text-xs dark:border-zinc-800/80">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">
                  Enterprise pipeline snapshot
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-500">
                  Live sync with HubSpot
                </span>
              </div>
              <div className="space-y-4 p-5 text-xs">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    {
                      label: 'Qualified demos',
                      value: '38',
                      note: 'last 30 days',
                    },
                    {
                      label: 'Avg. lead score',
                      value: '82',
                      note: 'AI-qualified',
                    },
                    {
                      label: 'Show-up rate',
                      value: '2.1x',
                      note: 'vs. previous',
                    },
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

                <div className="mt-2 space-y-2">
                  {[
                    'Website demo ➝ AI qualify ➝ HubSpot deal',
                    'Inbound form ➝ route to right AE',
                    'Missed call ➝ SMS + email follow-up',
                    'No-show ➝ auto-reschedule sequence',
                  ].map((rule) => (
                    <div
                      key={rule}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/70"
                    >
                      <span className="text-[11px] text-zinc-700 dark:text-zinc-200">
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

      {/* SOCIAL PROOF / STATS */}
      <section className="border-b border-zinc-200/70 bg-white py-14 dark:border-zinc-800/70 dark:bg-black">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
            TRUSTED BY TEAMS WHO RUN ON PIPELINES, NOT SPREADSHEETS
          </p>
          <div className="grid grid-cols-1 gap-8 text-center text-sm md:grid-cols-3">
            {[
              {
                label: 'Faster GTM automation launches',
                value: '3–5x',
                note: 'vs. internal-only',
              },
              {
                label: 'Manual ops work reduced',
                value: '50–80%',
                note: 'per pipeline',
              },
              {
                label: 'Increase in qualified demos',
                value: '30–70%',
                note: 'for GTM teams',
              },
            ].map((stat) => (
              <div key={stat.label} className="space-y-1">
                <div className="text-3xl font-semibold">{stat.value}</div>
                <div className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  {stat.label}
                </div>
                <div className="text-xs text-zinc-400">{stat.note}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CASE STUDY BLOCK */}
      <section className="bg-zinc-50 py-16 dark:bg-zinc-950">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-[1.4fr,1fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              CASE STUDY
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
              {primaryCaseStudy.title}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              {primaryCaseStudy.summary}
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-900 px-3 py-1 text-[11px] text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
              <span>{primaryCaseStudy.logoText}</span>
              <span className="h-[3px] w-[3px] rounded-full bg-zinc-400" />
              <span>{primaryCaseStudy.industry}</span>
            </div>

            <ul className="mt-6 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
              {primaryCaseStudy.challenges.slice(0, 2).map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-[6px] h-[6px] w-[6px] rounded-full bg-zinc-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <a
              href={`/marketing/case-studies/${primaryCaseStudy.slug}`}
              className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Read the full story
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-black">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              <Sparkles className="h-3 w-3" />
              <span>Key outcomes</span>
            </div>
            <div className="space-y-3">
              {primaryCaseStudy.results.map((r) => (
                <div
                  key={r.label}
                  className="flex items-baseline justify-between"
                >
                  <span className="text-xs text-zinc-500">{r.label}</span>
                  <span className="text-sm font-semibold">{r.value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-zinc-900 px-4 py-3 text-xs text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900">
              &ldquo;{primaryCaseStudy.quote.text}&rdquo;
              <div className="mt-2 text-[11px]">
                {primaryCaseStudy.quote.name} · {primaryCaseStudy.quote.role}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON + FEATURE HIGHLIGHTS */}
      <section className="border-t border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-[1.1fr,1.4fr]">
            {/* Comparison */}
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Skillify vs. stitching tools
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Instead of trying to bolt automations onto half a dozen tools,
                Skillify becomes the single command center that talks to your
                CRM, calendars, and channels.
              </p>
              <div className="mt-6 space-y-3 text-xs">
                <ComparisonRow
                  label="HubSpot pipeline sync"
                  skillify="Native lead + deal creation per flow"
                  other="Manual exports / brittle third-party zaps"
                />
                <ComparisonRow
                  label="Scheduling & reminders"
                  skillify="Models + flows tied to each booking type"
                  other="Ad-hoc Calendly embeds, no global logic"
                />
                <ComparisonRow
                  label="Missed call & no-show flows"
                  skillify="Opinionated templates with AI copy on top"
                  other="Custom scripts that break when team changes"
                />
                <ComparisonRow
                  label="Enterprise support"
                  skillify="Co-build + DFY options with GTM experts"
                  other="Patchwork of agencies and freelancers"
                />
              </div>
            </div>

            {/* Feature highlights */}
            <div className="grid gap-5 md:grid-cols-2">
              {[
                {
                  icon: PhoneCall,
                  title: 'Demo booking that actually qualifies',
                  body: 'AI scores leads, routes them to the right owner, and creates the deal in HubSpot in one pass.',
                },
                {
                  icon: Calendar,
                  title: 'Integrated scheduling logic',
                  body: 'Booking types, buffers, caps, and reminders are all modeled in your workspace — not hidden in a vendor.',
                },
                {
                  icon: ShieldCheck,
                  title: 'Guardrails for your GTM motion',
                  body: 'Opinionated defaults, with the flexibility to support your unique sales process.',
                },
                {
                  icon: Sparkles,
                  title: 'AI that explains what’s working',
                  body: 'Identify which flows produce the best meetings, fastest time-to-close, and healthiest pipeline.',
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="mb-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/10">
                    <f.icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* WHITEPAPER / PDF CTA */}
      <section className="bg-zinc-50 py-14 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            WHITEPAPER
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            The GTM Automation Playbook for Teams Beyond 7 Figures
          </h2>
          <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            A practical breakdown of how high-performing teams automate demo
            booking, lead routing, and post-call workflows across the entire
            funnel — without burning engineering cycles.
          </p>
          <a
            href="/assets/skillify-enterprise-playbook.pdf"
            className="inline-flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-xs font-semibold text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Download the PDF
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      {/* BOOK DEMO FUNNEL */}
      <section
        id="book-demo"
        className="border-t border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-black"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-[1.2fr,1.1fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Book an enterprise demo
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                We’ll walk through your current GTM flows, show how Skillify
                plugs into HubSpot and your calendars, and sketch the first
                version of your automation roadmap.
              </p>
              <ul className="mt-5 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <li className="flex gap-2">
                  <span className="mt-[7px] h-[6px] w-[6px] rounded-full bg-emerald-500" />
                  <span>
                    45–60 minutes with an operator who ships automations, not
                    just diagrams.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-[7px] h-[6px] w-[6px] rounded-full bg-emerald-500" />
                  <span>
                    Live view into flows, lead scoring, and dashboards that
                    match your pipeline.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="mt-[7px] h-[6px] w-[6px] rounded-full bg-emerald-500" />
                  <span>
                    No generic sales pitch. We use your ICP, offers, and
                    channels.
                  </span>
                </li>
              </ul>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <DemoBookingForm state={demoState} onSubmit={handleDemoSubmit} />
            </div>
          </div>

          {errorMessage && (
            <p className="mt-4 text-xs text-red-500">{errorMessage}</p>
          )}
        </div>
      </section>

      {/* ENTERPRISE CONSULT FORM */}
      <section
        id="consult"
        className="border-t border-zinc-200 bg-zinc-50 py-16 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-10 md:grid-cols-[1.1fr,1.3fr]">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Prefer a consult instead of a product tour?
              </h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                Share what you’re trying to solve, and our team will map the
                automation strategy, recommended flows, and rollout plan —
                including where Skillify plugs in vs. what stays in your current
                stack.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-black">
              <EnterpriseConsultForm
                state={consultState}
                onSubmit={handleConsultSubmit}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ENTERPRISE FAQ */}
      <section className="border-t border-zinc-200 bg-white py-16 dark:border-zinc-800 dark:bg-black">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-6 text-2xl font-semibold tracking-tight">
            Enterprise FAQ
          </h2>
          <div className="grid gap-6 text-sm text-zinc-600 dark:text-zinc-400 md:grid-cols-2">
            <FAQ
              q="Do we have to migrate our CRM?"
              a="No. Skillify plugs into your existing CRM (starting with HubSpot) and syncs leads, contacts, and deals as part of each flow. You keep your current pipeline while Skillify automates the work around it."
            />
            <FAQ
              q="Can your team build the flows for us?"
              a="Yes. For Enterprise, we offer co-build and DFY options. That can include building the flows, node logic, copy, and analytics dashboards — then handing over a system your team can own."
            />
            <FAQ
              q="How long does an enterprise rollout typically take?"
              a="Initial launch (core flows, demo booking, lead routing) commonly goes live in 2–6 weeks depending on scope. We scope it with you during the consult."
            />
            <FAQ
              q="What does pricing look like?"
              a="Enterprise includes platform seats + an implementation package. We’ll map your team size, complexity, and support needs on the call and then send a clear proposal."
            />
          </div>
        </div>
      </section>
    </main>
  )
}

/* --------------------------------------------------------
   Subcomponents
--------------------------------------------------------- */

function ComparisonRow({
  label,
  skillify,
  other,
}: {
  label: string
  skillify: string
  other: string
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="grid grid-cols-2 gap-3 text-[11px]">
        <div>
          <div className="mb-1 text-[10px] font-medium text-emerald-600">
            Skillify
          </div>
          <p className="text-zinc-700 dark:text-zinc-300">{skillify}</p>
        </div>
        <div>
          <div className="mb-1 text-[10px] font-medium text-zinc-400">
            Typical patchwork
          </div>
          <p className="text-zinc-500 dark:text-zinc-400">{other}</p>
        </div>
      </div>
    </div>
  )
}

function DemoBookingForm({
  state,
  onSubmit,
}: {
  state: DemoBookingFormState
  onSubmit: (formData: FormData) => Promise<void>
}) {
  const [date, setDate] = useState('')
  const [time, setTime] = useState('09:00')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)

    if (date && time) {
      const startIso = new Date(`${date}T${time}:00`).toISOString()
      const endIso = new Date(`${date}T${time}:00`).toISOString() // You can add duration via BookingType
      form.set('start', startIso)
      form.set('end', endIso)
    }

    await onSubmit(form)
  }

  if (state === 'success') {
    return (
      <div className="text-sm">
        <p className="font-semibold text-emerald-500">Your demo is booked.</p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          We’ve emailed you the details and will send a reminder before the
          call.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        <Calendar className="h-3 w-3" />
        <span>Book time with the team</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">Name</label>
          <input
            name="name"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">
            Company
          </label>
          <input
            name="company"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">
            Team size
          </label>
          <select
            name="teamSize"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          >
            <option value="1-5">1–5</option>
            <option value="6-20">6–20</option>
            <option value="21-50">21–50</option>
            <option value="51-200">51–200</option>
            <option value="200+">200+</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-[2fr,1fr] gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">
            What do you want to solve?
          </label>
          <textarea
            name="mainGoal"
            rows={3}
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div className="space-y-2">
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              Preferred date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-zinc-500">
              Time (your timezone)
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
      >
        {state === 'submitting' ? 'Booking...' : 'Book demo'}
        <ArrowRight className="h-3 w-3" />
      </button>
    </form>
  )
}

function EnterpriseConsultForm({
  state,
  onSubmit,
}: {
  state: DemoBookingFormState
  onSubmit: (formData: FormData) => Promise<void>
}) {
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    await onSubmit(form)
  }

  if (state === 'success') {
    return (
      <div className="text-sm">
        <p className="font-semibold text-emerald-500">Request received.</p>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          We’ll review your details and follow up with proposed times and a game
          plan.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-xs">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">Name</label>
          <input
            name="name"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">Email</label>
          <input
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">
            Phone (optional)
          </label>
          <input
            name="phone"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-500">
            Company size
          </label>
          <select
            name="companySize"
            className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
          >
            <option value="1-10">1–10</option>
            <option value="11-50">11–50</option>
            <option value="51-200">51–200</option>
            <option value="201-1000">201–1,000</option>
            <option value="1000+">1,000+</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-zinc-500">
          What are you trying to build or fix?
        </label>
        <textarea
          name="description"
          required
          rows={4}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
        />
      </div>

      <div>
        <label className="mb-1 block text-[11px] text-zinc-500">
          What would success look like 90 days from now?
        </label>
        <textarea
          name="projectGoal"
          rows={3}
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-900 outline-none ring-0 focus:border-blue-500 dark:border-zinc-700 dark:bg-black dark:text-zinc-50"
        />
      </div>

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-zinc-50 hover:bg-zinc-800 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-100"
      >
        {state === 'submitting'
          ? 'Submitting...'
          : 'Request enterprise consult'}
        <PhoneCall className="h-3 w-3" />
      </button>
    </form>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{q}</p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{a}</p>
    </div>
  )
}
