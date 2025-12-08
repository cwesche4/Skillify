// app/dashboard/[workspaceSlug]/admin/upsells/page.tsx

import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { requireWorkspaceAdmin } from '@/lib/auth/currentUser'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface PageProps {
  params: { workspaceSlug: string }
}

// Infer the proper type shape from your query
type UpsellWithRelations = Awaited<
  ReturnType<typeof prisma.upsellRequest.findMany>
>[number]

export default async function UpsellsAdminPage({ params }: PageProps) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  })

  if (!workspace) {
    notFound()
  }

  await requireWorkspaceAdmin(workspace.id)

  const upsells = await prisma.upsellRequest.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
      automation: true,
    },
  })

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-50">Upsell Requests</h1>
        <p className="text-sm text-slate-400">
          Micro builds and full DFY requests submitted from this workspace.
        </p>
      </div>

      {upsells.length === 0 ? (
        <Card className="p-4 text-sm text-slate-400">
          No upsell requests yet. When users request DFY help from the builder,
          they&apos;ll show up here.
        </Card>
      ) : (
        <div className="space-y-3">
          {upsells.map((u: UpsellWithRelations) => (
            <Card
              key={u.id}
              className="space-y-2 border border-slate-800 bg-slate-950/80 p-3 text-xs text-slate-200"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge
                    size="xs"
                    variant={u.type === 'micro' ? 'blue' : 'default'}
                  >
                    {u.type === 'micro' ? 'Micro' : u.type}
                  </Badge>

                  <span className="text-slate-300">
                    {u.automation
                      ? `Automation: ${u.automation.name}`
                      : 'Created outside a specific automation'}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{u.userId}</span>
                  <span>•</span>
                  <span>{u.status}</span>
                  <span>•</span>
                  <span>{u.createdAt.toISOString().slice(0, 10)}</span>
                </div>
              </div>

              <pre className="whitespace-pre-wrap rounded bg-slate-900/80 p-2 text-[11px] text-slate-200">
                {u.description}
              </pre>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
