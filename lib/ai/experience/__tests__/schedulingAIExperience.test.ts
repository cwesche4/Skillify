import { describe, expect, it } from 'vitest'

import {
  routeSchedulingAIIntent,
  runSchedulingAIRequest,
  type SchedulingAIRequest,
} from '@/lib/ai/experience/schedulingAIExperience'
import type {
  WorkspaceIntelligenceActor,
  WorkspaceIntelligenceWorkspace,
} from '@/lib/intelligence/workspaceIntelligence'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import type { SchedulingKnowledgeInput } from '@/lib/scheduling/schedulingKnowledge'
import type {
  SchedulingEvent,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

const now = new Date('2026-07-30T14:00:00.000Z')
const workspaceId = 'scheduling-ai-workspace'

const settings = normalizeSchedulingSettings({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  workspaceTimezone: 'America/New_York',
  settings: { timezone: 'America/New_York' },
})

const capabilities = getWorkspaceSchedulingCapabilities({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  settings,
  workspaceTimezone: 'America/New_York',
})

const workspace: WorkspaceIntelligenceWorkspace = {
  id: workspaceId,
  slug: 'scheduling-ai',
  name: 'Scheduling AI Workspace',
  timezone: 'America/New_York',
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  enabledModules: ['scheduling', 'workflow', 'crm'],
}

const owner: WorkspaceIntelligenceActor = {
  userId: 'user-owner',
  workspaceMemberId: 'member-owner',
  role: 'OWNER',
  permissions: ['workspace:read', 'scheduling:read', 'scheduling:write'],
  language: 'en',
}

const events: SchedulingEvent[] = [
  {
    id: 'owner-busy',
    workspaceId,
    title: 'Proposal Review',
    type: 'proposalReview',
    status: 'confirmed',
    startsAt: '2026-07-30T15:00:00.000Z',
    endsAt: '2026-07-30T16:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-owner'],
    locationType: 'workspaceLocation',
    location: 'location-office',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'field-open',
    workspaceId,
    title: 'Discovery Call',
    type: 'discoveryCall',
    status: 'scheduled',
    startsAt: '2026-07-30T17:00:00.000Z',
    endsAt: '2026-07-30T17:45:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-field'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
]

const availability: TeamAvailabilityRecord[] = [
  {
    id: 'hours',
    workspaceId,
    kind: 'workingHours',
    scope: 'workspace',
    memberId: '',
    memberName: 'Business Hours',
    daysOfWeek: [1, 2, 3, 4, 5],
    startsAt: '09:00',
    endsAt: '17:00',
    timezone: 'America/New_York',
  },
]

function schedulingSource(
  actor: SchedulingKnowledgeInput['actor'] = {
    role: 'OWNER',
    canViewAllScheduling: true,
  },
): SchedulingKnowledgeInput {
  return {
    workspace: {
      id: workspaceId,
      slug: 'scheduling-ai',
      name: 'Scheduling AI Workspace',
      timezone: 'America/New_York',
    },
    settings,
    capabilities,
    now,
    actor,
    members: [
      {
        id: 'member-owner',
        label: 'Owner',
        status: 'active',
        teamIds: ['team-office'],
        locationId: 'location-office',
      },
      {
        id: 'member-field',
        label: 'Field Tech',
        status: 'active',
        teamIds: ['team-field'],
        locationId: 'location-field',
      },
    ],
    teams: [
      {
        id: 'team-office',
        label: 'Office Team',
        memberIds: ['member-owner'],
        status: 'active',
      },
      {
        id: 'team-field',
        label: 'Field Crew',
        memberIds: ['member-field'],
        status: 'active',
      },
    ],
    locations: [
      { id: 'location-office', label: 'Office', status: 'active' },
      { id: 'location-field', label: 'Field', status: 'active' },
    ],
    events,
    availability,
    recurringSeries: [
      {
        id: 'series-1',
        workspaceId,
        title: 'Weekly review',
        eventType: 'recurringServiceVisit',
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [4],
          endType: 'never',
        },
        status: 'active',
        assignedMemberIds: ['member-field'],
        nextOccurrenceAt: '2026-08-06T17:00:00.000Z',
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ],
    externalAvailability: [],
    calendarConnections: [],
  }
}

function request(
  overrides: Partial<SchedulingAIRequest> = {},
): SchedulingAIRequest {
  return {
    id: 'request-1',
    workspace,
    actor: owner,
    intent: 'recommendTechnician',
    schedulingSource: schedulingSource(),
    currentEvent: {
      id: 'owner-busy',
      kind: 'event',
      label: 'Proposal Review',
      referenceId: 'owner-busy',
    },
    currentTechnician: {
      id: 'member-owner',
      kind: 'technician',
      label: 'Owner',
      referenceId: 'member-owner',
    },
    currentLocation: {
      id: 'location-field',
      kind: 'location',
      label: 'Field',
      referenceId: 'location-field',
    },
    rangeStart: new Date('2026-07-30T15:00:00.000Z'),
    rangeEnd: new Date('2026-07-30T16:00:00.000Z'),
    dateKey: '2026-07-30',
    durationMinutes: 45,
    now,
    ...overrides,
  }
}

describe('SchedulingAIExperience', () => {
  it('routes only supported scheduling AI intents to Workspace Intelligence intents', () => {
    expect(routeSchedulingAIIntent('explainSchedulingConflict')).toMatchObject({
      workspaceIntent: 'scheduling.explainConflict',
      responseKind: 'explanation',
      outputType: 'explanation',
    })
    expect(routeSchedulingAIIntent('recommendTechnician')).toMatchObject({
      workspaceIntent: 'scheduling.findBestMember',
      responseKind: 'recommendation',
      outputType: 'recommendations',
    })
    expect(routeSchedulingAIIntent('summarizeUpcomingWork')).toMatchObject({
      workspaceIntent: 'scheduling.balanceWorkload',
      responseKind: 'summary',
      outputType: 'summary',
    })
  })

  it('runs through Workspace AI Runtime and returns deterministic technician recommendations', async () => {
    const response = await runSchedulingAIRequest({ request: request() })

    expect(response.workspaceAIResponse.runtimeResponse.requestId).toBe(
      'workspace-ai-runtime:scheduling-ai:request-1',
    )
    expect(
      response.workspaceAIResponse.providerUsage.knowledgeProviderIds,
    ).toEqual(['scheduling'])
    expect(
      response.workspaceAIResponse.runtimeResponse.toolUsage.executedToolIds,
    ).toEqual([])
    expect(response.recommendations.map((item) => item.label)).toContain(
      'Field Tech',
    )
    expect(response.recommendations[0]?.provenance).toMatchObject({
      sourceProviderId: 'scheduling',
      sourceEngine: 'Scheduling Knowledge',
      deterministic: true,
      scoreScale: '0-100',
      aiProviderGeneratedExplanation: false,
    })
    expect(response.references.map((reference) => reference.id)).toContain(
      'workspace-ai-reference:context:scheduling:event:owner-busy',
    )
    expect(response.rendering.primaryCard).toBe('recommendationCard')
  })

  it('uses only the current scheduling source for candidate identity', async () => {
    const workspaceASource = schedulingSource()
    workspaceASource.members = [
      {
        id: 'member-jane',
        label: 'Jane Smith',
        status: 'active',
        teamIds: ['team-office'],
        locationId: 'location-office',
      },
    ]
    workspaceASource.events = []

    const workspaceBSource = schedulingSource()
    workspaceBSource.workspace = {
      ...workspaceBSource.workspace,
      id: 'workspace-b',
      slug: 'workspace-b',
      name: 'Workspace B',
    }
    workspaceBSource.members = []
    workspaceBSource.events = []

    const workspaceAResponse = await runSchedulingAIRequest({
      request: request({
        schedulingSource: workspaceASource,
        currentTechnician: undefined,
      }),
    })
    const workspaceBResponse = await runSchedulingAIRequest({
      request: request({
        workspace: {
          ...workspace,
          id: 'workspace-b',
          slug: 'workspace-b',
          name: 'Workspace B',
        },
        schedulingSource: workspaceBSource,
        currentTechnician: undefined,
      }),
    })

    expect(
      workspaceAResponse.recommendations.map((item) => item.label),
    ).toEqual(['Jane Smith'])
    expect(workspaceBResponse.recommendations).toEqual([])
    expect(JSON.stringify(workspaceBResponse)).not.toContain('Jane Smith')
    expect(JSON.stringify(workspaceBResponse)).not.toContain('Corbin Wesche')
  })

  it('explains technician availability from scheduling conflicts and references', async () => {
    const response = await runSchedulingAIRequest({
      request: request({ intent: 'explainTechnicianAvailability' }),
    })

    expect(response.responseKind).toBe('explanation')
    expect(response.explanations[0]?.summary).toContain(
      'Owner is not available',
    )
    expect(
      response.explanations[0]?.warnings.map((warning) => warning.code),
    ).toContain('busy-conflict')
    expect(response.explanations[0]?.references.length).toBeGreaterThan(0)
  })

  it('analyzes conflicts, workload, provider health, and snapshot data', async () => {
    const response = await runSchedulingAIRequest({
      request: request({ intent: 'analyzeSchedule' }),
    })

    expect(response.responseKind).toBe('analysis')
    expect(response.analysis?.title).toBe('Schedule analysis')
    expect(
      response.analysis?.conflicts.map((conflict) => conflict.sourceId),
    ).toContain('owner-busy')
    expect(response.analysis?.workload.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Owner', 'Field Tech']),
    )
    expect(
      response.analysis?.snapshot?.readiness.capabilities.length,
    ).toBeGreaterThan(0)
  })

  it('treats current conflicts as active and upcoming planning-window conflicts with customer-safe details', async () => {
    const response = await runSchedulingAIRequest({
      request: request({
        intent: 'analyzeConflicts',
        requestText: 'Show current conflicts',
        rangeStart: undefined,
        rangeEnd: undefined,
      }),
    })

    expect(response.analysis?.range.mode).toBe('currentUpcoming')
    expect(response.analysis?.conflictCounts.blocking).toBeGreaterThan(0)
    expect(response.analysis?.conflictDetails[0]).toMatchObject({
      title: 'Overlapping scheduled work',
      affectedAssigneeLabel: 'Owner',
      sourceLabel: 'Proposal Review',
      sourceEventId: 'owner-busy',
      recommendedAction: 'REASSIGN',
    })
    expect(response.analysis?.conflictDetails[0]?.timeRangeLabel).toContain(
      'AM',
    )
    expect(response.analysis?.conflictDetails[0]?.timeRangeLabel).not.toContain(
      'T15:00:00.000Z',
    )
  })

  it("summarizes today's schedule without returning markdown blobs", async () => {
    const response = await runSchedulingAIRequest({
      request: request({ intent: 'summarizeTodaysSchedule' }),
    })

    expect(response.responseKind).toBe('summary')
    expect(response.summary?.title).toBe("Today's schedule")
    expect(response.summary?.items.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Proposal Review', 'Discovery Call']),
    )
    expect(response.summary?.items[0]).toHaveProperty('startsAt')
  })

  it('creates action proposals and Decision Framework proposals without execution', async () => {
    const response = await runSchedulingAIRequest({
      request: request({
        intent: 'recommendReassignment',
        includeActionProposal: true,
      }),
    })

    expect(response.responseKind).toBe('actionProposal')
    expect(response.actionProposals).toEqual([
      expect.objectContaining({
        actionType: 'assignTechnician',
        label: 'Assign Field Tech to Proposal Review',
        target: expect.objectContaining({
          recordId: 'owner-busy',
          label: 'Proposal Review',
        }),
        currentState: 'Currently assigned to Owner',
        proposedState: 'Assign to Field Tech',
        validation: expect.objectContaining({ status: 'valid' }),
        executionBoundary: 'proposal-only',
        approval: expect.objectContaining({ status: 'pending' }),
      }),
    ])
    expect(response.decisionProposals).toEqual([
      expect.objectContaining({
        source: expect.objectContaining({ type: 'workspaceAI' }),
        execution: expect.objectContaining({ status: 'notStarted' }),
        lifecycleStatus: 'open',
      }),
    ])
  })

  it('builds an editable draft event proposal for compound create-and-assign requests', async () => {
    const response = await runSchedulingAIRequest({
      request: request({
        id: 'compound-request',
        intent: 'draftEventProposal',
        includeActionProposal: true,
        proposedActionType: 'createEventAndAssign',
        requestText:
          'Schedule emergency service tomorrow at 10 PM and assign the best technician',
        currentEvent: undefined,
        currentTechnician: undefined,
        rangeStart: new Date('2026-07-31T02:00:00.000Z'),
        rangeEnd: new Date('2026-07-31T03:00:00.000Z'),
        dateKey: '2026-07-30',
        durationMinutes: 60,
      }),
    })

    expect(response.responseKind).toBe('actionProposal')
    expect(response.recommendations.length).toBeGreaterThan(0)
    expect(response.actionProposals[0]).toMatchObject({
      actionType: 'createEventAndAssign',
      target: expect.objectContaining({
        recordType: 'schedulingEventDraft',
        recordId: 'scheduling-event-draft:compound-request',
      }),
      currentState: 'No event exists yet. This is an editable draft only.',
      validation: expect.objectContaining({ status: 'valid' }),
      executionBoundary: 'proposal-only',
      approval: expect.objectContaining({ status: 'pending' }),
    })
    expect(response.actionProposals[0]?.parameters).toMatchObject({
      approvalRequired: true,
      compoundOperations: expect.arrayContaining([
        'create',
        'schedule',
        'assign',
      ]),
      draftEvent: expect.objectContaining({
        title: 'Emergency Service',
        priority: 'high',
        timezone: 'America/New_York',
      }),
    })
  })

  it('marks unsupported proposal requests unavailable instead of fabricating context', async () => {
    const response = await runSchedulingAIRequest({
      request: request({
        intent: 'analyzeSchedule',
        includeActionProposal: true,
        proposedActionType: 'notifyCustomer',
        currentEvent: undefined,
        currentTechnician: undefined,
      }),
    })

    expect(response.actionProposals).toEqual([
      expect.objectContaining({
        label: 'Proposal unavailable',
        validation: expect.objectContaining({
          status: 'incomplete',
          missingFields: expect.arrayContaining([
            'related scheduling record',
            'validated customer/contact reference',
            'delivery channel readiness',
          ]),
        }),
        executionBoundary: 'proposal-only',
      }),
    ])
  })

  it('supports team, location, time-slot, alternate-schedule, and recurring explanations', async () => {
    const team = await runSchedulingAIRequest({
      request: request({ intent: 'recommendTeam' }),
    })
    const location = await runSchedulingAIRequest({
      request: request({ intent: 'recommendLocation' }),
    })
    const slot = await runSchedulingAIRequest({
      request: request({ intent: 'recommendAppointmentTime' }),
    })
    const recurring = await runSchedulingAIRequest({
      request: request({ intent: 'explainRecurringSchedule' }),
    })

    expect(team.recommendations[0]?.candidateType).toBe('team')
    expect(location.recommendations[0]?.candidateType).toBe('location')
    expect(slot.recommendations[0]?.candidateType).toBe('timeSlot')
    expect(recurring.explanations[0]?.details[0]).toContain('Weekly review')
  })

  it('honors permission boundaries by withholding deterministic scheduling output', async () => {
    const response = await runSchedulingAIRequest({
      request: request({
        actor: {
          ...owner,
          permissions: ['workspace:read'],
        },
      }),
    })

    expect(response.recommendations).toEqual([])
    expect(response.explanations).toEqual([])
    expect(response.warnings.map((warning) => warning.code)).toContain(
      'scheduling-permission-required',
    )
    expect(
      response.workspaceAIResponse.providerUsage.knowledgeProviderIds,
    ).toEqual([])
  })
})
