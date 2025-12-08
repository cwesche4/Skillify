// app/dashboard/[workspaceSlug]/billing/page.tsx
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type BillingPageProps = {
  params: { workspaceSlug: string }
}

export default async function BillingPage({ params }: BillingPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: {
      subscription: true,
    },
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

  const sub = profile.subscription
  const planLabel = sub?.plan ?? 'Free'
  const statusLabel = sub?.status ?? 'inactive'

  return (
    <DashboardShell>
      <h1 className="h2 mb-6">Billing</h1>

      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-neutral-text-primary text-sm font-semibold">
              Current plan
            </p>
            <p className="text-neutral-text-secondary text-xs">
              Billing is currently tied to your Skillify account.
            </p>
          </div>

          <Badge
            variant={
              planLabel === 'Elite'
                ? 'purple'
                : planLabel === 'Pro'
                  ? 'blue'
                  : 'gray'
            }
          >
            {planLabel}
          </Badge>
        </div>

        <p className="text-neutral-text-secondary text-xs">
          Status: <span className="font-medium">{statusLabel}</span>
        </p>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button size="sm">Upgrade plan</Button>
          <Button variant="outline" size="sm">
            Open billing portal
          </Button>
        </div>

        <p className="text-neutral-text-secondary mt-4 text-xs">
          Stripe or another provider can be wired up here later. For now, this
          page acts as a visible entry point for customers to manage their plan.
        </p>
      </Card>
    </DashboardShell>
  )
}
