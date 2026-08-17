// app/dashboard/[workspaceSlug]/layout.tsx
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import WorkspaceShell from './layout.client'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import { getWorkspaceRole } from '@/lib/auth/getWorkspaceRole'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { resolveLeadIntakeSourceCards } from '@/lib/integrations/leadIntake'
import { listWorkspaceIntegrationConnections } from '@/lib/integrations/workspaceConnections'

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { workspaceSlug: string }
}) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const memberships = await prisma.workspaceMember.findMany({
    where: {
      user: { clerkId: userId },
      workspace: { archivedAt: null } as any,
    },
    include: { workspace: { include: { subscription: true } } },
    orderBy: { createdAt: 'asc' },
  })

  if (!memberships.length) {
    redirect('/onboarding/create-workspace')
  }

  const current =
    memberships.find((m) => m.workspace.slug === params.workspaceSlug) ??
    memberships[0]

  if (current.workspace.slug !== params.workspaceSlug) {
    redirect(`/dashboard/${current.workspace.slug}`)
  }

  const plan = await getWorkspacePlan(current.workspace.id, userId)
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { role: true },
  })
  const role =
    (await getWorkspaceRole({
      workspaceSlug: current.workspace.slug,
      clerkId: userId,
    })) ?? (current.role.toLowerCase() as 'owner' | 'admin' | 'member')
  const workspaceConnections = await listWorkspaceIntegrationConnections({
    workspaceId: current.workspace.id,
  })
  const leadIntakeSources = resolveLeadIntakeSourceCards({
    workspaceId: current.workspace.id,
    workspaceSlug: current.workspace.slug,
    connections: workspaceConnections,
  })

  return (
    <WorkspaceShell
      workspaceSlug={current.workspace.slug}
      workspaces={memberships.map((m) => ({
        id: m.workspace.id,
        name: m.workspace.name,
        slug: m.workspace.slug,
        businessName: m.workspace.businessName,
        industry: m.workspace.industry,
        memberRole: m.role,
        plan: m.workspace.subscription?.plan ?? 'Free',
      }))}
      currentWorkspace={{
        id: current.workspace.id,
        name: current.workspace.name,
        slug: current.workspace.slug,
        businessName: current.workspace.businessName,
        industry: current.workspace.industry,
        memberRole: current.role,
        plan: current.workspace.subscription?.plan ?? 'Free',
      }}
      capabilities={getWorkspaceCapabilities(current.workspace as any)}
      role={role}
      globalRole={
        (profile?.role ?? 'user') as
          | 'user'
          | 'admin'
          | 'security'
          | 'legal'
          | 'grc'
      }
      plan={plan}
      leadIntakeSources={leadIntakeSources}
    >
      {children}
    </WorkspaceShell>
  )
}
