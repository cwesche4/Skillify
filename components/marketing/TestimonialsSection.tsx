// components/marketing/TestimonialsSection.tsx

'use client'

type Testimonial = {
  quote: string
  name: string
  role: string
  company: string
}

// Verified customer quotes will be added after the controlled-launch cohort.
const testimonials: Testimonial[] = []

export function TestimonialsSection() {
  return (
    <section className="bg-zinc-50 py-20 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Verified customer evidence is coming after the launch cohort.
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
          {testimonials.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No verified customer testimonials are published yet.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
