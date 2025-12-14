// app/dashboard/admin/upsells/page.tsx

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

  // Workspace OWNER/ADMIN
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
            Upsell admin is Elite-only.
          </span>
        </div>
        <p className="text-amber-100/80">
          Upgrade to Elite to manage upsell and DFY requests from this
          workspace.
        </p>
        <Button asChild size="sm" variant="primary">
          <Link href={`/dashboard/${params.workspaceSlug}/upsell?need=Elite`}>
            View Elite benefits
          </Link>
        </Button>
      </Card>
    )
  }

  const upsells = await prisma.upsellRequest.findMany({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    include: {
      user: true,
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
                    {u.automationId
                      ? `Automation ID: ${u.automationId}`
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
