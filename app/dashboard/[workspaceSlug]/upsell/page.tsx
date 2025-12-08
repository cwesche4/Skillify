// app/dashboard/[workspaceSlug]/upsell/page.tsx

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { UpsellEnterpriseConsult } from '@/components/upsell/UpsellEnterpriseConsult'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'

type PageProps = { params: { workspaceSlug: string } }

export default function UpsellOverviewPage({ params }: PageProps) {
  return (
    <DashboardShell>
      <section className="mb-6 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          Done-For-You Automations
        </h1>
        <p className="text-neutral-text-secondary text-xs">
          Get expert help building, optimizing, or scaling your automations.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Quick Fixes */}
        <Card className="border-slate-800 bg-slate-950/30 p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">
            Quick Fixes
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            Small improvements completed fast — perfect for tuning nodes or
            fixing errors.
          </p>
          <UpsellMicroCard
            workspaceId={params.workspaceSlug}
            feature="quick-fix"
            title="Fix something for me"
            description="Node tuning, prompt optimization, reliability fixes."
            priceHint="$19–$49"
          />
        </Card>

        {/* Enterprise Consult */}
        <Card className="border-slate-800 bg-slate-950/30 p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">
            Enterprise Consult
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            High-level strategy, architecture planning, and expert help.
          </p>
          <UpsellEnterpriseConsult workspaceId={params.workspaceSlug} />
        </Card>

        {/* Full Build */}
        <Card className="border-slate-800 bg-slate-950/30 p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-100">
            Full Build System
          </h3>
          <p className="mb-4 text-xs text-slate-400">
            We build your entire automation system from scratch so you don’t
            have to.
          </p>
          <BuildRequestCallout workspaceId={params.workspaceSlug} />
        </Card>
      </div>
    </DashboardShell>
  )
}
