import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { ClientsClient } from '@/components/dashboard/clients/ClientsClient'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import { prisma } from '@/lib/db'
import { createMockServiceRequests } from '@/lib/service-requests/mockServiceRequests'
import { createMockWorkspaceTasks } from '@/lib/tasks/demoTasks'
import {
  canManageWorkspaceOwners,
  createDemoWorkspaceOwners,
} from '@/lib/workspace-ownership'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getWorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function ClientsPage({ params }: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
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
  const capabilities = getWorkspaceCapabilities(workspace as any)
  if (!capabilities.modules.clients) redirect(`/dashboard/${workspace.slug}`)
  const terminology = getWorkspaceRecordTerminology(capabilities)

  const clients = createMockWorkspaceClients(workspace.id)
  const tasks = createMockWorkspaceTasks(workspace.id)
  const serviceRequests = createMockServiceRequests(workspace.id)

  return (
    <DashboardShell className="max-w-7xl">
      <ClientsClient
        clients={clients}
        tasks={tasks}
        serviceRequests={serviceRequests}
        hasRealClients={false}
        workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
        canEditOwners={canManageWorkspaceOwners(membership.role)}
        terminology={terminology}
        capabilities={capabilities}
      />
    </DashboardShell>
  )
}
