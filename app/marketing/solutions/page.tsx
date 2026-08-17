const verticals = [
  {
    name: 'Lawn & Landscaping',
    outcome:
      'Keep leads, estimates, recurring services, crews, and jobs organized.',
    bullets: [
      'New inquiry -> estimate or site visit',
      'Convert accepted work to a customer record',
      'Schedule recurring or one-time jobs',
    ],
  },
  {
    name: 'Plumbing & HVAC',
    outcome:
      'Move calls from inquiry to scheduled service without losing follow-ups.',
    bullets: [
      'New lead -> customer',
      'Diagnostic or estimate visit',
      'Schedule technician and follow-up',
    ],
  },
  {
    name: 'Electrical & Home Services',
    outcome:
      'Track customers, jobs, scheduling, and next steps from one workspace.',
    bullets: [
      'Customer request -> job scope',
      'Assign the right team member',
      'Keep notes, tasks, and status connected',
    ],
  },
  {
    name: 'Cleaning & Field Services',
    outcome:
      'Manage repeat customers, recurring jobs, assignments, and schedules.',
    bullets: [
      'Repeat customer -> recurring service',
      'Route work by team or location',
      'Track job completion and follow-up',
    ],
  },
]

export default function SolutionsPage() {
  return (
    <main className="bg-white dark:bg-black">
      <section className="px-6 pb-10 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Built for service businesses that run on customers, crews, and
            schedules.
          </h1>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Skillify helps local and field-service teams manage customer
            requests, scheduled work, recurring services, assignments, and
            operational follow-up from one workspace.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 md:grid-cols-2">
        {verticals.map((v) => (
          <div
            key={v.name}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 transition hover:border-blue-200 hover:bg-blue-50/20 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none dark:hover:border-blue-500/30"
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
