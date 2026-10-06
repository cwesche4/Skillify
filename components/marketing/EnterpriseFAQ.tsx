// components/marketing/EnterpriseFAQ.tsx

'use client'

const faqs = [
  {
    q: 'Can we connect our existing HubSpot or Salesforce?',
    a: 'External CRM synchronization is not part of the controlled-launch promise and must be scoped and verified separately.',
  },
  {
    q: 'How does pricing work for larger teams?',
    a: 'Enterprise pricing is based on seats, workspaces, and usage. We’ll model a plan around your team structure and expected volume.',
  },
  {
    q: 'What is the implementation timeline?',
    a: 'Implementation timing depends on the verified controlled-launch scope. The walkthrough identifies supported workflows before any timeline is proposed.',
  },
  {
    q: 'Do you offer done-for-you buildouts?',
    a: 'The controlled launch focuses on currently supported operational workflows. Any additional buildout is scoped separately and is not represented as available by default.',
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
