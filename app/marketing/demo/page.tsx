// app/marketing/demo/page.tsx

'use client'

import { useState } from 'react'
import { ArrowRight, Calendar } from 'lucide-react'

type Step = 1 | 2 | 3 | 4

type DemoState = 'idle' | 'submitting' | 'success' | 'error'

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
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          Book an Enterprise Strategy Demo
        </h1>
        <p className="mb-10 text-sm text-zinc-600 dark:text-zinc-400">
          Share a bit about your team and choose a time. We’ll qualify the
          request instantly and route it to the right automation specialist.
        </p>

        {/* Steps indicator */}
        <ol className="mb-8 flex items-center justify-between text-xs text-zinc-500">
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
                    : 'border-zinc-300 bg-white text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900',
                ].join(' ')}
              >
                {s.id}
              </div>
              <span className="ml-2 text-[11px] uppercase tracking-[0.16em]">
                {s.label}
              </span>
              {s.id !== 4 && (
                <div
                  className="ml-2 h-px flex-1 bg-zinc-200 dark:bg-zinc-800"
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
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Work email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Company name"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />

            <button
              type="button"
              disabled={!canGoNextFromStep1}
              onClick={() => setStep(2)}
              className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
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
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Team size (e.g. 5 AEs, 3 CSMs)"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />

            <textarea
              className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="What are you trying to fix or improve in the next 90 days?"
              rows={5}
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
            />

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-full border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!canGoNextFromStep2}
                onClick={() => setStep(3)}
                className="flex-1 rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-blue-700 disabled:opacity-60"
              >
                Continue
              </button>
            </div>
          </form>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-5 text-sm">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <Calendar className="h-4 w-4" />
              Choose a time that works for you
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Preferred date
                </label>
                <input
                  type="date"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">
                  Time (your timezone)
                </label>
                <input
                  type="time"
                  className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="flex-1 rounded-full border border-zinc-300 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!form.date || !form.time || status === 'submitting'}
                onClick={handleSubmit}
                className="flex-1 rounded-full bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-60"
              >
                {status === 'submitting' ? 'Booking...' : 'Confirm Booking'}
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
              so we can jump straight into recommendations.
            </p>
            <a
              href="/marketing/enterprise"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 underline underline-offset-2 dark:text-emerald-200"
            >
              Back to Enterprise overview
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    </main>
  )
}
