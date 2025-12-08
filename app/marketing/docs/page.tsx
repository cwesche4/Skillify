import Link from 'next/link'

const steps = [
  {
    title: '1. Create your Skillify account',
    body: 'Sign up with email or your existing auth provider. You’ll land in your first workspace automatically.',
  },
  {
    title: '2. Set up your first workspace',
    body: 'Name the workspace after your business or client. Connect your calendar and messaging channels if available.',
  },
  {
    title: '3. Turn your existing process into flows',
    body: 'List how you currently handle leads, bookings, and follow-ups. Then recreate that as simple automation rules inside Skillify.',
  },
  {
    title: '4. Invite your team (optional)',
    body: 'Add teammates or clients with the right roles. Limit access to only the workspaces and data they need.',
  },
]

export default function DocsPage() {
  return (
    <div className="px-6 pb-28 pt-24">
      <div className="mx-auto max-w-4xl">
        <p className="mb-3 text-xs uppercase tracking-[0.25em] text-zinc-500">
          Documentation
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Getting started with Skillify
        </h1>
        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          Skillify is designed to be powerful enough for agencies but simple
          enough for solo operators. This page walks you through the first setup
          steps so you can ship value in under an hour.
        </p>

        <div className="mt-10 space-y-8">
          {steps.map((step) => (
            <section key={step.title}>
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {step.body}
              </p>
            </section>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-300">
          <h2 className="mb-2 text-base font-semibold">
            Connecting Skillify to your product
          </h2>
          <p>
            Under the hood, Skillify works with a multi-workspace model. Each
            workspace can have members, automations, runs, and subscriptions.
            Once your dashboard is wired to Prisma, you can use these models to
            power:
          </p>
          <ul className="mt-3 list-inside list-disc space-y-1">
            <li>Workspace switcher in your app shell</li>
            <li>Per-workspace automation settings and templates</li>
            <li>Audit logs of automation runs</li>
            <li>Role-based access per workspace member</li>
          </ul>
          <p className="mt-3">
            When you’re ready, you can add billing on top (Stripe or another
            provider) to control which features are available per plan.
          </p>
        </div>

        <div className="mt-8 flex items-center justify-between text-sm text-zinc-500 dark:text-zinc-400">
          <span>Need a deeper technical guide?</span>
          <Link
            href="#"
            className="text-blue-600 hover:underline dark:text-blue-400"
          >
            Contact support
          </Link>
        </div>
      </div>
    </div>
  )
}
