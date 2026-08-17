// app/dashboard/[workspaceSlug]/automations/page.tsx

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'
import DeleteAutomationButton from '@/components/automations/DeleteAutomationButton'
import Link from 'next/link'
import { CreateAutomationForm } from '@/components/automations/CreateAutomationForm'
import { RenameAutomationButton } from '@/components/automations/RenameAutomationButton'
import { selectActiveAutomations } from '@/lib/workspace-records/relationships'

type PageProps = {
  params: { workspaceSlug: string }
  searchParams?: { view?: string }
}

export default async function AutomationsPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      automations: {
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 20,
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!workspace) return null

  const sortAutomations = (automations: typeof workspace.automations) =>
    automations.slice().sort((first: any, second: any) => {
      const pinnedDelta =
        Number(Boolean(second.pinned)) - Number(Boolean(first.pinned))
      if (pinnedDelta !== 0) return pinnedDelta

      const firstLatestRun = first.runs[0]?.startedAt?.getTime?.() ?? 0
      const secondLatestRun = second.runs[0]?.startedAt?.getTime?.() ?? 0
      if (firstLatestRun !== secondLatestRun)
        return secondLatestRun - firstLatestRun

      const firstFailures = first.runs.filter(
        (run: any) => run.status === 'FAILED',
      ).length
      const secondFailures = second.runs.filter(
        (run: any) => run.status === 'FAILED',
      ).length
      if (firstFailures !== secondFailures)
        return secondFailures - firstFailures

      return first.name.localeCompare(second.name)
    })

  const activeAutomations = sortAutomations(
    selectActiveAutomations(workspace.automations),
  )
  const inactiveAutomations = sortAutomations(
    workspace.automations.filter(
      (automation) => automation.status !== 'ACTIVE',
    ),
  )

  const renderAutomationCard = (automation: any) => {
    const runs = automation.runs
    const lastRun = runs[0]
    const totalRuns = runs.length
    const failedRuns = runs.filter((r: any) => r.status === 'FAILED')
    const recentFailureCount = failedRuns.length
    const latestRunFailed = lastRun?.status === 'FAILED'
    const successRuns = runs.filter((r: any) => r.status === 'SUCCESS').length
    const successRate =
      totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null
    const automationHref = `/dashboard/${workspace.slug}/automations/${automation.id}`
    const editorHref = `${automationHref}/builder`
    const runsHref = `${automationHref}/runs`
    const latestRunHref = lastRun ? `${runsHref}/${lastRun.id}` : null
    const healthVariant = !lastRun
      ? 'default'
      : latestRunFailed
        ? 'red'
        : recentFailureCount > 0
          ? 'yellow'
          : 'green'
    const healthLabel = !lastRun
      ? 'No runs yet'
      : latestRunFailed
        ? 'Latest run failed'
        : recentFailureCount > 0
          ? `${recentFailureCount} recent ${
              recentFailureCount === 1 ? 'failure' : 'failures'
            }`
          : 'Healthy'
    const healthHref = recentFailureCount > 0 ? runsHref : null
    const lastRunText = lastRun
      ? `Last run: ${new Date(lastRun.startedAt).toLocaleString()}`
      : 'No runs yet'

    return (
      <Card
        key={automation.id}
        className={`hover:bg-neutral-card-dark/40 flex flex-col gap-3 p-4 transition-colors ${
          latestRunFailed
            ? 'border-rose-500/40'
            : recentFailureCount > 0
              ? 'border-amber-500/30'
              : ''
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-medium">
              <Link
                href={editorHref}
                className="hover:text-brand-primary hover:underline"
              >
                {automation.name}
              </Link>
            </h3>
            <p className="text-neutral-text-secondary mt-1 text-xs">
              {automation.description ?? 'No description provided.'}
            </p>

            <p className="text-neutral-text-secondary mt-2 text-xs">
              {lastRunText}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
              <span className="text-neutral-text-secondary rounded-full border border-neutral-border bg-slate-950/30 px-2 py-0.5">
                {successRate !== null
                  ? `${successRate}% Success Rate`
                  : 'No success data'}
              </span>
              <span className="text-neutral-text-secondary rounded-full border border-neutral-border bg-slate-950/30 px-2 py-0.5">
                {totalRuns} {totalRuns === 1 ? 'Run' : 'Runs'}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 ${
                  recentFailureCount > 0
                    ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
                    : 'text-neutral-text-secondary border-neutral-border bg-slate-950/30'
                }`}
              >
                {recentFailureCount}{' '}
                {recentFailureCount === 1
                  ? 'Recent Failure'
                  : 'Recent Failures'}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {latestRunHref ? (
              <Link
                href={latestRunHref}
                className="rounded-full transition-opacity hover:opacity-80"
              >
                <Badge
                  variant={
                    automation.status === 'ACTIVE'
                      ? 'green'
                      : automation.status === 'PAUSED'
                        ? 'yellow'
                        : 'default'
                  }
                >
                  {automation.status}
                </Badge>
              </Link>
            ) : (
              <Badge
                variant={
                  automation.status === 'ACTIVE'
                    ? 'green'
                    : automation.status === 'PAUSED'
                      ? 'yellow'
                      : 'default'
                }
              >
                {automation.status}
              </Badge>
            )}

            {healthHref ? (
              <Link
                href={healthHref}
                className="rounded-full transition-opacity hover:opacity-80"
              >
                <Badge variant={healthVariant} size="sm">
                  {healthLabel}
                </Badge>
              </Link>
            ) : (
              <Badge variant={healthVariant} size="sm">
                {healthLabel}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={editorHref}
            className="text-sm font-medium text-brand-primary underline"
          >
            Edit
          </Link>
          <RenameAutomationButton
            workspaceId={workspace.id}
            automationId={automation.id}
            currentName={automation.name}
          />
          <DeleteAutomationButton
            workspaceId={workspace.id}
            automationId={automation.id}
          />
        </div>
      </Card>
    )
  }

  return (
    <DashboardShell>
      <PageHeader
        title="Automations"
        description={`Manage workflow systems for ${workspace.name}.`}
        actions={
          <>
            <CreateAutomationForm
              workspaceId={workspace.id}
              workspaceSlug={workspace.slug}
            />
            <Link
              href={`/dashboard/${workspace.slug}/templates`}
              className="hover:bg-brand-primary/90 inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
            >
              Browse Templates
            </Link>
          </>
        }
      />

      <div id="automations-workspace" className="scroll-mt-28">
        {workspace.automations.length === 0 ? (
          <Card className="p-6 text-center">
            <h2 className="text-lg font-semibold">No automations yet</h2>
            <p className="text-neutral-text-secondary mt-2 text-sm">
              Start by creating your first flow from a template or from scratch.
            </p>
          </Card>
        ) : (
          <div className="space-y-8">
            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Active Automations
                </h2>
                <p className="text-xs text-slate-400">
                  Running workflows that can trigger across this workspace.
                </p>
              </div>
              {activeAutomations.length > 0 ? (
                <div className="space-y-3">
                  {activeAutomations.map(renderAutomationCard)}
                </div>
              ) : (
                <Card className="p-4 text-sm text-slate-400">
                  No active automations.
                </Card>
              )}
            </section>

            <section className="space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Inactive Automations
                </h2>
                <p className="text-xs text-slate-400">
                  Paused, draft, or inactive workflows kept for review.
                </p>
              </div>
              {inactiveAutomations.length > 0 ? (
                <div className="space-y-3">
                  {inactiveAutomations.map(renderAutomationCard)}
                </div>
              ) : (
                <Card className="p-4 text-sm text-slate-400">
                  No inactive automations.
                </Card>
              )}
            </section>
          </div>
        )}
      </div>

      <div className="mt-10">
        <BuildRequestCallout workspaceId={workspace.id} />
      </div>
    </DashboardShell>
  )
}
