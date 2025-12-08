'use client'

import { useState } from 'react'
import { ArrowRight } from 'lucide-react'

export default function EnterpriseDemoPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    size: '',
    problem: '',
  })

  return (
    <main className="min-h-screen bg-white px-6 py-20 dark:bg-black">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-4xl font-semibold">Book a Strategy Demo</h1>
        <p className="mb-10 text-zinc-600 dark:text-zinc-400">
          Tell us a bit about your team and choose a time. AI will pre-qualify
          your request instantly.
        </p>

        {step === 1 && (
          <form className="space-y-5">
            <input
              className="w-full rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />

            <input
              className="w-full rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Work email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />

            <input
              className="w-full rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Company name"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
            />

            <button
              onClick={() => setStep(2)}
              type="button"
              className="w-full rounded-full bg-blue-600 py-3 font-semibold text-white"
            >
              Next <ArrowRight className="ml-1 inline-block h-4 w-4" />
            </button>
          </form>
        )}

        {step === 2 && (
          <form className="space-y-5">
            <input
              className="w-full rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="Team size"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
            />

            <textarea
              className="w-full rounded-md border border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="What problem are you trying to solve?"
              rows={5}
              value={form.problem}
              onChange={(e) => setForm({ ...form, problem: e.target.value })}
            />

            <button
              onClick={() => setStep(3)}
              type="button"
              className="w-full rounded-full bg-blue-600 py-3 font-semibold text-white"
            >
              Continue to Scheduling
            </button>
          </form>
        )}

        {step === 3 && (
          <div>
            <p className="mb-4 text-sm text-zinc-500">
              Choose a time for your enterprise strategy call:
            </p>

            {/* Later: auto-pull availability from BookingType → AvailabilityWindow */}
            <div className="grid grid-cols-2 gap-4">
              {['10:00 AM', '12:30 PM', '3:00 PM', '5:00 PM'].map((t) => (
                <button
                  key={t}
                  className="rounded-lg border border-zinc-300 py-3 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  {t}
                </button>
              ))}
            </div>

            <button className="mt-8 w-full rounded-full bg-emerald-600 py-3 font-semibold text-white">
              Confirm Booking
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
