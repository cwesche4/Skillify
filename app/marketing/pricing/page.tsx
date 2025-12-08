// app/marketing/pricing/page.tsx

import { Check, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { UpsellEnterpriseConsult } from '@/components/upsell/UpsellEnterpriseConsult'
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-white dark:bg-black">
      {/* Header */}
      <section className="px-6 py-20 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
          Simple, transparent pricing for growing teams.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
          Skillify powers your client communication, scheduling, automation
          flows, and content — all inside one intelligent workspace.
        </p>
      </section>

      {/* Pricing cards */}
      <section className="mx-auto grid max-w-6xl gap-8 px-6 pb-24 md:grid-cols-3">
        <PricingCard
          tier="Basic"
          price="$29"
          tagline="Start automating essential workflows"
          features={[
            'Unlimited flows',
            'Triggers, Webhooks, Delays',
            'Calendar automation',
            'Basic AI suggestions',
            'Run history (7 days)',
          ]}
          button={<PrimaryButton href="/sign-up" label="Start Basic" />}
        />

        <PricingCard
          tier="Pro"
          highlight
          price="$79"
          tagline="AI-powered automations for operators & agencies"
          features={[
            'Everything in Basic',
            'AI LLM, Classifier, Splitter nodes',
            'Grouping, OR paths',
            'AI Coach real-time suggestions',
            'Heatmaps & performance insights',
            'Run history (30 days)',
            'Priority support',
          ]}
          button={
            <PrimaryButton href="/sign-up?plan=pro" label="Upgrade to Pro" />
          }
        />

        <PricingCard
          tier="Elite"
          price="$199"
          tagline="Enterprise-grade automations & custom builds"
          features={[
            'Everything in Pro',
            'Elite AI performance engine',
            'Replay debugger & run overlays',
            'Premium templates library',
            '90-day run history',
            'White-glove onboarding',
            'Private Slack channel',
          ]}
          button={
            <PrimaryButton href="/sign-up?plan=elite" label="Join Elite" />
          }
        />
      </section>

      {/* Add-ons */}
      <section className="border-t border-zinc-200 py-20 dark:border-zinc-800">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="text-center text-2xl font-semibold">
            Need more than software?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-zinc-500 dark:text-zinc-400">
            Our team can build entire automation systems, flows, templates, and
            AI agents for you.
          </p>

          <div className="mt-12 grid gap-8 md:grid-cols-2">
            {/* Micro upsell */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-lg font-semibold">
                Small automation fixes or improvements
              </h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Quick enhancements, flow repairs, or optimization help.
              </p>

              <div className="mt-5">
                <UpsellMicroCard
                  workspaceId="public"
                  feature="pricing-micro-automation"
                  title="Request a small fix"
                  description="Most micro tasks delivered same-day."
                  priceHint="$29–$99"
                />
              </div>
            </div>

            {/* Enterprise consulting */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              <h3 className="text-lg font-semibold">
                Full automation buildout
              </h3>
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                Need an entire automation system architected for your business?
                Our team handles strategy, build, optimization, and deployment.
              </p>

              <div className="mt-5">
                <UpsellEnterpriseConsult workspaceId="public" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-5xl px-6 pb-24">
        <h2 className="mb-8 text-center text-2xl font-semibold">
          Frequently asked questions
        </h2>

        <div className="space-y-6 text-sm text-zinc-600 dark:text-zinc-400">
          <FAQ
            q="Can I change plans at any time?"
            a="Yes. Upgrades are immediate and prorated. Downgrades take effect at the next billing cycle."
          />
          <FAQ
            q="Do you lock any core features?"
            a="No. Every tier can build flows. Higher tiers unlock AI-enhanced and enterprise-level tools."
          />
          <FAQ
            q="Do you offer white-labeling?"
            a="Yes — available for Elite plans. Contact us for details."
          />
          <FAQ
            q="Can your team build automations for us?"
            a="Yes. You can request micro-tasks or full DFY automation buildouts directly inside Skillify."
          />
        </div>
      </section>
    </main>
  )
}

function PricingCard({
  tier,
  price,
  tagline,
  features,
  button,
  highlight,
}: {
  tier: string
  price: string
  tagline: string
  features: string[]
  button: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div
      className={[
        'rounded-2xl border bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-950',
        highlight
          ? 'border-blue-600 shadow-[0_0_40px_-10px_rgba(37,99,235,0.5)]'
          : 'border-zinc-200 dark:border-zinc-800',
      ].join(' ')}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-xl font-semibold">{tier}</h3>
        {highlight && (
          <span className="rounded-full bg-blue-600/10 px-2 py-1 text-xs font-medium text-blue-600">
            Popular
          </span>
        )}
      </div>

      <div className="mb-3 flex items-end gap-1">
        <span className="text-4xl font-semibold">{price}</span>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">/mo</span>
      </div>

      <p className="mb-6 text-sm text-zinc-600 dark:text-zinc-400">{tagline}</p>

      <ul className="mb-8 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 text-blue-600" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      {button}
    </div>
  )
}

function PrimaryButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex w-full items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow hover:bg-blue-700"
    >
      {label}
      <ArrowRight className="ml-1 h-4 w-4" />
    </Link>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div>
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{q}</p>
      <p className="mt-1 text-zinc-600 dark:text-zinc-400">{a}</p>
    </div>
  )
}
