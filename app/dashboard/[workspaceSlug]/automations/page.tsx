// app/dashboard/[workspaceSlug]/automations/page.tsx

import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'

type PageProps = {
  params: { workspaceSlug: string }
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

  if (!workspace) {
    return (
      <DashboardShell>
        <h1 className="h2">Workspace not found</h1>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <section className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="h2">Automations</h1>
          <p className="text-neutral-text-secondary mt-1 text-sm">
            Manage flows for{' '}
            <span className="font-medium">{workspace.name}</span>.
          </p>
        </div>

        <Link
          href={`/dashboard/${workspace.slug}/automations/templates`}
          className="hover:bg-brand-primary/90 inline-flex items-center rounded-lg bg-brand-primary px-4 py-2 text-sm font-medium text-white shadow-sm"
        >
          Browse Templates
        </Link>
      </section>

      {workspace.automations.length === 0 ? (
        <Card className="p-6 text-center">
          <h2 className="text-lg font-semibold">No automations yet</h2>
          <p className="text-neutral-text-secondary mt-2 text-sm">
            Start by creating your first flow from a template or from scratch.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {workspace.automations.map((automation: any) => {
            const runs = automation.runs
            const lastRun = runs[0]
            const totalRuns = runs.length
            const successRuns = runs.filter(
              (r: any) => r.status === 'SUCCESS',
            ).length
            const successRate =
              totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null

            return (
              <Link
                key={automation.id}
                href={`/dashboard/${workspace.slug}/automations/${automation.id}`}
                className="block"
              >
                <Card className="hover:bg-neutral-card-dark/40 flex items-center justify-between p-4">
                  <div>
                    <h3 className="text-sm font-medium">{automation.name}</h3>
                    <p className="text-neutral-text-secondary mt-1 text-xs">
                      {automation.description ?? 'No description provided.'}
                    </p>

                    <p className="text-neutral-text-secondary mt-2 text-xs">
                      {lastRun
                        ? `Last run: ${new Date(
                          lastRun.startedAt,
                        ).toLocaleString()}`
                        : 'No runs yet'}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
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

                    <p className="text-neutral-text-secondary text-xs">
                      {totalRuns === 0
                        ? 'No runs yet'
                        : successRate !== null
                          ? `${successRate}% success over last ${totalRuns} runs`
                          : 'No success data'}
                    </p>
                  </div>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <div className="mt-10">
        <BuildRequestCallout workspaceId={workspace.id} />
      </div>
    </DashboardShell>
  )
}
