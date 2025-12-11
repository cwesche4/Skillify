// app/dashboard/admin/enterprise/page.tsx

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireWorkspaceAdmin } from '@/lib/auth/currentUser'
import { requirePlan } from '@/lib/auth/route-guard'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface PageProps {
  params: { workspaceSlug: string }
}

export default async function EnterpriseAdminPage({ params }: PageProps) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  })

  if (!workspace) {
    notFound()
  }

  // Workspace OWNER/ADMIN
  await requireWorkspaceAdmin(workspace.id)

  // Elite plan required for enterprise admin
  await requirePlan('Elite', workspace.id)

  const consults = await prisma.enterpriseConsultRequest.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">
          Enterprise Consult Requests
        </h1>
        <p className="text-sm text-slate-400">
          High-intent leads who want you to build the whole system for them.
        </p>
      </div>

      {consults.length === 0 ? (
        <Card className="p-4 text-sm text-slate-400">
          No enterprise consult requests yet. When teams ask for a full
          build-out, they&apos;ll show up here.
        </Card>
      ) : (
        <div className="space-y-3">
          {consults.map((c: (typeof consults)[number]) => (
            <Card
              key={c.id}
              className="space-y-2 border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-50">{c.name}</span>
                    <Badge size="xs" variant="blue">
                      {c.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span>{c.email}</span>
                    {c.phone && (
                      <>
                        <span>•</span>
                        <span>{c.phone}</span>
                      </>
                    )}
                    {c.companySize && (
                      <>
                        <span>•</span>
                        <span>Size: {c.companySize}</span>
                      </>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-slate-500">
                  {c.createdAt.toISOString().slice(0, 10)}
                </span>
              </div>

              {c.projectGoal && (
                <p className="text-[11px] font-medium text-slate-200">
                  Goal:{' '}
                  <span className="font-normal text-slate-300">
                    {c.projectGoal}
                  </span>
                </p>
              )}

              <pre className="whitespace-pre-wrap rounded bg-slate-900/80 p-2 text-[11px] text-slate-200">
                {c.description}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
