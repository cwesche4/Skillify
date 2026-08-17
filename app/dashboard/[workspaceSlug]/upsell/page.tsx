// app/dashboard/[workspaceSlug]/upsell/page.tsx

import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { UpsellEnterpriseConsult } from '@/components/upsell/UpsellEnterpriseConsult'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'
import { prisma } from '@/lib/db'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'

type PageProps = {
  params: { workspaceSlug: string }
  searchParams?: { need?: string; feature?: string }
}

export default async function UpsellOverviewPage({
  params,
  searchParams,
}: PageProps) {
  const { userId } = auth()
  if (!userId) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      subscription: { select: { plan: true } },
      owner: { select: { id: true } },
      members: {
        where: { user: { clerkId: userId } },
        select: { role: true },
      },
    },
  })

  if (!workspace) return null

  const currentPlan = await getWorkspacePlan(workspace.id)
  const role =
    workspace.members[0]?.role?.toLowerCase() === 'owner'
      ? 'owner'
      : workspace.members[0]?.role?.toLowerCase() === 'admin'
        ? 'admin'
        : 'member'

  const attemptedFeature = searchParams?.feature
  const requiredPlan =
    searchParams?.need &&
    ['pro', 'elite', 'basic'].includes(searchParams.need.toLowerCase())
      ? ((searchParams.need.charAt(0).toUpperCase() +
          searchParams.need.slice(1).toLowerCase()) as
          | 'Basic'
          | 'Pro'
          | 'Elite')
      : null

  const billingHref = `/dashboard/${params.workspaceSlug}/billing`
  const isFree = currentPlan === 'Free'
  const isPro = currentPlan === 'Pro'
  const isElite = currentPlan === 'Elite'

  return (
    <DashboardShell>
      <section className="mb-6 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          Service Requests
        </h1>
        <p className="text-neutral-text-secondary text-xs">
          Request additional automations, integrations, or done-for-you support
          from Skillify. Your current plan and role determine which services are
          available immediately.
        </p>
        <div className="text-neutral-text-secondary flex flex-wrap gap-2 text-xs">
          <Badge variant="blue">Plan: {currentPlan}</Badge>
          <Badge variant="gray">Role: {role}</Badge>
          {requiredPlan && (
            <Badge variant={requiredPlan === 'Elite' ? 'purple' : 'green'}>
              Requires {requiredPlan}
            </Badge>
          )}
        </div>
        {attemptedFeature && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-100">
            You tried to access <strong>{attemptedFeature}</strong>
            {requiredPlan ? ` — upgrade to ${requiredPlan} to unlock.` : '.'}
          </div>
        )}
      </section>

      {/* Plan upgrades first */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Card className="border-sky-500/30 bg-slate-950/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Upgrade to Pro
              </p>
              <p className="text-[11px] text-slate-400">
                Unlock premium analytics, AI coach, and priority support.
              </p>
            </div>
            <Badge variant="blue">
              {currentPlan === 'Pro' ? 'Current' : 'Pro'}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
            <span>
              {currentPlan === 'Pro'
                ? 'You already have Pro.'
                : 'Upgrade to Pro to unlock gated features instantly.'}
            </span>
            <Button size="sm" variant="primary" asChild disabled={isElite}>
              <Link href={billingHref}>
                {currentPlan === 'Pro' ? 'Manage billing' : 'Upgrade to Pro'}
              </Link>
            </Button>
          </div>
        </Card>

        <Card className="border-purple-500/40 bg-slate-950/40 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-100">
                Upgrade to Elite
              </p>
              <p className="text-[11px] text-slate-400">
                Required for enterprise consults, full builds, and inbound
                webhooks.
              </p>
            </div>
            <Badge variant="purple">
              {currentPlan === 'Elite' ? 'Current' : 'Elite'}
            </Badge>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
            <span>
              {currentPlan === 'Elite'
                ? 'You already have Elite access.'
                : 'Upgrade to Elite for white-glove delivery and enterprise features.'}
            </span>
            <Button size="sm" variant="primary" asChild>
              <Link href={billingHref}>
                {currentPlan === 'Elite'
                  ? 'Manage billing'
                  : 'Upgrade to Elite'}
              </Link>
            </Button>
          </div>
        </Card>
      </div>

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
            workspaceId={workspace.id}
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
          <UpsellEnterpriseConsult
            workspaceId={workspace.id}
            disabled={isFree}
            disabledReason="Enterprise consults are available on paid plans. Upgrade to Pro or Elite to request."
            softGateNote={
              isPro
                ? 'Pro customers: upgrade to Elite for white-glove consults and priority handling.'
                : undefined
            }
          />
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
          <BuildRequestCallout
            workspaceId={workspace.id}
            workspaceSlug={params.workspaceSlug}
            disabled={isFree}
            disabledReason="Requesting full builds requires a paid plan. Upgrade to Pro or Elite to proceed."
          />
        </Card>
      </div>
    </DashboardShell>
  )
}
