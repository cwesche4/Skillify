import { Check } from 'lucide-react'

const sections = [
  {
    title: 'Automation Builder',
    body: 'Visual, node-based builder with triggers, delays, webhooks, and AI nodes.',
    bullets: [
      'Drag-and-drop node builder',
      'Triggers, delays, webhooks',
      'Auto-layout and grouping',
      'Branching and OR paths',
    ],
  },
  {
    title: 'AI Engine',
    body: 'AI nodes for copy, routing, scoring, and smart decision-making.',
    bullets: [
      'LLM nodes for copy & replies',
      'Classifier nodes for routing',
      'Splitter nodes for audience logic',
      'AI Coach suggestions in-builder',
    ],
  },
  {
    title: 'Analytics & Heatmaps',
    body: 'See where automations win or fail, so you can fix issues fast.',
    bullets: [
      'Run success/failure breakdowns',
      'Node-level heatmaps',
      'Time-to-completion metrics',
      'AI-powered optimization tips',
    ],
  },
  {
    title: 'Content & Campaigns',
    body: 'Templates and automations for follow-ups, drips, and content workflows.',
    bullets: [
      'Campaign templates',
      'Onboarding journeys',
      'Review & testimonial flows',
      'Reusable snippets',
    ],
  },
]

export default function FeaturesPage() {
  return (
    <main className="bg-white dark:bg-black">
      <section className="px-6 pb-12 pt-20">
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Everything you need to automate your operations.
          </h1>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
            From first touch to ongoing nurture, Skillify gives you the builder,
            AI, and analytics to create reliable automations that actually match
            your business.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 md:grid-cols-2">
        {sections.map((section) => (
          <div
            key={section.title}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
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
