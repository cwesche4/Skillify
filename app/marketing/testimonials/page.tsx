// app/marketing/testimonials/page.tsx

import Link from 'next/link'
import { ArrowRight, Star } from 'lucide-react'

const testimonials = [
  {
    name: 'Jordan M.',
    role: 'Founder, Pipeline Labs',
    quote:
      'We were juggling four tools for leads, reminders, and content. Skillify gave us one place to control the entire funnel.',
  },
  {
    name: 'Amira K.',
    role: 'Owner, AK Creative Studio',
    quote:
      'No-shows used to wreck my weeks. With automated reminders and reschedules, my calendar actually reflects my revenue.',
  },
  {
    name: 'Daniel R.',
    role: 'Head of Growth, RevScale',
    quote:
      'Our SDRs now start every day with pre-qualified, warmed-up leads. Skillify handles the boring parts of follow-up.',
  },
  {
    name: 'Sara L.',
    role: 'Coach & Course Creator',
    quote:
      'The AI responses sound like me, not a robot. I get DMs from people saying they “can’t believe” I reply so fast.',
  },
  {
    name: 'Chris T.',
    role: 'Consultant',
    quote:
      'We layered Skillify on top of our existing stack instead of ripping it out. It quietly runs in the background and moves revenue.',
  },
  {
    name: 'Maya P.',
    role: 'Agency Operator',
    quote:
      "Each client workspace is tailored to their funnel, but our team has a unified view. That wasn't possible before.",
  },
]

export default function TestimonialsPage() {
  return (
    <main className="min-h-screen bg-white text-zinc-900 dark:bg-black dark:text-zinc-50">
      {/* HEADER */}
      <section className="px-6 pb-10 pt-20">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
            SOCIAL PROOF
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            What teams say after moving to Skillify.
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
            The consistent theme: less manual follow-up, fewer no-shows, and
            more time spent on calls that actually matter.
          </p>
        </div>
      </section>

      {/* GRID */}
      <section className="pb-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t) => (
              <article
                key={t.name}
                className="flex flex-col rounded-2xl border border-zinc-200 bg-zinc-50 p-5 text-sm dark:border-zinc-800 dark:bg-zinc-950"
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
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Curious if Skillify fits your use case? Let&apos;s walk through a
              live example based on your funnel.
            </span>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/marketing/demo"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-blue-700"
              >
                Book a live demo
                <ArrowRight className="h-3 w-3" />
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100 dark:hover:bg-zinc-900"
              >
                Start a free workspace
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
