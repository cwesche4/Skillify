import React from 'react'
import { auth } from '@clerk/nextjs/server'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { WorkspaceCommandCenter } from '@/components/dashboard/command-center/WorkspaceCommandCenter'
import { OperationalDashboard } from '@/components/dashboard/operations/OperationalDashboard'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'
import { WorkspaceSetup } from '@/components/workspaces/WorkspaceSetup'
import { prisma } from '@/lib/db'
import { loadOperationalDashboard } from '@/lib/dashboard/operationalDashboard'
import { buildWorkspaceCommandCenterData } from '@/lib/dashboard/workspaceCommandData'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getPersistedSchedulingSettings } from '@/lib/scheduling/services/schedulingService'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { canManageWorkspace } from '@/lib/workspaces/workspaceRoles'

type WorkspacePageProps = {
  params: { workspaceSlug: string }
}

export default async function WorkspaceHomePage({
  params,
}: WorkspacePageProps) {
  const { userId: clerkId } = auth()
  if (!clerkId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { userId: profile.id } },
    },
    include: {
      members: true,
    },
  })
  if (!workspace) return null

  const membership = workspace.members.find(
    (member) => member.userId === profile.id,
  )
  if (!membership) return null
  const capabilities = getWorkspaceCapabilities(workspace as any)

  let dashboard: React.ReactNode
  if (
    workspace.businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
  ) {
    const schedulingSettings = await getPersistedSchedulingSettings({
      workspaceId: workspace.id,
      businessModel: workspace.businessModel,
      capabilities: capabilities.scheduling,
    })
    const data = await loadOperationalDashboard({
      workspaceId: workspace.id,
      workspaceSlug: workspace.slug,
      workspaceName: workspace.businessName ?? workspace.name,
      workspaceMemberId: membership.id,
      role: membership.role,
      timezone: schedulingSettings.timezone,
    })
    dashboard = <OperationalDashboard data={data} />
  } else {
    const automations = await prisma.automation.findMany({
      where: { workspaceId: workspace.id },
      include: {
        simpleAutomationInstallation: { select: { id: true } },
        runs: {
          orderBy: { startedAt: 'desc' },
          take: 100,
        },
      },
    })
    const runs = automations
      .flatMap((automation) =>
        automation.runs.map((run) => ({
          id: run.id,
          automationId: automation.id,
          automationName: automation.name,
          status: run.status,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          durationMs: run.durationMs,
          managedBySimple: Boolean(automation.simpleAutomationInstallation),
        })),
      )
      .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    const data = buildWorkspaceCommandCenterData({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        members: workspace.members,
        automations: automations.map((automation) => ({
          id: automation.id,
          name: automation.name,
          status: automation.status,
          managedBySimple: Boolean(automation.simpleAutomationInstallation),
          runs: runs.filter((run) => run.automationId === automation.id),
        })),
      },
      runs,
      capabilities,
    })
    dashboard = <WorkspaceCommandCenter data={data} />
  }

  return (
    <DashboardShell>
      {dashboard}

      <div className="mt-10 space-y-6">
        <WorkspaceSetup
          workspaceId={workspace.id}
          workspaceSlug={workspace.slug}
          workspaceName={workspace.businessName ?? workspace.name}
          initialBusinessType={workspace.industry}
          canManageSetup={canManageWorkspace(membership?.role)}
          showLauncher
        />
        <BuildRequestCallout workspaceId={workspace.id} />
      </div>
    </DashboardShell>
  )
}
