import { Check } from 'lucide-react'

const sections = [
  {
    title: 'Customers & CRM',
    body: 'Keep leads, customers, follow-ups, notes, and connected records organized around the way your business works.',
    bullets: [
      'Leads and customer records',
      'Business-model-specific pipelines',
      'Follow-ups, notes, and next actions',
      'Connected customer lifecycle context',
    ],
  },
  {
    title: 'Jobs & Operations',
    body: 'Turn customer work into jobs, assignments, and clear next steps your team can follow.',
    bullets: [
      'Jobs and team assignments',
      'Tasks and next-step tracking',
      'Assignments and status visibility',
      'Support recurring service work',
    ],
  },
  {
    title: 'Scheduling',
    body: 'Coordinate appointments, jobs, recurring services, event types, and team availability from one calendar system.',
    bullets: [
      'Day, Week, Month, and Agenda views',
      'Appointments and scheduled jobs',
      'Recurring services and event types',
      'Team availability and working hours',
    ],
  },
  {
    title: 'Automations',
    body: 'Use guided Simple Automations for the supported reminders, follow-ups, and internal updates that keep work moving.',
    bullets: [
      'Guided Simple Automation setup',
      'Internal lead and schedule notifications',
      'Appointment and estimate follow-up workflows',
      'Manager-facing lifecycle and execution history',
    ],
  },
  {
    title: 'Analytics & Reporting',
    body: 'See supported operational metrics, attention queues, workflow health, and job activity without treating preview financial reports as business records.',
    bullets: [
      'Operational dashboard metrics',
      'Management attention queues',
      'Manager-facing workflow health',
      'Customer and job activity',
    ],
  },
  {
    title: 'Workspace AI',
    body: 'Evaluate AI-assisted workspace features only where they are explicitly enabled and supported during the controlled launch.',
    bullets: [
      'Workspace context foundation',
      'Human-reviewed recommendations where enabled',
      'Management-controlled AI actions',
      'Capability-based availability',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <main className="bg-white dark:bg-black">
      <section className="px-6 pb-12 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            One workspace for customers, work, scheduling, automation, and
            insights.
          </h1>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            Skillify gives growing service businesses the core systems to manage
            customer work, coordinate the team, automate repetitive steps, and
            understand what needs attention.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 md:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-md shadow-slate-200/60 transition hover:border-blue-200 hover:bg-blue-50/20 dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-none dark:hover:border-blue-500/30"
          >
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {section.body}
            </p>

            <ul className="mt-4 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
              {section.bullets.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-blue-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>
    </main>
  )
}
