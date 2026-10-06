// components/marketing/ComparisonSection.tsx

'use client'

const points = [
  {
    label: 'Fragmented tools',
    skillify: 'One workspace for customers, jobs, schedules, and follow-ups',
    legacy: 'Multiple point tools stitched together',
  },
  {
    label: 'Lead qualification',
    skillify: 'Structured intake for management review',
    legacy: 'Manual spreadsheet and gut feel',
  },
  {
    label: 'Calendar routing',
    skillify: 'Assignment-aware work and schedule views',
    legacy: 'Shared inbox chaos',
  },
  {
    label: 'Follow-ups',
    skillify: 'Durable tasks and supported in-app notifications',
    legacy: 'Forgotten tasks and sticky notes',
  },
]

export function ComparisonSection() {
  return (
    <section className="bg-zinc-50 py-20 dark:bg-zinc-900">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Skillify vs fragmented tool stacks.
        </h2>
        <p className="mt-3 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Most teams spread customer and field work across disconnected tools.
          Skillify brings operational records and attention into one workspace.
        </p>

        <div className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white text-sm dark:border-zinc-800 dark:bg-zinc-950">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            <thead className="bg-zinc-50/80 text-zinc-500 dark:bg-zinc-900/80">
              <tr>
                <th className="px-4 py-3">Area</th>
                <th className="px-4 py-3 text-blue-600">Skillify</th>
                <th className="px-4 py-3 text-zinc-500">Legacy stack</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, idx) => (
                <tr
                  key={p.label}
                  className={
                    idx % 2 === 0
                      ? 'bg-white dark:bg-zinc-950'
                      : 'bg-zinc-50 dark:bg-zinc-900'
                  }
                >
                  <td className="px-4 py-3 text-zinc-500">{p.label}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {p.skillify}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {p.legacy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
