// app/dashboard/admin/page.tsx

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/db'
import { requireWorkspaceAdmin } from '@/lib/auth/currentUser'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface PageProps {
  params: { workspaceSlug: string }
}

export default async function AdminIndexPage({ params }: PageProps) {
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
  })

  if (!workspace) {
    notFound()
  }

  // Must be OWNER/ADMIN in this workspace
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
          <span className="font-semibold">Admin tools are Elite-only.</span>
        </div>
        <p className="text-amber-100/80">
          Unlock workspace admin, DFY build management, and enterprise controls
          by upgrading to the Elite plan.
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

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-slate-50">Admin Panel</h1>
      <p className="text-sm text-slate-400">
        Manage workspace-level settings, members, DFY builds, upsells, and
        enterprise consults.
      </p>
    </div>
  )
}
