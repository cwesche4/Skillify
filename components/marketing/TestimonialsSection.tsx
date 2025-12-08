// components/marketing/TestimonialsSection.tsx

'use client'

type Testimonial = {
  quote: string
  name: string
  role: string
  company: string
}

const testimonials: Testimonial[] = [
  {
    quote:
      'Skillify gave us a unified view of demos, onboarding, and renewals — without forcing reps to change how they work.',
    name: 'Danielle P.',
    role: 'Head of Revenue Operations',
    company: 'GrowthLoop',
  },
  {
    quote:
      'Our team stopped babysitting calendars. We just show up to calls and Skillify handles the rest.',
    name: 'Mike L.',
    role: 'Founder',
    company: 'LaunchStreet',
  },
  {
    quote:
      'The AI scoring is scarily accurate. We prioritize the right accounts instead of arguing about them.',
    name: 'Priya R.',
    role: 'Director of Sales',
    company: 'SignalWave',
  },
]

export function TestimonialsSection() {
  return (
    <section className="bg-zinc-50 py-20 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Teams that automate with Skillify move faster.
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {testimonials.map((t) => (
            <figure
              key={t.name}
              className="flex h-full flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 text-sm shadow-sm dark:border-zinc-800 dark:bg-black"
            >
              <p className="text-zinc-700 dark:text-zinc-200">“{t.quote}”</p>
              <figcaption className="mt-4 text-xs text-zinc-500">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  {t.name}
                </div>
                <div>
                  {t.role}, {t.company}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
