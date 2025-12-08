// app/dashboard/[workspaceSlug]/settings/page.tsx
import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

type SettingsPageProps = {
  params: { workspaceSlug: string }
}

export default async function WorkspaceSettingsPage({
  params,
}: SettingsPageProps) {
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
    include: {
      members: true,
    },
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
      <h1 className="h2 mb-6">Workspace Settings</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Workspace details */}
        <Card className="space-y-3 p-5">
          <h2 className="text-neutral-text-primary text-sm font-semibold">
            Workspace
          </h2>

          <div>
            <p className="text-base font-medium">{workspace.name}</p>
            <p className="text-neutral-text-secondary text-xs">
              Slug: <code>{workspace.slug}</code>
            </p>
          </div>

          <div className="text-neutral-text-secondary flex items-center gap-2 text-xs">
            <span>Members:</span>
            <Badge variant="blue">{workspace.members.length}</Badge>
          </div>

          <div className="pt-2">
            <Button variant="outline" size="sm">
              Rename workspace
            </Button>
          </div>
        </Card>

        {/* Plan & billing summary */}
        <Card className="space-y-3 p-5">
          <h2 className="text-neutral-text-primary text-sm font-semibold">
            Plan & Billing
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-sm">Current plan:</span>
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

          <div className="flex gap-2 pt-2">
            <Button size="sm">Upgrade plan</Button>
            <Button variant="outline" size="sm">
              Open billing portal
            </Button>
          </div>
        </Card>
      </div>
    </DashboardShell>
  )
}
