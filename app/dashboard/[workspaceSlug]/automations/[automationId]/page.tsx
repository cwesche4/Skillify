// app/dashboard/[workspaceSlug]/automations/[automationId]/page.tsx
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { classifyCRMError } from '@/lib/integrations/failureCategory'

type AutomationDetailPageProps = {
  params: {
    workspaceSlug: string
    automationId: string
  }
}

export default async function AutomationDetailPage({
  params,
}: AutomationDetailPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: { members: true },
  })

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
      </DashboardShell>
    )
  }

  const isMember = workspace.members.some((m: any) => m.userId === profile.id)
  if (!isMember) {
    return (
      <DashboardShell>
        <h1 className="h2">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </DashboardShell>
    )
  }

  const automation = await prisma.automation.findFirst({
    where: {
      id: params.automationId,
      workspaceId: workspace.id,
    },
    include: {
      runs: {
        orderBy: { startedAt: 'desc' },
        take: 20,
      },
    },
  })

  if (!automation) {
    return (
      <DashboardShell>
        <h1 className="h2">Automation not found</h1>
      </DashboardShell>
    )
  }

  // FIX — infer Prisma type from actual query
  type AutomationRun = (typeof automation.runs)[number]
  const runs: AutomationRun[] = automation.runs
  const plan = await getWorkspacePlan(workspace.id)

  const crmTimeline =
    plan === 'Elite'
      ? await prisma.auditLog.findMany({
          where: {
            workspaceId: workspace.id,
            action: {
              startsWith: 'CRM_',
            },
            meta: {
              path: ['automationId'],
              equals: automation.id,
            } as any,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
      : []

  const unifiedTimeline =
    plan === 'Elite'
      ? await prisma.auditLog.findMany({
          where: {
            workspaceId: workspace.id,
            OR: [
              { action: { startsWith: 'CRM_' } },
              { action: 'AUTOMATION_GUARD_DEPTH' },
              { action: 'AUTOMATION_GUARD_NODES' },
            ],
            meta: {
              path: ['automationId'],
              equals: automation.id,
            } as any,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : []

  return (
    <DashboardShell>
      <section className="mb-8 space-y-1">
        <h1 className="text-neutral-text-primary text-2xl font-semibold">
          {automation.name}
        </h1>
        <p className="text-neutral-text-secondary text-sm">
          Automation detail for workspace{' '}
          <span className="font-medium">{workspace.name}</span>
        </p>
      </section>

      <Card className="space-y-4 p-6">
        <h2 className="text-neutral-text-primary text-sm font-semibold">
          Recent runs
        </h2>

        {runs.length === 0 ? (
          <p className="text-neutral-text-secondary text-sm">No runs yet.</p>
        ) : (
          runs.map((run) => {
            const finishedAt = run.finishedAt ?? run.startedAt

            const storedDuration: number | null | undefined = run.durationMs
            const durationMs =
              typeof storedDuration === 'number'
                ? storedDuration
                : finishedAt.getTime() - run.startedAt.getTime()

            const durationLabel = `${Math.max(0, Math.round(durationMs))} ms`

            return (
              <div
                key={run.id}
                className="flex items-center justify-between border-b border-neutral-border pb-3 last:border-none"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(run.startedAt).toLocaleString()}
                  </p>
                  <p className="text-neutral-text-secondary text-xs">
                    Duration: {durationLabel}
                  </p>
                </div>

                <Badge
                  variant={
                    run.status === 'SUCCESS'
                      ? 'green'
                      : run.status === 'FAILED'
                        ? 'red'
                        : 'blue'
                  }
                >
                  {run.status}
                </Badge>
              </div>
            )
          })
        )}
      </Card>

      {plan === 'Elite' && (
        <Card className="mt-6 space-y-3 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-text-primary">
                CRM Activity Timeline
              </h2>
              <p className="text-xs text-neutral-text-secondary">
                Webhooks, triggers, actions, and circuit events for this automation (read-only).
              </p>
            </div>
            <Badge variant="blue">Elite</Badge>
          </div>

          {crmTimeline.length === 0 ? (
            <p className="text-xs text-neutral-text-secondary">No CRM activity yet.</p>
          ) : (
            <div className="space-y-2">
              {crmTimeline.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start justify-between rounded-lg border border-neutral-border/60 bg-black/20 px-3 py-2"
                >
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="gray">{entry.action}</Badge>
                      <span className="text-[11px] text-neutral-text-secondary">
                        {new Date(entry.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-neutral-text-primary">
                      Target: {entry.targetType}
                      {entry.targetId ? ` • ${entry.targetId}` : ''}
                    </div>
                    {entry.meta && (
                      <div className="text-[11px] text-neutral-text-secondary">
                        {JSON.stringify(entry.meta)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {plan === 'Elite' && (
        <Card className="mt-4 space-y-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-text-primary">
              Unified Automation Timeline
            </h2>
            <Badge variant="blue">Elite</Badge>
          </div>
          {unifiedTimeline.length === 0 ? (
            <p className="text-xs text-neutral-text-secondary">No timeline events yet.</p>
          ) : (
            <div className="space-y-2 text-[11px] text-neutral-text-primary">
              {unifiedTimeline.map((entry) => {
                const meta = (entry.meta as any) || {}
                const error = meta.error ?? meta.reason ?? meta.lastError ?? null
                const failureCategory = error ? classifyCRMError(String(error)) : undefined
                return (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between rounded border border-neutral-border/60 bg-black/15 px-3 py-2"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <Badge size="xs" variant="gray">
                          {entry.action}
                        </Badge>
                        <span className="text-[10px] text-neutral-text-secondary">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="text-[11px]">
                        Target: {entry.targetType}
                        {entry.targetId ? ` • ${entry.targetId}` : ''}
                      </div>
                      {meta.provider && (
                        <div className="text-[10px] text-neutral-text-secondary">
                          Provider: {meta.provider}
                        </div>
                      )}
                      {meta.externalId && (
                        <div className="text-[10px] text-neutral-text-secondary">
                          External ID: {meta.externalId}
                        </div>
                      )}
                      {error && (
                        <div className="text-[10px] text-amber-300">
                          Error: {String(error)}{' '}
                          {failureCategory ? `(category: ${failureCategory})` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      )}
    </DashboardShell>
  )
}
