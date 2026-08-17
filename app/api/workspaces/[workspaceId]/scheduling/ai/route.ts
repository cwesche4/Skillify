import { auth } from '@clerk/nextjs/server'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'

import { runSchedulingAIRequest } from '@/lib/ai/experience/schedulingAIExperience'
import {
  createCustomerSchedulingAIRuntime,
  inferSchedulingAIIntent,
  isSchedulingAIEnabled,
  isSchedulingAIProviderConfigured,
  parseCustomerSchedulingAIRequest,
  toCustomerSchedulingAIResponse,
  toSchedulingAIObjectReference,
} from '@/lib/ai/scheduling/customerSchedulingAI'
import { prisma } from '@/lib/db'
import { schedulingApiError } from '@/lib/scheduling/apiResponses'
import {
  addDateKeys,
  combineDateAndTimeInTimezone,
  getWorkspaceDateKey,
} from '@/lib/scheduling/schedulingDateTime'
import { loadSchedulingPageProps } from '@/lib/scheduling/loadSchedulingPageProps'
import type { SchedulingKnowledgeInput } from '@/lib/scheduling/schedulingKnowledge'
import { getWorkspaceCapabilities } from '@/lib/workspaces/getWorkspaceCapabilities'

type RouteContext = { params: { workspaceId: string } }

export async function POST(request: NextRequest, { params }: RouteContext) {
  if (!isSchedulingAIEnabled()) {
    return schedulingApiError({
      status: 403,
      code: 'SCHEDULING_AI_DISABLED',
      message: 'Scheduling AI is not enabled for this workspace yet.',
    })
  }
  if (!isSchedulingAIProviderConfigured()) {
    return schedulingApiError({
      status: 503,
      code: 'SCHEDULING_AI_PROVIDER_UNAVAILABLE',
      message:
        'Scheduling AI is not available because the AI provider is not configured.',
    })
  }

  const { userId: clerkId } = auth()
  if (!clerkId) {
    return schedulingApiError({
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
      message: 'Sign in to use Scheduling AI in this workspace.',
    })
  }

  const workspace = await prisma.workspace.findFirst({
    where: {
      id: params.workspaceId,
      members: { some: { user: { clerkId } } },
    },
    include: {
      members: {
        where: { user: { clerkId } },
        include: { user: true },
      },
    },
  })
  if (!workspace) {
    return schedulingApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have access to Scheduling AI in this workspace.',
    })
  }
  const membership = workspace.members[0]
  if (!membership) {
    return schedulingApiError({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have access to Scheduling AI in this workspace.',
    })
  }

  let parsed: ReturnType<typeof parseCustomerSchedulingAIRequest>
  try {
    parsed = parseCustomerSchedulingAIRequest(await request.json())
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: 'VALIDATION_ERROR',
        message: 'The Scheduling AI request was not valid.',
        issues: error instanceof z.ZodError ? error.issues : undefined,
      },
      { status: 400 },
    )
  }

  try {
    const capabilities = getWorkspaceCapabilities(workspace as any)
    const schedulingData = await loadSchedulingPageProps({
      workspace: workspace as any,
      capabilities: capabilities.scheduling,
    })
    const [members, teams, locations] = await Promise.all([
      loadSchedulingMembers(params.workspaceId),
      loadSchedulingTeams(params.workspaceId),
      loadSchedulingLocations(params.workspaceId),
    ])
    const contextValidation = validateContextReferences({
      references: parsed.context.references,
      workspaceId: params.workspaceId,
      eventIds: new Set(schedulingData.initialEvents.map((event) => event.id)),
      memberIds: new Set(members.map((member) => member.id)),
      teamIds: new Set(teams.map((team) => team.id)),
      locationIds: new Set(locations.map((location) => location.id)),
    })
    if (contextValidation) return contextValidation

    const now = new Date()
    const timezone = schedulingData.initialSettings.timezone
    const schedulingSource: SchedulingKnowledgeInput = {
      workspace: {
        id: workspace.id,
        slug: workspace.slug,
        name: workspace.name,
        timezone,
      },
      settings: schedulingData.initialSettings,
      capabilities: capabilities.scheduling,
      now,
      actor: {
        role: membership.role,
        workspaceMemberId: membership.id,
        canViewAllScheduling: true,
      },
      members,
      teams,
      locations,
      events: schedulingData.initialEvents,
      recurringSeries: schedulingData.initialSeries,
      availability: schedulingData.initialAvailability,
      externalAvailability: [],
      calendarConnections: [],
    }
    const { runtime, llmProviderId } = createCustomerSchedulingAIRuntime()
    const context = parsed.context.references.map(toSchedulingAIObjectReference)
    const inferredDraftWindow = inferSchedulingDraftWindowFromPrompt({
      prompt: parsed.prompt,
      timezone,
      now,
      contextDateKey: parsed.context.calendar?.dateKey,
    })
    const rangeStart =
      inferredDraftWindow?.rangeStart ??
      (parsed.context.calendar?.rangeStart
        ? new Date(parsed.context.calendar.rangeStart)
        : undefined)
    const rangeEnd =
      inferredDraftWindow?.rangeEnd ??
      (parsed.context.calendar?.rangeEnd
        ? new Date(parsed.context.calendar.rangeEnd)
        : undefined)
    const response = await runSchedulingAIRequest({
      request: {
        id: `customer-scheduling-ai:${crypto.randomUUID()}`,
        workspace: {
          id: workspace.id,
          slug: workspace.slug,
          name: workspace.name,
          timezone,
          businessModel: workspace.businessModel,
        },
        actor: {
          userId: membership.userId,
          workspaceMemberId: membership.id,
          role: membership.role,
          permissions: ['workspace:read', 'scheduling:read'],
        },
        intent:
          parsed.intent ??
          inferSchedulingAIIntent({
            prompt: parsed.prompt,
            context: parsed.context,
          }),
        schedulingSource,
        requestText: parsed.prompt,
        currentEvent: firstContext(context, 'event'),
        currentTechnician: firstContext(context, 'technician'),
        currentTeam: firstContext(context, 'team'),
        currentLocation: firstContext(context, 'location'),
        currentCalendar: firstContext(context, 'calendar'),
        currentWorkspace: firstContext(context, 'workspace') ?? {
          id: workspace.id,
          kind: 'workspace',
          label: workspace.name,
          referenceId: workspace.id,
        },
        currentSelection: context.filter((item) => item.kind === 'selection'),
        rangeStart,
        rangeEnd,
        dateKey:
          inferredDraftWindow?.dateKey ??
          parsed.context.calendar?.dateKey ??
          getWorkspaceDateKey(now, timezone),
        durationMinutes: 60,
        includeActionProposal:
          parsed.includeActionProposal ?? Boolean(inferredDraftWindow),
        proposedActionType:
          parsed.proposedActionType ??
          (inferredDraftWindow ? 'createEventAndAssign' : undefined),
        executionMode: 'modelDraft',
        llmProviderId,
        now,
      },
      runtime,
    })

    return NextResponse.json({
      ok: true,
      response: toCustomerSchedulingAIResponse(response),
    })
  } catch {
    return schedulingApiError({
      status: 500,
      code: 'SCHEDULING_REQUEST_FAILED',
      message: 'Scheduling AI could not complete this request. Try again.',
    })
  }
}

function firstContext(
  references: ReturnType<typeof toSchedulingAIObjectReference>[],
  kind: ReturnType<typeof toSchedulingAIObjectReference>['kind'],
) {
  return references.find((reference) => reference.kind === kind)
}

function inferSchedulingDraftWindowFromPrompt({
  prompt,
  timezone,
  now,
  contextDateKey,
}: {
  prompt: string
  timezone: string
  now: Date
  contextDateKey?: string
}) {
  const normalized = prompt.toLowerCase()
  if (!/\b(create|book|schedule|set up)\b/.test(normalized)) return null
  const todayKey = getWorkspaceDateKey(now, timezone)
  const dateKey = normalized.includes('tomorrow')
    ? addDateKeys(todayKey, 1)
    : normalized.includes('today')
      ? todayKey
      : contextDateKey
  const time = parsePromptTime(normalized)
  if (!dateKey || !time) return null
  const rangeStart = combineDateAndTimeInTimezone({
    dateKey,
    time,
    timezone,
  })
  return {
    dateKey,
    rangeStart,
    rangeEnd: new Date(rangeStart.getTime() + 60 * 60_000),
  }
}

function parsePromptTime(prompt: string) {
  const match = prompt.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/)
  if (!match) return null
  let hours = Number(match[1])
  const minutes = Number(match[2] ?? '0')
  const meridiem = match[3]
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 1 || hours > 12 || minutes < 0 || minutes > 59) return null
  if (meridiem === 'pm' && hours !== 12) hours += 12
  if (meridiem === 'am' && hours === 12) hours = 0
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function validateContextReferences({
  references,
  workspaceId,
  eventIds,
  memberIds,
  teamIds,
  locationIds,
}: {
  references: ReturnType<
    typeof parseCustomerSchedulingAIRequest
  >['context']['references']
  workspaceId: string
  eventIds: Set<string>
  memberIds: Set<string>
  teamIds: Set<string>
  locationIds: Set<string>
}) {
  for (const reference of references) {
    const valid =
      reference.kind === 'workspace'
        ? reference.id === workspaceId
        : reference.kind === 'event'
          ? eventIds.has(reference.id)
          : reference.kind === 'technician'
            ? memberIds.has(reference.id)
            : reference.kind === 'team'
              ? teamIds.has(reference.id)
              : reference.kind === 'location'
                ? locationIds.has(reference.id)
                : reference.kind === 'calendar' ||
                  reference.kind === 'selection'
    if (!valid) {
      return schedulingApiError({
        status: 404,
        code: 'NOT_FOUND',
        message: 'The selected Scheduling AI context is no longer available.',
      })
    }
  }
  return null
}

async function loadSchedulingMembers(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId },
    include: {
      user: true,
      teamMemberships: { select: { teamId: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return members.map((member) => ({
    id: member.id,
    label: member.user.fullName || member.user.email || 'Workspace member',
    status: 'active' as const,
    teamIds: member.teamMemberships.map((item) => item.teamId),
  }))
}

async function loadSchedulingTeams(workspaceId: string) {
  const teams = await prisma.workspaceTeam.findMany({
    where: { workspaceId, isActive: true, archivedAt: null },
    include: { members: { select: { workspaceMemberId: true } } },
    orderBy: { name: 'asc' },
  })
  return teams.map((team) => ({
    id: team.id,
    label: team.name,
    status: 'active' as const,
    memberIds: team.members.map((item) => item.workspaceMemberId),
  }))
}

async function loadSchedulingLocations(workspaceId: string) {
  const locations = await prisma.workspaceLocation.findMany({
    where: { workspaceId, isActive: true, archivedAt: null },
    orderBy: { name: 'asc' },
  })
  return locations.map((location) => ({
    id: location.id,
    label: location.name,
    status: 'active' as const,
  }))
}
