// components/marketing/CTASection.tsx

'use client'

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function CTASection() {
  return (
    <section className="bg-zinc-900 py-16 text-zinc-50">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 text-center">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Ready to see Skillify in your funnel?
        </h2>
        <p className="max-w-xl text-sm text-zinc-400">
          Book an enterprise walkthrough and we’ll map your current lead flow
          into Skillify in the first call.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/marketing/demo"
            className="inline-flex items-center gap-2 rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-600"
          >
            Book a demo
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/marketing/enterprise#consult"
            className="text-sm text-zinc-300 underline-offset-4 hover:underline"
          >
            Talk to our team about enterprise
          </Link>
        </div>
      </div>
    </section>
  )
}
