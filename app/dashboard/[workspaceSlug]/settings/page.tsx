// app/dashboard/[workspaceSlug]/settings/page.tsx
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
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
    include: { subscription: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: { members: true },
  })
  if (!workspace) {
    return <h1 className="text-lg font-semibold">Workspace not found</h1>
  }

  const isMember = workspace.members.some((m) => m.userId === profile.id)
  if (!isMember) {
    return (
      <>
        <h1 className="text-lg font-semibold">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </>
    )
  }

  const planLabel = profile.subscription?.plan ?? 'Free'
  const statusLabel = profile.subscription?.status ?? 'inactive'

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Workspace Settings</h1>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <div>
            <p className="font-medium">{workspace.name}</p>
            <p className="text-neutral-text-secondary text-xs">
              Slug: <code>{workspace.slug}</code>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Members:</span>
            <Badge variant="blue">{workspace.members.length}</Badge>
          </div>
          <Button size="sm" variant="outline">
            Rename workspace
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Plan & Billing</h2>
          <div className="flex items-center gap-2">
            <span>Current plan:</span>
            <Badge>{planLabel}</Badge>
          </div>
          <p className="text-neutral-text-secondary text-xs">
            Status: <span className="font-medium">{statusLabel}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm">Upgrade plan</Button>
            <Button size="sm" variant="outline">
              Billing portal
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Integrations</h2>
          <p className="text-neutral-text-secondary text-xs">
            Connect your CRM on Pro; webhooks and bidirectional sync require Elite.
          </p>
          <Button
            asChild
            size="sm"
            variant="primary"
          >
            <a href={`/dashboard/${params.workspaceSlug}/settings/integrations`}>
              Manage integrations
            </a>
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Audit log</h2>
          <p className="text-neutral-text-secondary text-xs">
            Review CRM/webhook/security events for this workspace.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href={`/dashboard/${params.workspaceSlug}/settings/audit`}>View audit log</a>
          </Button>
        </Card>
      </div>
    </div>
  )
}
