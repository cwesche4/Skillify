import { auth } from '@clerk/nextjs/server'

import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { WorkspaceCommandCenter } from '@/components/dashboard/command-center/WorkspaceCommandCenter'
import { BuildRequestCallout } from '@/components/upsell/BuildRequestCallout'
import { WorkspaceSetup } from '@/components/workspaces/WorkspaceSetup'
import { prisma } from '@/lib/db'
import { buildWorkspaceCommandCenterData } from '@/lib/dashboard/workspaceCommandData'
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

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: {
      members: true,
      automations: {
        include: {
          runs: {
            orderBy: { startedAt: 'desc' },
            take: 100,
          },
        },
      },
    },
  })
  if (!workspace) return null

  const runs = workspace.automations
    .flatMap((automation) =>
      automation.runs.map((run) => ({
        id: run.id,
        automationId: automation.id,
        automationName: automation.name,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        durationMs: run.durationMs,
      })),
    )
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())

  const data = buildWorkspaceCommandCenterData({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      members: workspace.members,
      automations: workspace.automations.map((automation) => ({
        id: automation.id,
        name: automation.name,
        status: automation.status,
        runs: runs.filter((run) => run.automationId === automation.id),
      })),
    },
    runs,
    capabilities: getWorkspaceCapabilities(workspace as any),
  })
  const membership = workspace.members.find(
    (member) => member.userId === profile.id,
  )

  return (
    <DashboardShell>
      <WorkspaceCommandCenter data={data} />

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
