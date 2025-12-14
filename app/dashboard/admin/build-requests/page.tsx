// app/dashboard/admin/build-requests/page.tsx

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import Link from 'next/link'
import { requireWorkspaceAdmin } from '@/lib/auth/currentUser'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface PageProps {
  params: { workspaceSlug: string }
}

export default async function BuildRequestsAdminPage({ params }: PageProps) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  })

  if (!workspace) {
    notFound()
  }

  // Must be workspace OWNER/ADMIN
  const { user } = await requireWorkspaceAdmin(workspace.id)

  const subscription = await prisma.subscription.findUnique({
    where: { userId: user.id },
    select: { plan: true },
  })
  const planLabel = subscription?.plan ?? 'Free'
  const isElite = planLabel === 'Elite'

  if (!isElite) {
    return (
      <Card className="space-y-3 border-amber-500/30 bg-amber-500/5 p-5 text-sm text-amber-100">
        <div className="flex items-center gap-2">
          <Badge variant="yellow">Upgrade</Badge>
          <span className="font-semibold">
            DFY build admin is Elite-only.
          </span>
        </div>
        <p className="text-amber-100/80">
          Upgrade to Elite to view and manage done-for-you build requests.
        </p>
        <div className="pt-1">
          <Button asChild size="sm" variant="primary">
            <Link href={`/dashboard/${params.workspaceSlug}/upsell?need=Elite`}>
              View Elite benefits
            </Link>
          </Button>
        </div>
      </Card>
    )
  }

  const requests = await prisma.buildRequest.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
  })

  type RequestType = (typeof requests)[number]

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">
          DFY Build Requests
        </h1>
        <p className="text-sm text-slate-400">
          High-intent teams asking Skillify to build or rebuild their entire
          automation system.
        </p>
      </div>

      {requests.length === 0 ? (
        <Card className="p-4 text-sm text-slate-400">
          No build requests yet. When teams submit DFY builds tied to this
          workspace, they&apos;ll show up here.
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((r: RequestType) => (
            <Card
              key={r.id}
              className="space-y-2 border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-50">
                      {r.name || 'Unknown contact'}
                    </span>
                    <Badge size="xs" variant="blue">
                      Build
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    {r.email && <span>{r.email}</span>}
                    {r.phone && (
                      <>
                        <span>•</span>
                        <span>{r.phone}</span>
                      </>
                    )}
                    {r.company && (
                      <>
                        <span>•</span>
                        <span>{r.company}</span>
                      </>
                    )}
                    {r.size && (
                      <>
                        <span>•</span>
                        <span>Team: {r.size}</span>
                      </>
                    )}
                    {r.budgetRange && (
                      <>
                        <span>•</span>
                        <span>Budget: {r.budgetRange}</span>
                      </>
                    )}
                    {r.timeline && (
                      <>
                        <span>•</span>
                        <span>Timeline: {r.timeline}</span>
                      </>
                    )}
                  </div>
                </div>

                <span className="text-[11px] text-slate-500">
                  {r.createdAt.toISOString().slice(0, 10)}
                </span>
              </div>

              {r.projectType && (
                <p className="text-[11px] text-slate-300">
                  <span className="font-medium text-slate-200">
                    Project type:
                  </span>{' '}
                  {r.projectType}
                </p>
              )}

              <pre className="whitespace-pre-wrap rounded bg-slate-950/90 p-2 text-[11px] text-slate-200">
                {r.projectSummary}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
