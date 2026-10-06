'use client'

import { useState } from 'react'

export default function DemoBookingForm() {
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: any) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const form = new FormData(e.target)
    const data = Object.fromEntries(form)

    try {
      const response = await fetch('/api/scheduler/create-booking', {
        method: 'POST',
        body: JSON.stringify({
          workspaceId: 'public',
          bookingTypeId: 'demo-call',
          ...data,
          start: data.time,
          end: data.time,
          source: 'marketing-demo',
        }),
      })

      if (!response.ok) throw new Error('Unable to record the demo request.')
      setSubmitted(true)
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to record the demo request.',
      )
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center">
        <h2 className="text-2xl font-semibold">Demo request recorded</h2>
        <p className="mt-2 text-zinc-500">
          This preview does not send an external email or calendar invitation.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <label className="text-sm font-medium">Your Name</label>
        <input
          name="name"
          className="mt-1 w-full rounded-md border p-2"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Email</label>
        <input
          name="email"
          type="email"
          className="mt-1 w-full rounded-md border p-2"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium">Business Size</label>
        <select name="size" className="mt-1 w-full rounded-md border p-2">
          <option>1–3</option>
          <option>4–10</option>
          <option>11–50</option>
          <option>50+</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium">Choose a time</label>
        <input
          name="time"
          type="datetime-local"
          className="mt-1 w-full rounded-md border p-2"
          required
        />
      </div>

      <button
        disabled={loading}
        className="w-full rounded-full bg-blue-600 py-3 font-semibold text-white"
      >
        {loading ? 'Booking…' : 'Book Demo'}
      </button>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  )
}
