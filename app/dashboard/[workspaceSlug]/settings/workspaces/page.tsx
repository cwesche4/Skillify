import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { ManageWorkspacesClient } from '@/components/workspaces/ManageWorkspacesClient'
import { prisma } from '@/lib/db'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function ManageWorkspacesPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const memberships = await prisma.workspaceMember.findMany({
    where: { user: { clerkId: userId } },
    include: {
      workspace: {
        include: {
          owner: { select: { fullName: true, email: true } },
          members: { select: { id: true } },
          subscription: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  if (!memberships.length) redirect('/onboarding/create-workspace')

  const canAccessCurrent = memberships.some(
    (membership) => membership.workspace.slug === params.workspaceSlug,
  )
  if (!canAccessCurrent) redirect(`/dashboard/${memberships[0].workspace.slug}`)

  return (
    <DashboardShell className="max-w-6xl">
      <PageHeader
        title="Manage Workspaces"
        description="Switch between organizations, review workspace plans, and manage workspace lifecycle."
      />
      <ManageWorkspacesClient
        currentSlug={params.workspaceSlug}
        workspaces={memberships.map((membership) => ({
          id: membership.workspace.id,
          name: membership.workspace.name,
          slug: membership.workspace.slug,
          businessModel: (membership.workspace as any).businessModel,
          plan: membership.workspace.subscription?.plan ?? 'Free',
          renewalDate:
            membership.workspace.subscription?.currentPeriodEnd ?? null,
          ownerName:
            membership.workspace.owner.fullName ??
            membership.workspace.owner.email ??
            'Owner',
          membersCount: membership.workspace.members.length,
          createdAt: membership.workspace.createdAt,
          archivedAt: (membership.workspace as any).archivedAt ?? null,
          memberRole: membership.role,
        }))}
      />
    </DashboardShell>
  )
}
