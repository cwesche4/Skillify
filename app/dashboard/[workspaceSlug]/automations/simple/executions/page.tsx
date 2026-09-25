import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { AutomationsSectionHeader } from '@/components/automations/AutomationsSectionHeader'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { listSimpleAutomationExecutionHistory } from '@/lib/automations/simpleAutomationHistory'
import { canManageAutomations } from '@/lib/automations/policy'
import { prisma } from '@/lib/db'

const statusVariant = {
  SUCCESS: 'green',
  FAILED: 'red',
  RUNNING: 'blue',
  PENDING: 'yellow',
} as const

export default async function SimpleAutomationExecutionsPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')
  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { user: { clerkId: userId } } },
    },
    select: {
      id: true,
      slug: true,
      members: {
        where: { user: { clerkId: userId } },
        select: { role: true },
        take: 1,
      },
    },
  })
  if (!workspace) return null
  if (!canManageAutomations(workspace.members[0]?.role)) {
    redirect(`/dashboard/${workspace.slug}/automations`)
  }
  const runs = await listSimpleAutomationExecutionHistory({
    workspaceId: workspace.id,
  })

  return (
    <DashboardShell>
      <AutomationsSectionHeader
        workspaceSlug={workspace.slug}
        activeMode="simple"
        activeSimpleSection="executions"
        description="Review when your Simple Automations ran and whether each action succeeded."
      />
      <Card className="overflow-hidden">
        <div className="border-app border-b px-5 py-4">
          <h2 className="text-app-primary text-lg font-semibold">
            Simple execution history
          </h2>
          <p className="text-app-secondary mt-1 text-sm">
            The latest 100 runs across active and previously configured recipes.
          </p>
        </div>
        {runs.length ? (
          <div className="divide-app divide-y">
            {runs.map((run) => (
              <article key={run.id} className="px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-app-primary font-semibold">
                      {run.recipeName}
                    </h3>
                    <p className="text-app-secondary mt-1 text-sm">
                      {run.trigger}
                    </p>
                  </div>
                  <Badge variant={statusVariant[run.status] ?? 'gray'} size="xs">
                    {run.status === 'SUCCESS'
                      ? 'Succeeded'
                      : run.status.charAt(0) + run.status.slice(1).toLowerCase()}
                  </Badge>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-app-muted text-xs">Started</dt>
                    <dd className="text-app-secondary">
                      {new Intl.DateTimeFormat('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      }).format(new Date(run.startedAt))}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-app-muted text-xs">Action</dt>
                    <dd className="text-app-secondary">{run.action}</dd>
                  </div>
                </dl>
                {run.failureReason ? (
                  <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                    {run.failureReason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <p className="text-app-secondary px-5 py-10 text-center text-sm">
            No Simple Automation runs yet. New runs will appear here after an
            active recipe is triggered.
          </p>
        )}
      </Card>
    </DashboardShell>
  )
}
