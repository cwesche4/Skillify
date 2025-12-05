import { Check } from "lucide-react"
import Link from "next/link"

const plans = [
  {
    name: "Starter",
    price: "Free",
    tagline: "Test automations on a single business.",
    highlight: false,
    features: [
      "1 workspace",
      "Up to 3 active automations",
      "Basic AI follow-ups",
      "Simple calendar workflows",
      "Email support",
    ],
  },
  {
    name: "Pro",
    price: "$29/mo",
    tagline: "Automation stack for growing operators & teams.",
    highlight: true,
    features: [
      "Up to 3 workspaces",
      "Unlimited automations",
      "AI content engine",
      "Advanced calendar rules",
      "Team roles & permissions",
      "Analytics overview",
      "Priority support",
    ],
  },
  {
    name: "Business",
    price: "$79/mo",
    tagline: "For agencies and teams running multiple brands.",
    highlight: false,
    features: [
      "Unlimited workspaces",
      "Unlimited automations & templates",
      "Custom AI profiles per client",
      "Advanced reporting & exports",
      "SLA & premium support",
    ],
  },
]

export default function PricingPage() {
  return (
    <div className="px-6 pb-28 pt-24">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Simple, transparent pricing.
          </h1>
          <p className="mt-4 text-zinc-600 dark:text-zinc-400">
            Start free, upgrade only when you’re ready to scale. No setup fees. No
            long-term contracts.
          </p>
        </div>

        {/* Plans */}
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-3xl border p-8 ${
                plan.highlight
                  ? "border-blue-500/70 bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-50 shadow-[0_0_40px_-18px_rgba(59,130,246,0.9)]"
                  : "border-zinc-200 bg-white text-zinc-900 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 right-6 rounded-full border border-blue-400/60 bg-blue-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-blue-300">
                  Most popular
                </div>
              )}

              <h2 className="text-xl font-semibold">{plan.name}</h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {plan.tagline}
              </p>

              <div className="mt-6 flex items-baseline gap-2">
                <span className="text-4xl font-semibold">{plan.price}</span>
                {plan.price !== "Free" && (
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">
                    /workspace
                  </span>
                )}
              </div>

              <ul className="mt-8 space-y-3 text-sm">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href="/sign-up"
                className={`mt-8 inline-flex items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold ${
                  plan.highlight
                    ? "bg-blue-500 text-white hover:bg-blue-400"
                    : "bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
                }`}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mx-auto mt-20 max-w-3xl">
          <h2 className="mb-6 text-xl font-semibold">Frequently asked</h2>
          <div className="space-y-6 text-sm text-zinc-600 dark:text-zinc-400">
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                Do I need a payment method to start?
              </p>
              <p className="mt-1">
                No. You can use the Starter plan without entering a card. Upgrade only
                when you’re ready.
              </p>
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                Can I cancel anytime?
              </p>
              <p className="mt-1">
                Yes. Cancel in one click from your workspace settings. Your data stays
                available to export.
              </p>
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">
                Is Skillify good for agencies?
              </p>
              <p className="mt-1">
                Absolutely. The multi-workspace system was built so you can manage many
                brands or clients from a single account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
