// app/dashboard/[workspaceSlug]/analytics/page.tsx

import { auth } from '@clerk/nextjs/server'
import type { Automation, AutomationRun } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import AiHeatmapInsights from './components/AiHeatmapInsights' // ⬅ NEW CLIENT COMPONENT
import { UpsellMicroCard } from '@/components/upsell/UpsellMicroCard'
import { UpsellEnterpriseConsult } from '@/components/upsell/UpsellEnterpriseConsult'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'

type AnalyticsPageProps = {
  params: { workspaceSlug: string }
}

type AutomationWithRuns = Automation & {
  runs: AutomationRun[]
}

export default async function AnalyticsPage({ params }: AnalyticsPageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: true,
      automations: {
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 100,
          },
        },
      },
    },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
      </DashboardShell>
    )
  }

  const isMember = workspace.members.some((m) => m.userId === profile.id)
  if (!isMember) {
    return (
      <DashboardShell>
        <h1 className="h2">Access denied</h1>
      </DashboardShell>
    )
  }

  const runs = workspace.automations.flatMap((a) => a.runs)
  const totalRuns = runs.length
  const successRuns = runs.filter((r) => r.status === 'SUCCESS')
  const failedRuns = runs.filter((r) => r.status === 'FAILED')

  const successRate =
    totalRuns > 0 ? ((successRuns.length / totalRuns) * 100).toFixed(1) : '0.0'

  const avgDurationMs =
    runs.length > 0
      ? Math.round(
          runs.reduce((acc, r) => {
            const finishedAt = r.finishedAt ?? r.startedAt
            const dur =
              r.durationMs ?? finishedAt.getTime() - r.startedAt.getTime()
            return acc + (typeof dur === 'number' ? dur : 0)
          }, 0) / runs.length,
        )
      : 0

  const failuresByAutomation = workspace.automations
    .map((a: AutomationWithRuns) => {
      const failed = a.runs.filter((r) => r.status === 'FAILED')
      const total = a.runs.length
      const rate =
        total > 0 ? ((failed.length / total) * 100).toFixed(1) : '0.0'
      return {
        id: a.id,
        name: a.name,
        failedCount: failed.length,
        totalCount: total,
        failureRate: rate,
      }
    })
    .filter((a) => a.totalCount > 0)
    .sort((a, b) => Number(b.failureRate) - Number(a.failureRate))
    .slice(0, 5)

  return (
    <DashboardShell>
      <section className="mb-6 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          Analytics
        </h1>
        <p className="text-neutral-text-secondary text-xs">
          High-level performance of automations in this workspace.
        </p>
      </section>

      {/* AI INSIGHTS (CLIENT-SIDE) */}
      <AiHeatmapInsights workspaceId={workspace.id} />

      {/* Top metrics */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card className="p-5">
          <h3 className="text-xs font-medium">Total Runs</h3>
          <p className="mt-4 text-3xl font-semibold">{totalRuns}</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-xs font-medium">Success Rate</h3>
          <p className="mt-4 text-3xl font-semibold">{successRate}%</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-xs font-medium">Successful Runs</h3>
          <p className="mt-4 text-3xl font-semibold">{successRuns.length}</p>
        </Card>

        <Card className="p-5">
          <h3 className="text-xs font-medium">Avg Duration</h3>
          <p className="mt-4 text-3xl font-semibold">
            {avgDurationMs ? `${avgDurationMs} ms` : '—'}
          </p>
        </Card>
      </div>

      {/* Failure hotspots */}
      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold">Failure hotspots</h2>
        <Card className="p-4">
          {failuresByAutomation.length === 0 ? (
            <p className="text-neutral-text-secondary text-sm">
              No failure data yet — run more automations to see patterns.
            </p>
          ) : (
            <div className="space-y-3">
              {failuresByAutomation.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b border-neutral-border pb-3 last:border-none"
                >
                  <div>
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="text-neutral-text-secondary text-xs">
                      {a.failedCount} failed / {a.totalCount} runs •{' '}
                      {a.failureRate}% failure rate
                    </p>
                  </div>

                  <Badge variant="red">Watch</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-100">
            Need help improving your automation performance?
          </h3>
          <p className="text-xs text-slate-400">
            Our team can identify bottlenecks, restructure flows, and optimize
            AI prompts.
          </p>
          <div className="mt-3">
            <UpsellMicroCard
              workspaceId={workspace.id}
              feature="analytics-optimization"
              title="Fix my performance"
              description="Quick turnaround performance fixes."
              priceHint="Most fixes $49–$149"
            />
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-2 text-sm font-semibold text-slate-100">
            Need a full automation system built?
          </h3>
          <p className="text-xs text-slate-400">
            Our enterprise team can architect + implement an end-to-end workflow
            for your business.
          </p>

          <UpsellEnterpriseConsult workspaceId={workspace.id} />
        </Card>
      </section>

      {/* Recent failures list */}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Recent failed runs</h2>
        <Card className="p-4">
          {failedRuns.length === 0 ? (
            <p className="text-neutral-text-secondary text-sm">
              No recent failed runs.
            </p>
          ) : (
            <div className="space-y-3">
              {failedRuns.slice(0, 20).map((run) => {
                const automation = workspace.automations.find((a) =>
                  a.runs.some((r) => r.id === run.id),
                )
                return (
                  <div
                    key={run.id}
                    className="flex items-center justify-between border-b border-neutral-border pb-3 last:border-none"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {automation?.name ?? 'Automation'}
                      </p>
                      <p className="text-neutral-text-secondary text-xs">
                        {new Date(run.startedAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge variant="red">FAILED</Badge>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </section>

      {/* CTA: Full Build Request */}
      <div className="mt-10">
        <BuildRequestCallout workspaceId={workspace.id} />
      </div>
    </DashboardShell>
  )
}
