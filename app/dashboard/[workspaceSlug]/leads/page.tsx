import React from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { LeadsClient } from '@/components/dashboard/sales/LeadsClient'
import { DurableLeadsClient } from '@/components/dashboard/leads/DurableLeadsClient'
import { prisma } from '@/lib/db'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getPersistedSchedulingSettings } from '@/lib/scheduling/services/schedulingService'
import {
  canManageWorkspaceOwners,
  createDemoWorkspaceOwners,
} from '@/lib/workspace-ownership'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function LeadsPage({ params }: PageProps) {
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
          id: true,
          userId: true,
          role: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    },
  })
  if (!workspace) redirect('/dashboard')

  const membership = workspace.members.find(
    (member) => member.userId === profile.id,
  )
  if (!membership) redirect('/dashboard')
  const capabilities = getWorkspaceCapabilities(workspace as any)
  if (!capabilities.modules.leads) redirect(`/dashboard/${workspace.slug}`)

  if (
    workspace.businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
  ) {
    if (!canManageOperations(membership.role)) {
      redirect(`/dashboard/${workspace.slug}`)
    }
    const schedulingSettings = await getPersistedSchedulingSettings({
      workspaceId: workspace.id,
      businessModel: workspace.businessModel,
      capabilities: capabilities.scheduling,
    })
    return (
      <DurableLeadsClient
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        workspaceTimezone={schedulingSettings.timezone}
        members={workspace.members.map((member) => ({
          id: member.id,
          role: member.role,
          name: member.user.fullName || member.user.email || 'Workspace member',
        }))}
      />
    )
  }

  return (
    <LeadsClient
      workspaceId={workspace.id}
      workspaceSlug={workspace.slug}
      workspaceTimezone={(workspace as any).timezone ?? 'America/New_York'}
      workspaceOwners={createDemoWorkspaceOwners(workspace.id)}
      capabilities={capabilities}
      canEditOwners={canManageWorkspaceOwners(membership.role)}
    />
  )
}
