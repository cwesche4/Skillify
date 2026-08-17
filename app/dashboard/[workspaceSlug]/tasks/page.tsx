import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { TasksClient } from '@/components/dashboard/tasks/TasksClient'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import { prisma } from '@/lib/db'
import { demoLeads, demoOpportunities } from '@/lib/sales/demoSalesRecords'
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

export default async function TasksPage({ params }: PageProps) {
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
        where: { userId: profile.id },
        select: { role: true },
      },
    },
  })
  if (!workspace) redirect('/dashboard')

  const membership = workspace.members[0]
  if (!membership) redirect('/dashboard')
  const capabilities = getWorkspaceCapabilities(workspace as any)
  const terminology = getWorkspaceRecordTerminology(capabilities)

  return (
    <TasksClient
      tasks={createMockWorkspaceTasks(workspace.id)}
      clients={createMockWorkspaceClients(workspace.id)}
      serviceRequests={createMockServiceRequests(workspace.id)}
      leads={demoLeads}
      opportunities={demoOpportunities}
      workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
      canManageOwners={canManageWorkspaceOwners(membership.role)}
      terminology={terminology}
    />
  )
}
