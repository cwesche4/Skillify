// app/marketing/demo/page.tsx

'use client'

import { useState } from 'react'
import { ArrowRight, Calendar } from 'lucide-react'

type Step = 1 | 2 | 3 | 4

type DemoState = 'idle' | 'submitting' | 'success' | 'error'

const demoInputClassName =
  'w-full rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-950 shadow-inner shadow-slate-200/40 outline-none transition placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-400 dark:shadow-none dark:focus:border-blue-400 dark:focus:ring-blue-400/20'

const demoLabelClassName =
  'mb-1 block text-xs font-medium text-slate-600 dark:text-zinc-300'

const demoPrimaryButtonClassName =
  'inline-flex items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-sm shadow-blue-600/30 transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:focus:ring-offset-black dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400'

const demoSecondaryButtonClassName =
  'rounded-full border border-slate-300 py-2.5 text-sm font-medium text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-blue-500/50 dark:hover:bg-blue-500/10 dark:hover:text-blue-200 dark:focus:ring-offset-black'

export default function EnterpriseDemoPage() {
  const [step, setStep] = useState<Step>(1)
  const [status, setStatus] = useState<DemoState>('idle')
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    size: '',
    problem: '',
    date: '',
    time: '09:00',
  })

  async function handleSubmit() {
    setStatus('submitting')
    setError(null)

    try {
      if (!form.date || !form.time) {
        throw new Error('Please choose a date and time.')
      }

      const startIso = new Date(`${form.date}T${form.time}:00`).toISOString()

      const res = await fetch('/api/enterprise/demo-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingTypeSlug: 'enterprise-demo',
          guestName: form.name,
          guestEmail: form.email,
          answers: {
            companyName: form.company,
            teamSize: form.size,
            mainGoal: form.problem,
          },
          start: startIso,
          // end will be computed from BookingType.durationMinutes
          source: 'public-demo-page',
        }),
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Something went wrong booking your demo.')
      }

      setStatus('success')
      setStep(4)
    } catch (err: any) {
      console.error(err)
      setError(err.message ?? 'Failed to book demo')
      setStatus('error')
    }
  }

  const canGoNextFromStep1 = form.name && form.email && form.company
  const canGoNextFromStep2 = form.size && form.problem

  return (
    <main className="min-h-screen bg-white px-6 py-20 text-zinc-900 dark:bg-black dark:text-zinc-50">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.85fr,1.15fr] lg:items-start">
        <aside className="space-y-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-blue-600">
              See how Skillify fits your business
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Book a Skillify walkthrough
            </h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              See how Skillify fits your customer acquisition, jobs, scheduling,
              automation, and operations visibility.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm shadow-md shadow-slate-200/60 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
            <h2 className="text-sm font-semibold">What we can review</h2>
            <ul className="mt-4 space-y-3 text-zinc-600 dark:text-zinc-300">
              {[
                'Customer acquisition flow',
                'Jobs and scheduling',
                'Automations and handoffs',
                'See what needs attention across the business',
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-md shadow-slate-200/60 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none">
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-3 dark:border-zinc-800">
              <span className="font-medium uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                Operations overview
              </span>
              <span className="text-emerald-500">Live</span>
            </div>
            <div className="space-y-2">
              {[
                'New inquiry captured',
                'Estimate visit scheduled',
                'Recurring service assigned',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <span className="text-zinc-600 dark:text-zinc-300">
                    {item}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/70 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none sm:p-8">
          {/* Steps indicator */}
          <ol className="mb-8 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-300">
            {[
              { id: 1, label: 'Basics' },
              { id: 2, label: 'Context' },
              { id: 3, label: 'Scheduling' },
              { id: 4, label: 'Confirmation' },
            ].map((s) => (
              <li key={s.id} className="flex flex-1 items-center">
                <div
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded-full border text-[11px]',
                    step >= (s.id as Step)
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-slate-50 text-slate-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300',
                  ].join(' ')}
                >
                  {s.id}
                </div>
                <span className="ml-2 text-[11px] uppercase tracking-[0.16em]">
                  {s.label}
                </span>
                {s.id !== 4 && (
                  <div
                    className="ml-2 h-px flex-1 bg-slate-200 dark:bg-zinc-800"
                    aria-hidden="true"
                  />
                )}
              </li>
            ))}
          </ol>

          {/* Step 1 */}
          {step === 1 && (
            <form className="space-y-5 text-sm">
              <input
                className={demoInputClassName}
                placeholder="Full name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />

              <input
                className={demoInputClassName}
                placeholder="Work email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />

              <input
                className={demoInputClassName}
                placeholder="Company name"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
              />

              <button
                type="button"
                disabled={!canGoNextFromStep1}
                onClick={() => setStep(2)}
                className={`mt-2 w-full ${demoPrimaryButtonClassName}`}
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <form className="space-y-5 text-sm">
              <input
                className={demoInputClassName}
                placeholder="Team size (e.g. 4 technicians, 2 office staff)"
                value={form.size}
                onChange={(e) => setForm({ ...form, size: e.target.value })}
              />

              <textarea
                className={demoInputClassName}
                placeholder="What are you trying to fix or improve in the next 90 days?"
                rows={5}
                value={form.problem}
                onChange={(e) => setForm({ ...form, problem: e.target.value })}
              />

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className={`flex-1 ${demoSecondaryButtonClassName}`}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!canGoNextFromStep2}
                  onClick={() => setStep(3)}
                  className={`flex-1 ${demoPrimaryButtonClassName}`}
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div className="space-y-5 text-sm">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-zinc-300">
                <Calendar className="h-4 w-4" />
                Choose a time that works for you
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={demoLabelClassName}>Preferred date</label>
                  <input
                    type="date"
                    className={demoInputClassName}
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className={demoLabelClassName}>
                    Time (your timezone)
                  </label>
                  <input
                    type="time"
                    className={demoInputClassName}
                    value={form.time}
                    onChange={(e) => setForm({ ...form, time: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className={`flex-1 ${demoSecondaryButtonClassName}`}
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!form.date || !form.time || status === 'submitting'}
                  onClick={handleSubmit}
                  className={`flex-1 ${demoPrimaryButtonClassName}`}
                >
                  {status === 'submitting'
                    ? 'Booking...'
                    : 'Confirm walkthrough'}
                </button>
              </div>

              {error && <p className="text-xs text-red-500">{error}</p>}
            </div>
          )}

          {/* Step 4 – Confirmation */}
          {step === 4 && status === 'success' && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-50 px-5 py-6 text-sm text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-50">
              <p className="font-semibold">You’re booked in 🎯</p>
              <p className="mt-2 text-xs text-emerald-900/80 dark:text-emerald-100/80">
                We’ve sent a calendar invite and confirmation to{' '}
                <strong>{form.email}</strong>. Our team will review your answers
                so we can jump straight into a useful walkthrough.
              </p>
              <a
                href="/marketing/pricing"
                className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-2 dark:text-emerald-200"
              >
                Back to pricing
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
