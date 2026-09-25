import { auth } from '@clerk/nextjs/server'

import { AutomationsSectionHeader } from '@/components/automations/AutomationsSectionHeader'
import { SimpleAutomationsCatalog } from '@/components/automations/SimpleAutomationsCatalog'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { getWorkspaceAutomationCapabilities } from '@/lib/automations/capabilities'
import { canManageAutomations } from '@/lib/automations/policy'
import { getSimpleAutomationReadiness } from '@/lib/automations/simpleAutomationReadiness'
import { getSimpleAutomationsForWorkspace } from '@/lib/automations/simpleAutomationCatalog'
import { prisma } from '@/lib/db'

export default async function SimpleAutomationsPage({
  params,
}: {
  params: { workspaceSlug: string }
}) {
  const { userId } = auth()
  if (!userId) return null

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { user: { clerkId: userId } } },
    },
    select: {
      id: true,
      businessModel: true,
      members: {
        where: { user: { clerkId: userId } },
        select: { role: true },
        take: 1,
      },
      simpleAutomationInstallations: {
        where: { removedAt: null },
        select: {
          id: true,
          definitionKey: true,
          definitionVersion: true,
          automationId: true,
          config: true,
          updatedAt: true,
          automation: { select: { status: true } },
        },
      },
    },
  })
  if (!workspace) return null

  const recipes = getSimpleAutomationsForWorkspace(workspace.businessModel)
  const capabilities = await getWorkspaceAutomationCapabilities(workspace.id)
  const canManage = canManageAutomations(workspace.members[0]?.role)
  const readinessEntries = await Promise.all(
    workspace.simpleAutomationInstallations.map(async (installation) => [
      installation.definitionKey,
      await getSimpleAutomationReadiness({
        workspaceId: workspace.id,
        definitionKey: installation.definitionKey,
        definitionVersion: installation.definitionVersion,
        config: installation.config,
      }),
    ]),
  )

  return (
    <DashboardShell>
      <AutomationsSectionHeader
        workspaceSlug={params.workspaceSlug}
        activeMode="simple"
        showSimpleHistory={canManage}
        description="Set up repetitive work without building a workflow from scratch."
      />

      <SimpleAutomationsCatalog
        recipes={recipes}
        workspaceId={workspace.id}
        workspaceSlug={params.workspaceSlug}
        hasSimpleAutomationCapability={capabilities.canUseStarterAutomations}
        canManage={canManage}
        initialReadiness={Object.fromEntries(readinessEntries)}
        initialInstallations={workspace.simpleAutomationInstallations.map(
          (installation) => ({
            id: installation.id,
            definitionKey: installation.definitionKey,
            definitionVersion: installation.definitionVersion,
            automationId: installation.automationId,
            config: installation.config as Record<
              string,
              string | string[] | boolean
            >,
            updatedAt: installation.updatedAt.toISOString(),
            automationStatus: installation.automation.status,
          }),
        )}
      />
    </DashboardShell>
  )
}
