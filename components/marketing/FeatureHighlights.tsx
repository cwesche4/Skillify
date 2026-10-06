// components/marketing/FeatureHighlights.tsx

'use client'

import { Check } from 'lucide-react'

type FeatureItem = {
  label: string
  description: string
}

const features: FeatureItem[] = [
  {
    label: 'Structured customer intake',
    description:
      'Capture the right questions and give management the context needed to review the request.',
  },
  {
    label: 'Multi-workspace, role-aware access',
    description:
      'Separate workspaces where needed and use management roles or assignment-scoped Member views for supported operational work.',
  },
  {
    label: 'Connected operational records',
    description:
      'Keep customer, estimate, job, scheduling, and attention records connected inside Skillify.',
  },
]

export function FeatureHighlights() {
  return (
    <section className="border-t border-zinc-200 bg-white py-20 dark:border-zinc-800 dark:bg-black">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-10 md:grid-cols-[1.2fr,1fr]">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built for operators who own the funnel end-to-end.
            </h2>
            <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Skillify gives operators one place to coordinate customer,
              estimate, job, scheduling, and attention records.
            </p>
          </div>
          <div className="space-y-4 text-sm">
            {features.map((f) => (
              <div key={f.label} className="flex gap-3">
                <div className="mt-0.5">
                  <Check className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <div className="font-medium">{f.label}</div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {f.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
