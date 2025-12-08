// components/marketing/EnterpriseFAQ.tsx

'use client'

const faqs = [
  {
    q: 'Can we connect our existing HubSpot or Salesforce?',
    a: 'Yes. Skillify is designed to sit on top of your CRM — not replace it. We can sync leads, contacts, deals, and demo outcomes back into your source of truth.',
  },
  {
    q: 'How does pricing work for larger teams?',
    a: 'Enterprise pricing is based on seats, workspaces, and usage. We’ll model a plan around your team structure and expected volume.',
  },
  {
    q: 'What is the implementation timeline?',
    a: 'Most teams go live with a production-ready funnel in 2–4 weeks, including mapping your existing forms, CRMs, and playbooks into Skillify.',
  },
  {
    q: 'Do you offer done-for-you buildouts?',
    a: 'Yes. Our team can design and implement your entire automation blueprint, including templates, scoring, and sequences.',
  },
]

export function EnterpriseFAQ() {
  return (
    <section className="border-t border-zinc-200 py-20 dark:border-zinc-800">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="mb-6 text-center text-2xl font-semibold tracking-tight sm:text-3xl">
          Enterprise questions, answered.
        </h2>
        <div className="space-y-6 text-sm text-zinc-600 dark:text-zinc-400">
          {faqs.map((item) => (
            <div key={item.q}>
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {item.q}
              </p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
