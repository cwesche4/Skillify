import { auth } from '@clerk/nextjs/server'
import { WorkspaceMemberRole } from '@prisma/client'

import { prisma } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import { AiActionsToggle } from '@/components/settings/AiActionsToggle'

type PageProps = {
  params: { workspaceSlug: string }
}

async function loadSetting(workspaceId: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? ''}/api/workspaces/${workspaceId}/settings/ai-actions`,
      { cache: 'no-store' },
    )
    if (!res.ok) return { enabled: false, errored: true }
    const json = await res.json().catch(() => null)
    return { enabled: Boolean(json?.aiActionsEnabled), errored: false }
  } catch {
    return { enabled: false, errored: true }
  }
}

export default async function AiActionsSettingsPage({ params }: PageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        where: { user: { clerkId } },
        select: { role: true, userId: true },
      },
    },
  })

  if (!workspace) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Workspace not found</h1>
      </div>
    )
  }

  const membership = workspace.members[0]
  if (!membership) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Access denied</h1>
        <p className="text-neutral-text-secondary text-sm">
          You are not a member of this workspace.
        </p>
      </div>
    )
  }

  const isAdmin =
    membership.role === WorkspaceMemberRole.ADMIN ||
    membership.role === WorkspaceMemberRole.OWNER

  if (!isAdmin) {
    return (
      <div className="space-y-2">
        <h1 className="text-xl font-semibold">AI Actions</h1>
        <p className="text-neutral-text-secondary text-sm">
          Only workspace admins can change AI action settings.
        </p>
      </div>
    )
  }

  const aiActionsEnabled = await loadSetting(workspace.id)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">AI Actions</h1>
        <p className="text-neutral-text-secondary text-sm">
          Workspace kill switch for AI-assisted actions. Applies immediately to
          all members.
        </p>
      </div>

      <Card className="space-y-3 p-4">
        <AiActionsToggle
          workspaceId={workspace.id}
          initialEnabled={aiActionsEnabled.enabled}
          initialError={aiActionsEnabled.errored}
        />
      </Card>
    </div>
  )
}
