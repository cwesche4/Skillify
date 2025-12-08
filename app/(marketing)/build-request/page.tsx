// app/(marketing)/build-request/page.tsx
import { Metadata } from 'next'
import { BuildRequestForm } from '@/components/upsell/BuildRequestForm'

export const metadata: Metadata = {
  title: 'Done-For-You Automation Build | Skillify',
  description:
    'Tell us what you want automated and we’ll design, build, and connect the full Skillify system for your business.',
}

export default function BuildRequestMarketingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-950 to-slate-950/95">
      <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 pb-16 pt-20 md:flex-row md:items-start md:pt-24">
        {/* Left: copy */}
        <section className="space-y-6 md:w-[45%]">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Done-For-You Build
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-semibold text-slate-50 md:text-4xl">
              We&apos;ll build the entire automation system for you.
            </h1>
            <p className="text-sm text-slate-300 md:text-base">
              Instead of piecing together 10 different tools, tell us how your
              business works and we design + implement your Skillify workspace,
              automations, and follow-ups end-to-end.
            </p>
          </div>

          <ul className="space-y-2 text-sm text-slate-300">
            <li>
              • Deep-dive into your funnel, lead sources, and existing tools
            </li>
            <li>
              • Build Skillify automations for booking, follow-up, and retention
            </li>
            <li>
              • Integrate calendars, CRMs, email/SMS, and AI agent workflows
            </li>
            <li>• Hand-off with documentation + loom walkthroughs</li>
          </ul>

          <p className="text-[11px] text-slate-500">
            Typical full builds start around{' '}
            <span className="font-medium text-slate-200">$3k</span> and scale up
            with complexity.
          </p>
        </section>

        {/* Right: form */}
        <section className="md:w-[55%]">
          <BuildRequestForm variant="marketing" />
        </section>
      </main>
    </div>
  )
}
