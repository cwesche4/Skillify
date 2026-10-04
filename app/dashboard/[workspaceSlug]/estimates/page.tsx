import React from 'react'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { EstimatesClient } from '@/components/dashboard/estimates/EstimatesClient'
import { prisma } from '@/lib/db'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getPersistedSchedulingSettings } from '@/lib/scheduling/services/schedulingService'
import { canManageOperations } from '@/lib/workspaces/workspaceRoles'
import type { EstimateListView } from '@/lib/estimates/types'

type PageProps = {
  params: { workspaceSlug: string }
  searchParams?: {
    estimateId?: string
    leadId?: string
    customerId?: string
    create?: string
    view?: string
  }
}

const canonicalViews: Record<string, EstimateListView> = {
  all: 'ALL',
  drafts: 'DRAFT',
  'awaiting-decision': 'AWAITING_DECISION',
  'expiring-soon': 'EXPIRING_SOON',
  expired: 'EXPIRED',
  'past-expiry': 'EXPIRED',
  PAST_EXPIRY: 'EXPIRED',
  'delivery-failed': 'DELIVERY_FAILED',
  'ready-to-create-work': 'READY_TO_CREATE_WORK',
  'work-created': 'WORK_CREATED',
  presented: 'PRESENTED',
  accepted: 'ACCEPTED',
  declined: 'DECLINED',
  voided: 'VOIDED',
  archived: 'ARCHIVED',
}

export default async function EstimatesPage({
  params,
  searchParams,
}: PageProps) {
  const { userId } = auth()
  if (!userId) redirect('/sign-in')
  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    select: { id: true },
  })
  if (!profile) redirect('/onboarding/create-workspace')
  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    select: {
      id: true,
      slug: true,
      businessModel: true,
      members: {
        where: { userId: profile.id },
        select: { role: true },
        take: 1,
      },
    },
  })
  if (
    !workspace ||
    workspace.businessModel !==
      WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS ||
    !canManageOperations(workspace.members[0]?.role)
  ) {
    redirect(workspace ? `/dashboard/${workspace.slug}` : '/dashboard')
  }
  const [members, teams, schedulingSettings] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      select: {
        id: true,
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.workspaceTeam.findMany({
      where: {
        workspaceId: workspace.id,
        isActive: true,
        archivedAt: null,
      },
      select: { id: true, name: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    }),
    getPersistedSchedulingSettings({
      workspaceId: workspace.id,
      businessModel: workspace.businessModel,
    }),
  ])
  return (
    <DashboardShell className="max-w-7xl">
      <EstimatesClient
        workspaceId={workspace.id}
        workspaceSlug={workspace.slug}
        initialEstimateId={searchParams?.estimateId}
        initialLeadId={searchParams?.leadId}
        initialCustomerId={searchParams?.customerId}
        initialCreate={searchParams?.create === '1'}
        initialView={canonicalViews[searchParams?.view ?? 'all'] ?? 'ALL'}
        timezone={schedulingSettings.timezone}
        members={members.map((member) => ({
          id: member.id,
          name: member.user.fullName || member.user.email || 'Workspace member',
        }))}
        teams={teams}
      />
    </DashboardShell>
  )
}
