// app/dashboard/[workspaceSlug]/automations/[automationId]/page.tsx
import { auth } from '@clerk/nextjs/server'
import type { AutomationRun } from '@prisma/client'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

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

  const isMember = workspace.members.some((m) => m.userId === profile.id)
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

  const runs: AutomationRun[] = automation.runs

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

            // durationMs may or may not exist on older generated types,
            // so we use a safe access with a ts-expect-error.
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
    </DashboardShell>
  )
}
