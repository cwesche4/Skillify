const verticals = [
  {
    name: 'Marketing & Growth Agencies',
    outcome: 'Capture, qualify, and book more clients on autopilot.',
    bullets: [
      'Lead capture → auto nurture sequences',
      'Missed call → SMS + booking link',
      'Cold outbound follow-ups on schedule',
    ],
  },
  {
    name: 'Coaches & Consultants',
    outcome: 'Spend more time coaching, less time chasing reschedules.',
    bullets: [
      'New lead → discovery call booking',
      'No-show → automated reschedule flow',
      'Onboarding → welcome + prep materials',
    ],
  },
  {
    name: 'Studios, Salons & Local Services',
    outcome: 'Keep calendars full without manually texting clients.',
    bullets: [
      'Appointment reminders and confirmations',
      'Review and referral requests post-visit',
      'Win-back campaigns for inactive clients',
    ],
  },
  {
    name: 'Productized Services & Ops Teams',
    outcome: 'Orchestrate async work across tools and channels.',
    bullets: [
      'Webhook triggers from your app/CRM',
      'Task routing to the right team member',
      'Slack alerts for failures or VIP events',
    ],
  },
]

export default function SolutionsPage() {
  return (
    <main className="bg-white dark:bg-black">
      <section className="px-6 pb-10 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Built for operators across industries.
          </h1>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Skillify works wherever you have clients, calendars, and follow-ups.
            Plug it into your stack and design flows around your exact
            operations.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 md:grid-cols-2">
        {verticals.map((v) => (
          <div
            key={v.name}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <h2 className="text-lg font-semibold">{v.name}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {v.outcome}
            </p>
            <ul className="mt-4 list-disc space-y-1 pl-4 text-sm text-zinc-600 dark:text-zinc-300">
              {v.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  )
}
