import { ArrowRight, Check } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <>
      {/* HERO */}
      <section className="px-6 pb-24 pt-24 lg:pb-32 lg:pt-32">
        <div className="mx-auto grid max-w-6xl items-center gap-16 lg:grid-cols-[1.3fr,1fr]">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-zinc-200/70 bg-zinc-50/70 px-3 py-1 text-xs text-zinc-600 dark:border-zinc-800/70 dark:bg-zinc-900/60 dark:text-zinc-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AI-powered automations for modern teams
            </div>

            <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Automate calendars, follow-ups, and content in one workspace.
            </h1>

            <p className="mt-5 max-w-xl text-base text-zinc-600 dark:text-zinc-400 sm:text-lg">
              Skillify saves businesses hours every week by automating scheduling, client
              communication, and content—while keeping everything organized across
              workspaces.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-[0_0_32px_-12px_rgba(37,99,235,0.8)] transition hover:bg-blue-700 sm:text-base"
              >
                Start free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-3 text-sm text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900 sm:text-base"
              >
                Book a live demo
              </Link>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 sm:text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Cancel anytime
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-500" />
                Built for agencies & operators
              </div>
            </div>
          </div>

          {/* Right side "mock dashboard" */}
          <div className="relative">
            <div className="absolute -inset-6 -z-10 bg-gradient-to-br from-blue-500/20 via-indigo-500/20 to-sky-400/10 blur-3xl" />
            <div className="overflow-hidden rounded-3xl border border-zinc-200 bg-white/90 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950/80">
              <div className="flex items-center justify-between border-b border-zinc-200/80 px-5 py-3 dark:border-zinc-800/80">
                <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Automation overview
                </span>
                <span className="text-xs text-emerald-500">Live</span>
              </div>
              <div className="space-y-4 p-5">
                {/* stat row */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[
                    { label: "Appointments", value: "+38%", note: "this week" },
                    { label: "Follow-ups", value: "92%", note: "auto-handled" },
                    { label: "Response time", value: "1.4m", note: "avg" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-900/60"
                    >
                      <div className="text-[11px] text-zinc-500">{item.label}</div>
                      <div className="text-sm font-semibold">{item.value}</div>
                      <div className="text-[11px] text-zinc-500">{item.note}</div>
                    </div>
                  ))}
                </div>

                {/* automation list */}
                <div className="mt-3 space-y-2">
                  {[
                    "New lead ➝ auto-email + SMS follow-up",
                    "Missed call ➝ send booking link",
                    "No-show ➝ reschedule sequence",
                    "New client ➝ welcome + onboarding drip",
                  ].map((rule) => (
                    <div
                      key={rule}
                      className="flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 px-3 py-2.5 text-xs dark:border-zinc-800 dark:bg-zinc-900/70"
                    >
                      <span className="text-zinc-600 dark:text-zinc-300">{rule}</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="border-t border-zinc-200/70 py-10 dark:border-zinc-800/70">
        <div className="mx-auto max-w-6xl px-6">
          <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
            BUILT FOR MODERN SERVICE BUSINESSES
          </p>
          <div className="grid grid-cols-2 gap-6 text-center text-xs text-zinc-400 sm:grid-cols-4 sm:text-sm md:grid-cols-6">
            {[
              "Agencies",
              "Consultants",
              "Coaches",
              "Studios",
              "Salons",
              "Local Services",
            ].map((item) => (
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

      {/* QUICK FEATURE ROW */}
      <section className="bg-zinc-50 py-20 dark:bg-zinc-900">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 md:grid-cols-3">
          {[
            {
              title: "AI follow-ups that don’t forget",
              body: "Every missed call, new lead, and no-show gets an instant, on-brand response.",
            },
            {
              title: "Calendar that runs itself",
              body: "Let Skillify handle reminders, reschedules, confirmations, and time zones.",
            },
            {
              title: "Content that sounds like you",
              body: "Generate posts, campaigns, and scripts tailored to each business’s tone.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black"
            >
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
