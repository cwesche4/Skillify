// app/dashboard/[workspaceSlug]/upsells/page.tsx

import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'

import { prisma } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

const SERVICE_OPTIONS = [
  'Automation Build',
  'CRM Setup',
  'AI Chatbot',
  'Review System',
  'Website / Funnel',
  'Custom Integration',
]

function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function statusVariant(status: string) {
  const normalized = status.toLowerCase()
  if (['approved', 'completed', 'closed'].includes(normalized)) return 'green'
  if (
    ['reviewing', 'in_progress', 'pending', 'new', 'open'].includes(normalized)
  ) {
    return 'blue'
  }
  if (['rejected', 'declined', 'canceled'].includes(normalized)) return 'red'
  return 'slate'
}

export default async function WorkspaceUpsellsPage({
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
      slug: true,
    },
  })

  if (!workspace) notFound()

  const requests = await prisma.upsellRequest.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    include: {
      automation: {
        select: {
          name: true,
        },
      },
    },
  })

  return (
    <div className="space-y-6 p-6">
      <section className="space-y-1">
        <h1 className="text-2xl font-semibold text-slate-50">
          Service Requests
        </h1>
        <p className="max-w-2xl text-sm text-slate-400">
          Request additional automations, integrations, or done-for-you support
          from Skillify for {workspace.name}.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SERVICE_OPTIONS.map((option) => (
          <Card
            key={option}
            className="flex min-h-32 flex-col justify-between border-slate-800/80 bg-slate-950/70 p-4"
          >
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{option}</h2>
              <p className="mt-1 text-xs text-slate-500">
                Tell us what you need and we will follow up with next steps.
              </p>
            </div>
            <Button asChild size="sm" variant="secondary" className="mt-4">
              <Link href={`/dashboard/${workspace.slug}/upsell`}>
                Request service
              </Link>
            </Button>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Your Requests
          </h2>
          <p className="text-sm text-slate-500">
            Requests shown here are scoped to this workspace only.
          </p>
        </div>

        {requests.length === 0 ? (
          <Card className="border-dashed border-slate-800/80 bg-slate-950/60 p-6 text-sm text-slate-400">
            No service requests yet.
          </Card>
        ) : (
          <Card className="overflow-hidden border-slate-800/80 bg-slate-950/80">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] divide-y divide-slate-800/80 text-left text-sm">
                <thead className="bg-slate-900/70 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Request</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Automation</th>
                    <th className="px-5 py-3 text-right font-medium">
                      Submitted
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {requests.map((request) => (
                    <tr
                      key={request.id}
                      className="align-top text-slate-200 hover:bg-slate-900/45"
                    >
                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-50">
                            {request.type}
                          </div>
                          <p className="line-clamp-2 text-xs text-slate-400">
                            {request.description}
                          </p>
                          <details className="text-[11px] text-slate-500">
                            <summary className="cursor-pointer select-none">
                              Details
                            </summary>
                            <div className="mt-1 space-y-1">
                              <p className="whitespace-pre-wrap text-slate-400">
                                {request.description}
                              </p>
                              <div className="font-mono">ID: {request.id}</div>
                            </div>
                          </details>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          size="xs"
                          variant={statusVariant(request.status)}
                        >
                          {request.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-slate-300">
                        {request.automation?.name ??
                          'Not tied to an automation'}
                      </td>
                      <td className="px-5 py-4 text-right text-slate-400">
                        {formatDate(request.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  )
}
