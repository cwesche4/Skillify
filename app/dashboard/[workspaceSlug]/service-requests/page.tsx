import React from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { JobsClient } from '@/components/dashboard/jobs/JobsClient'
import { prisma } from '@/lib/db'
import { canAccessServiceRequests } from '@/lib/permissions/workspace'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'

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
          id: true,
          userId: true,
          role: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      },
      workspaceTeams: {
        where: { isActive: true, archivedAt: null },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
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
      businessModel: workspace.businessModel,
    })
  ) {
    redirect(`/dashboard/${params.workspaceSlug}`)
  }
  return (
    <DashboardShell className="max-w-7xl">
      <JobsClient
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        currentMemberId={membership.id}
        canManage={canManageOperations(membership.role)}
        durableCustomersEnabled={
          workspace.businessModel ===
          WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
        }
        members={workspace.members.map((member) => ({
          id: member.id,
          role: member.role,
          name: member.user.fullName || member.user.email || 'Workspace member',
        }))}
        teams={workspace.workspaceTeams}
      />
    </DashboardShell>
  )
}
