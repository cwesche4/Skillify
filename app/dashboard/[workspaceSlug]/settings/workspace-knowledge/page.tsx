import { auth } from '@clerk/nextjs/server'

import { Button } from '@/components/ui/Button'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/dashboard/PageHeader'
import {
  WorkspaceKnowledgeManager,
  type WorkspaceKnowledgeManagerItem,
} from '@/components/settings/WorkspaceKnowledgeManager'
import { prisma } from '@/lib/db'
import { loadPersistedWorkspaceKnowledgeSnapshot } from '@/lib/intelligence/workspaceKnowledgeStore'

type WorkspaceKnowledgeSettingsPageProps = {
  params: { workspaceSlug: string }
}

export default async function WorkspaceKnowledgeSettingsPage({
  params,
}: WorkspaceKnowledgeSettingsPageProps) {
  const { userId } = auth()
  if (!userId) return null

  const profile = await prisma.userProfile.findUnique({
    where: { clerkId: userId },
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

  const currentMember = workspace.members.find(
    (member) => member.userId === profile.id,
  )
  if (!currentMember) {
    return (
      <DashboardShell>
        <EmptyState
          title="Access denied"
          description="You are not a member of this workspace."
        />
      </DashboardShell>
    )
  }

  const [snapshot, rawItems, auditEvents, teams, locations] = await Promise.all(
    [
      loadPersistedWorkspaceKnowledgeSnapshot({
        workspaceId: workspace.id,
      }),
      (prisma as any).workspaceKnowledgeItem.findMany({
        where: { workspaceId: workspace.id },
        include: {
          source: true,
          revisions: { orderBy: [{ version: 'desc' }, { createdAt: 'desc' }] },
          approvals: { orderBy: { createdAt: 'desc' } },
          corrections: { orderBy: { createdAt: 'desc' } },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        take: 150,
      }),
      (prisma as any).workspaceLearningEvent.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { createdAt: 'desc' },
        take: 40,
      }),
      prisma.workspaceTeam.findMany({
        where: { workspaceId: workspace.id, isActive: true, archivedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.workspaceLocation.findMany({
        where: { workspaceId: workspace.id, isActive: true, archivedAt: null },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ],
  )

  return (
    <DashboardShell>
      <PageHeader
        title="Workspace Knowledge"
        description="Manage the approved facts, policies, preferences, and operating guidance Workspace AI is allowed to use."
        actions={
          <Button asChild variant="outline" size="sm">
            <a href={`/dashboard/${params.workspaceSlug}/settings`}>
              Back to settings
            </a>
          </Button>
        }
      />

      <WorkspaceKnowledgeManager
        workspaceId={workspace.id}
        workspaceSlug={params.workspaceSlug}
        userRole={
          String(currentMember.role).toLowerCase() as
            | 'owner'
            | 'admin'
            | 'manager'
            | 'member'
        }
        initialItems={rawItems.map(serializeKnowledgeItem)}
        auditEvents={auditEvents.map((event: any) => ({
          id: event.id,
          eventType: event.eventType,
          summary: event.summary,
          createdAt: serializeDate(event.createdAt),
        }))}
        knowledgeGaps={snapshot.knowledgeGaps.map((gap) => ({
          id: gap.id,
          title: gap.title,
          description: gap.description,
          severity: gap.severity,
          frequency: gap.frequency,
        }))}
        recommendationHistory={snapshot.recommendationHistory.map(
          (outcome) => ({
            id: outcome.id,
            recommendationId: outcome.recommendationId,
            recommendationTitle: outcome.notes ?? outcome.recommendationId,
            status: outcome.status,
            occurredAt: outcome.occurredAt,
          }),
        )}
        confidence={{
          level: snapshot.confidence.level,
          score: snapshot.confidence.score,
          known: snapshot.confidence.known,
          unknown: snapshot.confidence.unknown,
          missingData: snapshot.confidence.missingData,
          recommendedNextIntegrations:
            snapshot.confidence.recommendedNextIntegrations,
        }}
        selectorTargets={{
          teams: teams.map((team) => ({
            id: team.id,
            label: team.name,
            type: 'team' as const,
          })),
          locations: locations.map((location) => ({
            id: location.id,
            label: location.name,
            type: 'location' as const,
          })),
          serviceTypes: [],
          customerSegments: [],
        }}
      />
    </DashboardShell>
  )
}

function serializeKnowledgeItem(row: any): WorkspaceKnowledgeManagerItem {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    description: row.description,
    structuredValue: row.structuredValue,
    sourceSummary: row.sourceSummary,
    confidence: row.confidence,
    approvalStatus: row.approvalStatus,
    createdById: row.createdById,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt ? serializeDate(row.approvedAt) : null,
    reason: row.reason,
    tags: row.tags ?? [],
    version: row.version,
    isArchived: Boolean(row.isArchived),
    supersededById: row.supersededById,
    createdAt: serializeDate(row.createdAt),
    updatedAt: serializeDate(row.updatedAt),
    source: row.source
      ? {
          id: row.source.id,
          type: row.source.type,
          label: row.source.label,
          domain: row.source.domain,
          recordType: row.source.recordType,
          recordId: row.source.recordId,
          referenceId: row.source.referenceId,
        }
      : null,
    revisions: (row.revisions ?? []).map((revision: any) => ({
      id: revision.id,
      version: revision.version,
      revisionType: revision.revisionType,
      title: revision.title,
      changeSummary: revision.changeSummary,
      createdAt: serializeDate(revision.createdAt),
    })),
    approvals: (row.approvals ?? []).map((approval: any) => ({
      id: approval.id,
      action: approval.action,
      actorRole: approval.actorRole,
      reason: approval.reason,
      createdAt: serializeDate(approval.createdAt),
    })),
    corrections: (row.corrections ?? []).map((correction: any) => ({
      id: correction.id,
      correctionText: correction.correctionText,
      status: correction.status,
      createdAt: serializeDate(correction.createdAt),
    })),
  }
}

function serializeDate(value: Date | string) {
  return value instanceof Date
    ? value.toISOString()
    : new Date(value).toISOString()
}
