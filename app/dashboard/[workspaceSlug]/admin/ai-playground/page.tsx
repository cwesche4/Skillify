import { auth } from '@clerk/nextjs/server'
import { notFound, redirect } from 'next/navigation'

import { InternalAIPlayground } from '@/components/ai/InternalAIPlayground'
import { DashboardShell } from '@/components/dashboard/DashboardShell'
import { Badge } from '@/components/ui/Badge'
import { prisma } from '@/lib/db'
import {
  AI_PLAYGROUND_DOMAINS,
  canUseAIPlayground,
  getAIPlaygroundProviderOptions,
  isAIPlaygroundEnabled,
  type AIPlaygroundContextGroup,
  type AIPlaygroundContextOption,
} from '@/lib/ai/playground/aiPlayground'
import {
  leadStageOptions,
  opportunityStageOptions,
} from '@/lib/crm/pipelineStageRegistry'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'
import { loadSchedulingPageProps } from '@/lib/scheduling/loadSchedulingPageProps'
import {
  formatDateTime,
  formatTimeOnly,
  schedulingStatusLabels,
} from '@/lib/scheduling/schedulingFormatters'
import type { SchedulingEvent } from '@/lib/scheduling/types'

type PageProps = {
  params: { workspaceSlug: string }
}

export default async function AIPlaygroundPage({ params }: PageProps) {
  if (!isAIPlaygroundEnabled()) notFound()

  const { userId: clerkId } = auth()
  if (!clerkId) redirect('/sign-in')

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug: params.workspaceSlug,
      members: { some: { user: { clerkId } } },
    },
    include: {
      members: {
        where: { user: { clerkId } },
        include: { user: true },
      },
    },
  })

  if (!workspace) redirect('/dashboard')

  const membership = workspace.members[0]
  if (!membership || !canUseAIPlayground(membership.role)) {
    redirect(`/dashboard/${params.workspaceSlug}`)
  }

  const capabilities = getWorkspaceCapabilities(workspace as any)
  const schedulingData = await loadSchedulingPageProps({
    workspace: workspace as any,
    capabilities: capabilities.scheduling,
  })
  const [members, teams, locations] = await Promise.all([
    prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.workspaceTeam.findMany({
      where: { workspaceId: workspace.id, isActive: true, archivedAt: null },
      orderBy: { name: 'asc' },
    }),
    prisma.workspaceLocation.findMany({
      where: { workspaceId: workspace.id, isActive: true, archivedAt: null },
      orderBy: { name: 'asc' },
    }),
  ])

  const timezone = schedulingData.initialSettings.timezone
  const memberLabels = new Map(
    members.map((member) => [
      member.id,
      member.user.fullName || member.user.email || 'Workspace member',
    ]),
  )
  const teamLabels = new Map(teams.map((team) => [team.id, team.name]))
  const contextOptions = {
    scheduling: [
      contextGroup(
        'events',
        'Event',
        [...schedulingData.initialEvents]
          .sort((first, second) => eventOptionSort(first, second, timezone))
          .slice(0, 50)
          .map((event) =>
            eventContextOption({
              event,
              timezone,
              memberLabels,
              teamLabels,
            }),
          ),
      ),
      contextGroup(
        'members',
        'Member',
        members.map(
          (member): AIPlaygroundContextOption => ({
            kind: 'technician',
            id: member.id,
            label:
              member.user.fullName || member.user.email || 'Workspace member',
            secondaryLabel: member.role,
          }),
        ),
      ),
      contextGroup(
        'teams',
        'Team',
        teams.map(
          (team): AIPlaygroundContextOption => ({
            kind: 'team',
            id: team.id,
            label: team.name,
            secondaryLabel: 'Team',
          }),
        ),
      ),
      contextGroup(
        'locations',
        'Location',
        locations.map(
          (location): AIPlaygroundContextOption => ({
            kind: 'location',
            id: location.id,
            label: location.name,
            secondaryLabel: location.locationType,
          }),
        ),
      ),
    ],
    crm: [
      contextGroup('leads', 'Lead', []),
      contextGroup('opportunities', 'Opportunity', []),
      contextGroup('clients', 'Client', []),
      contextGroup(
        'owners',
        'Owner',
        members.map(
          (member): AIPlaygroundContextOption => ({
            kind: 'owner',
            id: member.id,
            label:
              member.user.fullName || member.user.email || 'Workspace member',
            secondaryLabel: member.role,
          }),
        ),
      ),
      contextGroup(
        'leadStages',
        'Lead stage',
        leadStageOptions.map(
          (stage): AIPlaygroundContextOption => ({
            kind: 'pipelineStage',
            id: `lead:${stage}`,
            label: stage,
            secondaryLabel: 'Lead stage',
          }),
        ),
      ),
      contextGroup(
        'opportunityStages',
        'Opportunity stage',
        opportunityStageOptions.map(
          (stage): AIPlaygroundContextOption => ({
            kind: 'pipelineStage',
            id: `opportunity:${stage}`,
            label: stage,
            secondaryLabel: 'Opportunity stage',
          }),
        ),
      ),
      contextGroup('selectedRecords', 'Selected records', []),
    ],
  } satisfies Record<string, AIPlaygroundContextGroup[]>

  return (
    <DashboardShell className="max-w-7xl">
      <div className="space-y-5">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
                Internal AI Playground
              </h1>
              <Badge variant="orange">Internal</Badge>
            </div>
            <p className="max-w-3xl text-sm leading-6 text-slate-400">
              Developer and workspace-admin test surface for Workspace AI,
              provider availability, knowledge providers, runtime inspection,
              sanitized structured output, and proposal-only action review.
            </p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs text-slate-400">
            Feature flag: AI_PLAYGROUND_ENABLED
          </div>
        </header>

        <InternalAIPlayground
          workspaceId={workspace.id}
          workspaceSlug={params.workspaceSlug}
          workspaceName={workspace.name}
          domains={AI_PLAYGROUND_DOMAINS}
          providerOptions={getAIPlaygroundProviderOptions()}
          contextOptions={contextOptions}
        />
      </div>
    </DashboardShell>
  )
}

function contextGroup(
  id: string,
  label: string,
  options: AIPlaygroundContextOption[],
): AIPlaygroundContextGroup {
  return { id, label, options }
}

function eventContextOption({
  event,
  timezone,
  memberLabels,
  teamLabels,
}: {
  event: SchedulingEvent
  timezone: string
  memberLabels: Map<string, string>
  teamLabels: Map<string, string>
}): AIPlaygroundContextOption {
  const customerOrLocation =
    event.linkedRecord?.label ??
    event.locationLabel ??
    event.location ??
    'No customer/location'
  const dateTimeLabel = formatDateTime(event.startsAt, timezone)
  const assignmentLabel = event.assignedMemberIds.length
    ? event.assignedMemberIds
        .map((id) => memberLabels.get(id) ?? teamLabels.get(id))
        .filter(Boolean)
        .join(', ') || 'Assigned'
    : 'Unassigned'
  const locationLabel = event.locationLabel ?? event.location
  const parts = [
    event.title,
    customerOrLocation,
    dateTimeLabel,
    assignmentLabel,
  ].filter(Boolean)
  return {
    kind: 'event',
    id: event.id,
    label: parts.join(' — ').slice(0, 160),
    secondaryLabel: [
      schedulingStatusLabels[event.status],
      locationLabel,
      event.allDay
        ? 'All day'
        : `${formatTimeOnly(event.startsAt, timezone)}-${formatTimeOnly(event.endsAt, timezone)}`,
    ]
      .filter(Boolean)
      .join(' · '),
    metadata: {
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      dateTimeLabel,
      assignmentLabel,
      locationLabel,
      customerLabel: customerOrLocation,
      status: schedulingStatusLabels[event.status],
    },
  }
}

function eventOptionSort(
  first: SchedulingEvent,
  second: SchedulingEvent,
  timezone: string,
) {
  const now = new Date()
  const firstTime = new Date(first.startsAt).getTime()
  const secondTime = new Date(second.startsAt).getTime()
  const firstPast = new Date(first.endsAt).getTime() < now.getTime()
  const secondPast = new Date(second.endsAt).getTime() < now.getTime()
  if (firstPast !== secondPast) return firstPast ? 1 : -1
  if (firstTime !== secondTime)
    return firstPast ? secondTime - firstTime : firstTime - secondTime
  return `${formatDateTime(first.startsAt, timezone)}:${first.id}`.localeCompare(
    `${formatDateTime(second.startsAt, timezone)}:${second.id}`,
  )
}
