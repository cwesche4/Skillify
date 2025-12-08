// components/marketing/SocialProofRow.tsx

'use client'

export function SocialProofRow() {
  const logos = [
    'Agency collectives',
    'B2B SaaS teams',
    'Local service groups',
    'RevOps teams',
  ]

  return (
    <section className="border-t border-zinc-200/70 py-10 dark:border-zinc-800/70">
      <div className="mx-auto max-w-6xl px-6">
        <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
          TRUSTED BY MODERN GTM TEAMS
        </p>
        <div className="grid grid-cols-2 gap-6 text-center text-xs text-zinc-400 sm:grid-cols-4 sm:text-sm md:grid-cols-4">
          {logos.map((item) => (
            <div
              key={item}
              className="rounded-xl border border-dashed border-zinc-200/60 py-3 dark:border-zinc-800/80"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
