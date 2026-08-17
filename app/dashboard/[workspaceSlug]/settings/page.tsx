// app/dashboard/[workspaceSlug]/settings/page.tsx
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { DangerZone } from '@/components/settings/DangerZone'
import { getWorkspacePlan } from '@/lib/subscriptions/getWorkspacePlan'
import RenameWorkspace from '@/components/workspaces/RenameWorkspace'
import { SalesProcessSettings } from '@/components/workspaces/SalesProcessSettings'
import { OperationsConfigurationSettings } from '@/components/workspaces/OperationsConfigurationSettings'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { PageHeader } from '@/components/dashboard/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { WorkspaceAIConfiguration } from '@/components/settings/WorkspaceAIConfiguration'
import { ensureWorkspaceAIProfile } from '@/lib/ai/ensureWorkspaceAIProfile'
import { WorkspaceLocationsPanel } from '@/components/workspace-structure/WorkspaceLocationsPanel'
import { createMockWorkspaceClients } from '@/lib/clients/mockClients'
import { createMockServiceRequests } from '@/lib/service-requests/mockServiceRequests'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { getWorkspaceRecordTerminology } from '@/lib/workspaces/workspacePresentation'

type SettingsPageProps = {
  params: { workspaceSlug: string }
}

export default async function WorkspaceSettingsPage({
  params,
}: SettingsPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  })
  if (!profile) return null

  const workspace = await prisma.workspace.findUnique({
    where: { slug: params.workspaceSlug },
    include: { members: true },
  })
  if (!workspace) {
    return (
      <DashboardShell>
        <EmptyState
          title="Workspace not found"
          description="The requested workspace could not be loaded."
        />
      </DashboardShell>
    )
  }

  const isMember = workspace.members.some((m) => m.userId === profile.id)
  if (!isMember) {
    return (
      <DashboardShell>
        <EmptyState
          title="Access denied"
          description="You are not a member of this workspace."
        />
      </DashboardShell>
    )
  }

  const planLabel = await getWorkspacePlan(workspace.id, userId)
  const statusLabel = profile.subscription?.status ?? 'active'
  const currentMember = workspace.members.find((m) => m.userId === profile.id)
  const isOwner = currentMember?.role === 'OWNER'
  const canRename = isOwner || currentMember?.role === 'ADMIN'
  const capabilities = getWorkspaceCapabilities(workspace as any)
  const terminology = getWorkspaceRecordTerminology(capabilities)
  const aiProfile = await ensureWorkspaceAIProfile(workspace.id, profile.id)
  const aiActivity = await (prisma as any).workspaceAIActivity?.findMany?.({
    where: { workspaceId: workspace.id },
    orderBy: { createdAt: 'desc' },
    take: 5,
  })

  return (
    <DashboardShell>
      <PageHeader
        title="Settings"
        description="Configure workspace preferences, integrations, and system behavior."
      />

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Workspace</h2>
          <div>
            <p className="font-medium">{workspace.name}</p>
            <p className="text-neutral-text-secondary text-xs">
              Slug: <code>{workspace.slug}</code>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Members:</span>
            <Badge variant="blue">{workspace.members.length}</Badge>
          </div>
          {canRename && (
            <RenameWorkspace
              workspaceId={workspace.id}
              currentName={workspace.name}
            />
          )}
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Plan & Billing</h2>
          <div className="flex items-center gap-2">
            <span>Current plan:</span>
            <Badge>{planLabel}</Badge>
          </div>
          <p className="text-neutral-text-secondary text-xs">
            Status: <span className="font-medium">{statusLabel}</span>
          </p>
          <div className="flex gap-2">
            <Button size="sm">Upgrade plan</Button>
            <Button size="sm" variant="outline">
              Billing portal
            </Button>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Workspace Setup & Readiness</h2>
          <p className="text-neutral-text-secondary text-xs">
            Review onboarding, required configuration, and workspace health.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href={`/dashboard/${params.workspaceSlug}/settings/setup`}>
              Review setup readiness
            </a>
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Workspace Knowledge</h2>
          <p className="text-neutral-text-secondary text-xs">
            Review governed workspace facts, approvals, gaps, corrections, and
            AI confidence signals.
          </p>
          <Button asChild size="sm" variant="outline">
            <a
              href={`/dashboard/${params.workspaceSlug}/settings/workspace-knowledge`}
            >
              Review workspace knowledge
            </a>
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Integrations</h2>
          <p className="text-neutral-text-secondary text-xs">
            Connect your CRM on Pro; webhooks and bidirectional sync require
            Elite.
          </p>
          <Button asChild size="sm" variant="primary">
            <a
              href={`/dashboard/${params.workspaceSlug}/settings/integrations`}
            >
              Manage integrations
            </a>
          </Button>
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Audit log</h2>
          <p className="text-neutral-text-secondary text-xs">
            Review CRM/webhook/security events for this workspace.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href={`/dashboard/${params.workspaceSlug}/settings/audit`}>
              View audit log
            </a>
          </Button>
        </Card>

        <SalesProcessSettings
          workspaceId={workspace.id}
          initialConfig={workspace as any}
          canEdit={canRename}
          activeOpportunityCount={0}
        />

        {capabilities.modules.clients &&
        !capabilities.commerce.commerceEnabled ? (
          <OperationsConfigurationSettings
            workspaceId={workspace.id}
            clients={createMockWorkspaceClients(workspace.id)}
            serviceRequests={createMockServiceRequests(workspace.id)}
            terminology={terminology}
            canEdit={canRename}
          />
        ) : null}

        <WorkspaceLocationsPanel
          workspaceId={workspace.id}
          workspaceTimezone={(workspace as any).timezone ?? 'America/New_York'}
          canManage={canRename}
        />

        <Card
          id="ai-configuration"
          className="scroll-mt-24 space-y-3 p-5 md:col-span-2"
        >
          <WorkspaceAIConfiguration
            workspaceId={workspace.id}
            canEdit={canRename}
            initialProfile={
              (aiProfile ?? {
                enabled: false,
                status: 'NOT_CONFIGURED',
                businessSummary: null,
                productsAndServices: null,
                operatingGuidelines: null,
                brandVoice: null,
                customerPolicies: null,
                automationGuardrails: null,
              }) as any
            }
            initialActivity={(aiActivity ?? []) as any}
            workspaceConfig={workspace as any}
          />
        </Card>

        <Card className="space-y-3 p-5">
          <h2 className="text-sm font-semibold">Manage Workspaces</h2>
          <p className="text-neutral-text-secondary text-xs">
            Review every workspace you belong to, switch organizations, and
            manage workspace lifecycle.
          </p>
          <Button asChild size="sm" variant="outline">
            <a href={`/dashboard/${params.workspaceSlug}/settings/workspaces`}>
              Open workspace manager
            </a>
          </Button>
        </Card>

        <DangerZone
          canDelete={isOwner}
          workspaceId={workspace.id}
          workspaceName={workspace.name}
        />
      </div>
    </DashboardShell>
  )
}
