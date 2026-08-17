import { describe, expect, it } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceSchedulingCapabilities } from '@/lib/scheduling/getWorkspaceSchedulingCapabilities'
import { normalizeSchedulingSettings } from '@/lib/scheduling/normalizeSchedulingSettings'
import {
  createSchedulingKnowledgeService,
  getSchedulingContext,
  getSchedulingExplanation,
  getSchedulingRecommendations,
  getSchedulingSnapshot,
  normalizeSchedulingConflictFindings,
  schedulingKnowledgeCapabilityRegistry,
  type SchedulingKnowledgeActor,
} from '@/lib/scheduling/schedulingKnowledge'
import type {
  ExternalCalendarConnection,
  SchedulingEvent,
  SchedulingSeries,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

const now = new Date('2026-07-30T14:00:00.000Z')
const workspaceId = 'workspace-ai-scheduling'
const settings = normalizeSchedulingSettings({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  workspaceTimezone: 'America/New_York',
  settings: {
    timezone: 'America/New_York',
    customEventTypes: [
      {
        id: 'custom-cleaning',
        workspaceId,
        key: 'custom.cleaning',
        label: 'Custom Cleaning',
        description: 'Workspace-specific cleaning visit.',
        presetScope: ['service', 'consultative', 'commerce'],
        sectionKeys: ['calendar', 'scheduledJobs'],
        defaultDurationMinutes: 90,
        blocksAvailability: true,
        requiresLinkedRecord: false,
        linkedRecordRequirement: 'optional',
        supportedLinkedRecordTypes: ['client'],
        isActive: true,
        isSystem: false,
        sortOrder: 1,
        createdAt: '2026-07-01T00:00:00.000Z',
        updatedAt: '2026-07-01T00:00:00.000Z',
      },
    ],
  },
})
const capabilities = getWorkspaceSchedulingCapabilities({
  businessModel: WorkspaceBusinessModel.CONSULTATIVE_SALES,
  settings,
  workspaceTimezone: 'America/New_York',
})

const members = [
  {
    id: 'member-owner',
    label: 'Owner',
    role: 'OWNER',
    status: 'active',
    teamIds: ['team-office'],
    locationId: 'location-office',
  },
  {
    id: 'member-field',
    label: 'Field Tech',
    role: 'MEMBER',
    status: 'active',
    teamIds: ['team-field'],
    locationId: 'location-field',
  },
  {
    id: 'member-removed',
    label: 'Removed User',
    status: 'removed',
  },
]

const teams = [
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
]

const locations = [
  { id: 'location-office', label: 'Office', status: 'active' },
  { id: 'location-field', label: 'Field', status: 'active' },
]

const events: SchedulingEvent[] = [
  {
    id: 'event-owner-busy',
    workspaceId,
    title: 'Proposal Review',
    type: 'proposalReview',
    status: 'confirmed',
    startsAt: '2026-07-30T15:00:00.000Z',
    endsAt: '2026-07-30T16:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-owner'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'event-field-open',
    workspaceId,
    title: 'Discovery Call',
    type: 'discoveryCall',
    status: 'scheduled',
    startsAt: '2026-07-31T16:00:00.000Z',
    endsAt: '2026-07-31T16:45:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-field'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'event-completed',
    workspaceId,
    title: 'Completed Meeting',
    type: 'internalMeeting',
    status: 'completed',
    startsAt: '2026-07-30T15:00:00.000Z',
    endsAt: '2026-07-30T16:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['member-field'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 'event-custom',
    workspaceId,
    title: 'Custom Cleaning',
    type: 'custom.cleaning' as SchedulingEvent['type'],
    status: 'scheduled',
    startsAt: '2026-08-01T14:00:00.000Z',
    endsAt: '2026-08-01T15:30:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
    assignedMemberIds: ['team-field'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
]

const availability: TeamAvailabilityRecord[] = [
  {
    id: 'business-hours',
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
  {
    id: 'owner-time-off',
    workspaceId,
    kind: 'timeOff',
    memberId: 'member-owner',
    memberName: 'Owner',
    title: 'Admin Block',
    reason: 'Admin Block',
    startsAt: '2026-07-30T17:00:00.000Z',
    endsAt: '2026-07-30T18:00:00.000Z',
    allDay: false,
    timezone: 'America/New_York',
  },
  {
    id: 'office-closed',
    workspaceId,
    kind: 'availabilityException',
    scope: 'workspace',
    exceptionType: 'closed',
    title: 'Office closed',
    date: '2026-08-03',
    allDayClosed: true,
    timezone: 'America/New_York',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
]

const recurringSeries: SchedulingSeries[] = [
  {
    id: 'series-1',
    workspaceId,
    title: 'Weekly Service',
    eventType: 'recurringServiceVisit',
    recurrenceRule: {
      frequency: 'weekly',
      interval: 1,
      endType: 'never',
    },
    nextOccurrenceAt: '2026-08-04T14:00:00.000Z',
    status: 'active',
    assignedMemberIds: ['member-field'],
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
  },
]

const calendarConnections: ExternalCalendarConnection[] = [
  {
    id: 'google-owner',
    workspaceId,
    userId: 'user-owner',
    provider: 'google',
    status: 'connected',
    lastSyncedAt: '2026-07-30T13:00:00.000Z',
  },
]

function service(
  actor: SchedulingKnowledgeActor = {
    role: 'OWNER',
    canViewAllScheduling: true,
  },
) {
  return createSchedulingKnowledgeService({
    workspace: {
      id: workspaceId,
      slug: 'acme',
      name: 'Acme',
      timezone: 'America/New_York',
    },
    settings,
    capabilities,
    now,
    actor,
    members,
    teams,
    locations,
    events,
    availability,
    recurringSeries,
    externalAvailability: [
      {
        id: 'external-owner',
        workspaceId,
        workspaceMemberId: 'member-owner',
        startsAtUtc: '2026-07-30T19:00:00.000Z',
        endsAtUtc: '2026-07-30T20:00:00.000Z',
        effect: 'suggestion',
        displayLabel: 'Unavailable',
      },
    ],
    calendarConnections,
  })
}

describe('SchedulingKnowledgeService', () => {
  it('builds an authoritative deterministic scheduling context', () => {
    const context = service().getSchedulingContext()

    expect(context.workspace.timezone).toBe('America/New_York')
    expect(context.now.dateKey).toBe('2026-07-30')
    expect(context.members.map((member) => member.id)).toEqual([
      'member-field',
      'member-owner',
    ])
    expect(
      context.eventTypes.some((type) => type.key === 'custom.cleaning'),
    ).toBe(true)
    expect(context.workingHours).toHaveLength(1)
    expect(context.timeOff).toHaveLength(1)
    expect(context.availabilityExceptions).toHaveLength(1)
    expect(context.providerHealth[0]).toMatchObject({
      provider: 'google',
      status: 'connected',
    })
  })

  it('exposes capability registry and future AI intent contracts without GPT calls', () => {
    const layer = service()

    expect(
      schedulingKnowledgeCapabilityRegistry.map((item) => item.key),
    ).toContain('supportsRecommendation')
    expect(layer.getCapabilityRegistry().every((item) => item.supported)).toBe(
      true,
    )
    expect(layer.getSupportedIntents()).toEqual(
      expect.arrayContaining([
        'findBestMember',
        'findAvailableSlot',
        'explainSchedulingConflict',
        'balanceWorkload',
      ]),
    )
  })

  it('queries member availability, conflicts, workload, recurring schedules, and providers', () => {
    const layer = service()
    const rangeStart = new Date('2026-07-30T15:00:00.000Z')
    const rangeEnd = new Date('2026-07-30T16:00:00.000Z')

    const availabilitySummary = layer.getMemberAvailability({
      memberId: 'member-owner',
      rangeStart,
      rangeEnd,
    })
    expect(availabilitySummary?.isAvailable).toBe(false)
    expect(
      availabilitySummary?.conflicts.map((item) => item.conflictType),
    ).toContain('busy')
    expect(
      layer
        .getSchedulingConflicts({ rangeStart, rangeEnd })
        .map((item) => item.sourceId),
    ).toContain('event-owner-busy')
    expect(
      layer
        .getCurrentWorkload({ rangeStart, rangeEnd })
        .find((item) => item.assigneeId === 'member-owner')?.eventCount,
    ).toBe(1)
    expect(layer.getRecurringSchedule()[0]?.id).toBe('series-1')
    expect(layer.getProviderHealth()[0]?.provider).toBe('google')
  })

  it('only surfaces availability exceptions that overlap the requested window', () => {
    const layer = service()

    expect(
      layer
        .getSchedulingConflicts({
          rangeStart: new Date('2026-07-30T15:00:00.000Z'),
          rangeEnd: new Date('2026-07-30T16:00:00.000Z'),
        })
        .map((item) => item.sourceId),
    ).not.toContain('office-closed')

    const exceptionConflict = layer
      .getSchedulingConflicts({
        rangeStart: new Date('2026-08-03T14:00:00.000Z'),
        rangeEnd: new Date('2026-08-03T15:00:00.000Z'),
      })
      .find((item) => item.sourceId === 'office-closed')

    expect(exceptionConflict).toMatchObject({
      conflictType: 'availabilityException',
      startsAt: expect.any(String),
      endsAt: expect.any(String),
      severity: 'blocking',
    })
  })

  it('normalizes busy conflicts separately from informational availability constraints', () => {
    const normalized = normalizeSchedulingConflictFindings([
      {
        id: 'busy-conflict',
        conflictType: 'busy',
        sourceId: 'event-owner-busy',
        sourceLabel: 'Proposal Review',
        severity: 'blocking',
      },
      {
        id: 'time-off-conflict',
        conflictType: 'timeOff',
        sourceId: 'pto-owner',
        sourceLabel: 'PTO',
        severity: 'blocking',
      },
      {
        id: 'external-conflict',
        conflictType: 'externalAvailability',
        sourceId: 'external-owner',
        sourceLabel: 'Unavailable',
        severity: 'warning',
      },
    ])

    expect(
      normalized.find((item) => item.sourceId === 'event-owner-busy'),
    ).toMatchObject({
      category: 'eventOverlap',
      blocking: true,
      severity: 'blocking',
    })
    expect(
      normalized.find((item) => item.sourceId === 'pto-owner'),
    ).toMatchObject({
      category: 'informationalAvailabilityBlock',
      blocking: false,
      severity: 'warning',
    })
    expect(
      normalized.find((item) => item.sourceId === 'external-owner'),
    ).toMatchObject({
      category: 'informationalAvailabilityBlock',
      blocking: false,
    })
  })

  it('scores recommendations and returns structured explanations', () => {
    const layer = service()
    const rangeStart = new Date('2026-07-30T15:00:00.000Z')
    const rangeEnd = new Date('2026-07-30T16:00:00.000Z')
    const recommendations = layer.recommendMembers({
      rangeStart,
      rangeEnd,
      locationId: 'location-field',
    })

    expect(recommendations[0]?.candidateId).toBe('member-field')
    expect(recommendations[0]?.score).toBeGreaterThan(
      recommendations[1]?.score ?? 0,
    )
    expect(recommendations[0]?.reasons.map((reason) => reason.code)).toContain(
      'available',
    )
    expect(
      recommendations
        .find((item) => item.candidateId === 'member-owner')
        ?.warnings.map((warning) => warning.code),
    ).toEqual(expect.arrayContaining(['busy-conflict']))

    const explanation = getSchedulingExplanation(recommendations[0]!)
    expect(explanation).toEqual({
      candidateId: 'member-field',
      candidateType: 'member',
      score: recommendations[0]?.score,
      confidence: recommendations[0]?.confidence,
      reasons: recommendations[0]?.reasons,
      warnings: recommendations[0]?.warnings,
    })
  })

  it('recommends deterministic time slots from working hours and existing conflicts', () => {
    const slots = service().recommendTimeSlots({
      memberId: 'member-field',
      dateKey: '2026-07-30',
      durationMinutes: 60,
      limit: 2,
    })

    expect(slots).toHaveLength(2)
    expect(slots[0]?.candidateType).toBe('timeSlot')
    expect(slots[0]?.metadata?.memberId).toBe('member-field')
    expect(slots[0]?.warnings).toEqual([])
  })

  it('creates stable snapshots with validation-ready counts and fingerprints', () => {
    const layer = service()
    const first = layer.getSchedulingSnapshot({
      rangeStart: new Date('2026-07-30T14:00:00.000Z'),
      rangeEnd: new Date('2026-08-05T14:00:00.000Z'),
    })
    const second = layer.getSchedulingSnapshot({
      rangeStart: new Date('2026-07-30T14:00:00.000Z'),
      rangeEnd: new Date('2026-08-05T14:00:00.000Z'),
    })

    expect(first.counts).toMatchObject({
      members: 2,
      teams: 2,
      events: 4,
      recurringSeries: 1,
      conflicts: expect.any(Number),
    })
    expect(first.fingerprint).toBe(second.fingerprint)
    expect(first.readiness.ready).toBe(true)
  })

  it('applies permission filtering before exposing scheduling knowledge', () => {
    const restricted = service({
      workspaceMemberId: 'member-field',
      role: 'MEMBER',
      visibleMemberIds: ['member-field'],
    }).getSchedulingContext()

    expect(restricted.members.map((member) => member.id)).toEqual([
      'member-field',
    ])
    expect(restricted.events.map((event) => event.id)).toEqual([
      'event-completed',
      'event-field-open',
      'event-custom',
    ])
    expect(restricted.externalAvailability).toEqual([])
  })

  it('exposes future AI interfaces as deterministic structured objects', () => {
    const input = {
      workspace: { id: workspaceId, timezone: 'America/New_York' },
      settings,
      capabilities,
      now,
      actor: { role: 'OWNER', canViewAllScheduling: true },
      members,
      teams,
      locations,
      events,
      availability,
      recurringSeries,
    }
    const context = getSchedulingContext(input)
    const snapshot = getSchedulingSnapshot(input)
    const recommendations = getSchedulingRecommendations(input, {
      intent: 'findBestMember',
      rangeStart: new Date('2026-07-30T15:00:00.000Z'),
      rangeEnd: new Date('2026-07-30T16:00:00.000Z'),
    })

    expect(context.workspace.id).toBe(workspaceId)
    expect(snapshot.workspaceId).toBe(workspaceId)
    expect(recommendations[0]).toHaveProperty('reasons')
    expect(recommendations[0]).toHaveProperty('warnings')
  })
})
