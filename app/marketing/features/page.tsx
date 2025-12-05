export default function FeaturesPage() {
  const sections = [
    {
      label: "Automations",
      title: "AI follow-ups that work while you sleep.",
      body: "Skillify captures every lead, missed call, and no-show. It sends on-brand messages across SMS, email, and more—so you never lose a conversation because someone got busy.",
      bullets: [
        "Instant follow-up sequences for new leads",
        "Missed call → send booking link automatically",
        "No-show detection with reschedule prompts",
        "Conditional logic based on replies and tags",
      ],
    },
    {
      label: "Calendars",
      title: "Calendars that manage themselves.",
      body: "Stop manually chasing people to confirm, reschedule, or cancel. Skillify runs the rules in the background so your calendar always reflects reality.",
      bullets: [
        "Automated reminders & confirmations",
        "Smart rescheduling flows when people reply",
        "Time zone awareness by default",
        "Multiple calendars per workspace",
      ],
    },
    {
      label: "Content",
      title: "An AI content engine tuned to each business.",
      body: "Generate posts, campaigns, scripts, and nurture flows that sound like the brand—not a generic template.",
      bullets: [
        "Brand tone profiles per workspace",
        "Ready-to-post social content",
        "Email & SMS campaign drafts",
        "Templates for launches, promos, and nurturing",
      ],
    },
    {
      label: "Workspaces",
      title: "Multi-workspace by design.",
      body: "Run multiple brands, clients, or locations from one Skillify account, without mixing data or confusing your team.",
      bullets: [
        "Isolated workspaces for each brand or client",
        "Workspace members & role permissions",
        "Switch between workspaces in one click",
        "Perfect for agencies and multi-location brands",
      ],
    },
  ]

  return (
    <div className="px-6 pb-28 pt-24">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-semibold tracking-tight">
            Built for operators who hate busywork.
          </h1>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Skillify combines automations, calendars, and AI content into a single,
            opinionated system—so you can focus on growth, not admin.
          </p>
        </div>

        <div className="space-y-16">
          {sections.map((section) => (
            <section
              key={section.label}
              className="grid items-start gap-10 md:grid-cols-[1.1fr,0.9fr]"
            >
              <div>
                <p className="mb-2 text-xs uppercase tracking-[0.24em] text-zinc-500">
                  {section.label}
                </p>
                <h2 className="text-2xl font-semibold">{section.title}</h2>
                <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                  {section.body}
                </p>
                <ul className="mt-5 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {section.bullets.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Placeholder visual / card stack */}
              <div className="relative">
                <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-blue-500/15 via-indigo-500/10 to-sky-400/15 blur-3xl" />
                <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950/90">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{section.label} flow</span>
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                      If <span className="font-medium">new lead created</span> → send
                      welcome message
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                      If <span className="font-medium">no reply in 2h</span> → follow-up
                      with booking link
                    </div>
                    <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/70">
                      If <span className="font-medium">booked</span> → stop sequence &
                      send confirmation
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] text-zinc-500">
                    Replace manual tasks with rules that run 24/7—without needing an
                    engineer on your team.
                  </p>
                </div>
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
