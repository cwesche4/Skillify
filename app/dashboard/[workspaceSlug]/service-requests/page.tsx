import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ServiceRequestsClient } from '@/components/dashboard/service-requests/ServiceRequestsClient'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import { createMockServiceRequests } from '@/lib/service-requests/mockServiceRequests'
import { prisma } from '@/lib/db'
import { canAccessServiceRequests } from '@/lib/permissions/workspace'
import {
  canManageWorkspaceOwners,
  createDemoWorkspaceOwners,
} from '@/lib/workspace-ownership'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getWorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function ServiceRequestsPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: {
        select: {
          userId: true,
          role: true,
        },
      },
    },
  })

  if (!workspace) return null

  const membership = workspace.members.find(
    (member) => member.userId === profile.id,
  )
  if (!membership) redirect('/dashboard')

  if (
    !canAccessServiceRequests({
      workspaceRole: membership.role,
      globalRole: profile.role,
    })
  ) {
    redirect(`/dashboard/${params.workspaceSlug}`)
  }
  const capabilities = getWorkspaceCapabilities(workspace as any)
  const terminology = getWorkspaceRecordTerminology(capabilities)

  const requests = createMockServiceRequests(workspace.id)
  const clients = createMockWorkspaceClients(workspace.id)

  return (
    <DashboardShell className="max-w-7xl">
      <ServiceRequestsClient
        requests={requests}
        clients={clients}
        workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
        canEditOwners={canManageWorkspaceOwners(membership.role)}
        terminology={terminology}
      />
    </DashboardShell>
  )
}
