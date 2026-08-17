// app/dashboard/[workspaceSlug]/build-requests/page.tsx

import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'

import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { BuildRequestForm } from '@/components/upsell/BuildRequestForm'

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function statusLabel(status: string) {
  if (status === 'NEW') return 'Submitted'
  if (status === 'REVIEWING') return 'Reviewing'
  if (status === 'CLOSED') return 'Completed'
  return status
}

function statusVariant(status: string) {
  if (status === 'CLOSED') return 'green'
  if (status === 'REVIEWING') return 'blue'
  return 'yellow'
}

export default async function WorkspaceBuildRequestsPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: {
        some: {
          user: { clerkId: userId },
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
  })

  if (!workspace) notFound()

  const requests = await prisma.buildRequest.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-50">Build Requests</h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Track custom automation builds and implementation work requested for
          {workspace.name}.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Your Build Requests
            </h2>
            <p className="text-sm text-slate-500">
              Requests shown here are scoped to this workspace only.
            </p>
          </div>

          {requests.length === 0 ? (
            <Card className="border-dashed border-slate-800/80 bg-slate-950/60 p-6 text-sm text-slate-400">
              No build requests yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {requests.map((request) => (
                <Card
                  key={request.id}
                  className="border-slate-800/80 bg-slate-950/80 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-slate-50">
                          {request.projectType || 'Custom automation build'}
                        </h3>
                        <Badge
                          size="xs"
                          variant={statusVariant(request.status)}
                        >
                          {statusLabel(request.status)}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-sm text-slate-400">
                        {request.projectSummary}
                      </p>
                    </div>
                    <span className="text-xs text-slate-500">
                      {formatDate(request.createdAt)}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                    <div>Timeline: {request.timeline || 'Not provided'}</div>
                    <div>Budget: {request.budgetRange || 'Not provided'}</div>
                  </div>

                  <details className="mt-3 text-[11px] text-slate-500">
                    <summary className="cursor-pointer select-none">
                      Request details
                    </summary>
                    <div className="mt-2 space-y-2">
                      <p className="whitespace-pre-wrap text-slate-400">
                        {request.projectSummary}
                      </p>
                      <div className="font-mono">ID: {request.id}</div>
                      <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-slate-400">
                        Updates and messages will appear here as Skillify
                        reviews this request.
                      </div>
                    </div>
                  </details>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Request a Build
            </h2>
            <p className="text-sm text-slate-500">
              Submit implementation work for this workspace.
            </p>
          </div>
          <BuildRequestForm workspaceId={workspace.id} variant="dashboard" />
        </section>
      </div>
    </div>
  )
}
