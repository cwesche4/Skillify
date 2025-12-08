// app/dashboard/[workspaceSlug]/settings/upsells/page.tsx

import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { UpsellEnterpriseConsult } from '@/components/upsell/UpsellEnterpriseConsult'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function UpsellSettingsPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) return null

  return (
    <DashboardShell>
      <section className="mb-6 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          Upgrade & Services
        </h1>
        <p className="text-neutral-text-secondary text-xs">
          Premium optimization, consulting, and full build services.
        </p>
      </section>

      {/* Micro Upsells */}
      <Card className="mb-6 p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-100">
          Quick Fixes
        </h2>
        <p className="text-neutral-text-secondary mb-4 text-xs">
          Small improvements, fast turnaround.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          <UpsellMicroCard
            workspaceId={params.workspaceSlug}
            feature="node-tuning"
            title="Tune a specific node"
            description="We refine prompts, settings, logic, and outputs."
            priceHint="Most fixes $19–$49"
          />
          <UpsellMicroCard
            workspaceId={params.workspaceSlug}
            feature="analytics-optimization"
            title="Improve automation performance"
            description="We diagnose bottlenecks and restructure your flow."
            priceHint="Typically $49–$149"
          />
        </div>
      </Card>

      {/* Enterprise Consult */}
      <Card className="mb-6 p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-100">
          Enterprise Consulting
        </h2>
        <p className="text-neutral-text-secondary mb-4 text-xs">
          Work 1:1 with an expert to architect or optimize your entire
          automation system.
        </p>

        <UpsellEnterpriseConsult workspaceId={params.workspaceSlug} />
      </Card>

      {/* Full Build */}
      <Card className="p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-100">
          Full Automation System Build
        </h2>
        <p className="text-neutral-text-secondary mb-4 text-xs">
          Need a full workflow, CRM integration, or AI pipeline? Let our team
          build the entire system for you.
        </p>

        <BuildRequestCallout workspaceId={params.workspaceSlug} />
      </Card>
    </DashboardShell>
  )
}
