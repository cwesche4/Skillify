import {
  getSchedulingEventTypeDefinition,
  SCHEDULING_PRESETS,
  SCHEDULING_EVENT_TYPES,
} from '@/lib/scheduling/schedulingPresetRegistry'
import type {
  SchedulingCapabilities,
  SchedulingEvent,
  SchedulingEventType,
  SchedulingSectionKey,
  SchedulingSeries,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

const now = '2026-07-25T13:00:00.000Z'

const fixtureByType: Partial<
  Record<
    SchedulingEventType,
    Omit<
      SchedulingEvent,
      'id' | 'workspaceId' | 'timezone' | 'createdAt' | 'updatedAt'
    >
  >
> = {
  serviceAppointment: {
    title: 'Service Appointment',
    type: 'serviceAppointment',
    status: 'confirmed',
    startsAt: '2026-07-27T14:00:00.000Z',
    endsAt: '2026-07-27T15:00:00.000Z',
    allDay: false,
    location: 'Client site',
    assignedMemberIds: ['team-field'],
    linkedRecord: {
      recordType: 'client',
      recordId: 'client-northstar',
      label: 'NorthStar Electric',
    },
  },
  estimate: {
    title: 'Estimate Visit',
    type: 'estimate',
    status: 'scheduled',
    startsAt: '2026-07-28T16:00:00.000Z',
    endsAt: '2026-07-28T17:00:00.000Z',
    allDay: false,
    location: 'Customer property',
    assignedMemberIds: ['team-estimates'],
    linkedRecord: {
      recordType: 'lead',
      recordId: 'lead-1001',
      label: 'New service lead',
    },
  },
  scheduledJob: {
    title: 'Scheduled Job',
    type: 'scheduledJob',
    status: 'scheduled',
    startsAt: '2026-07-29T13:00:00.000Z',
    endsAt: '2026-07-29T17:00:00.000Z',
    allDay: false,
    location: 'Job site',
    assignedMemberIds: ['crew-a'],
    linkedRecord: {
      recordType: 'job',
      recordId: 'job-1001',
      label: 'Exterior maintenance',
    },
  },
  discoveryCall: {
    title: 'Discovery Call',
    type: 'discoveryCall',
    status: 'confirmed',
    startsAt: '2026-07-27T15:00:00.000Z',
    endsAt: '2026-07-27T15:45:00.000Z',
    allDay: false,
    assignedMemberIds: ['owner'],
    linkedRecord: {
      recordType: 'lead',
      recordId: 'lead-consult',
      label: 'Rachel Adams',
    },
  },
  proposalReview: {
    title: 'Proposal Review',
    type: 'proposalReview',
    status: 'scheduled',
    startsAt: '2026-07-30T18:00:00.000Z',
    endsAt: '2026-07-30T19:00:00.000Z',
    allDay: false,
    assignedMemberIds: ['owner'],
    linkedRecord: {
      recordType: 'opportunity',
      recordId: 'opp-1001',
      label: 'Adams Bookkeeping',
    },
  },
  customerPickup: {
    title: 'Customer Pickup Window',
    type: 'customerPickup',
    status: 'confirmed',
    startsAt: '2026-07-26T17:00:00.000Z',
    endsAt: '2026-07-26T19:00:00.000Z',
    allDay: false,
    location: 'Retail counter',
    assignedMemberIds: ['warehouse'],
    linkedRecord: {
      recordType: 'order',
      recordId: 'order-1001',
      label: 'ORD-01001',
    },
  },
  deliveryWindow: {
    title: 'Delivery Window',
    type: 'deliveryWindow',
    status: 'scheduled',
    startsAt: '2026-07-28T14:00:00.000Z',
    endsAt: '2026-07-28T18:00:00.000Z',
    allDay: false,
    location: 'Customer address',
    assignedMemberIds: ['delivery'],
    linkedRecord: {
      recordType: 'fulfillment',
      recordId: 'fulfillment-1001',
      label: 'FUL-01001',
    },
  },
  installationAppointment: {
    title: 'Installation Appointment',
    type: 'installationAppointment',
    status: 'scheduled',
    startsAt: '2026-07-31T14:00:00.000Z',
    endsAt: '2026-07-31T16:30:00.000Z',
    allDay: false,
    location: 'Customer site',
    assignedMemberIds: ['install-team'],
    linkedRecord: {
      recordType: 'product',
      recordId: 'product-kit',
      label: 'Maintenance Kit',
    },
  },
  internalMeeting: {
    title: 'Internal Planning',
    type: 'internalMeeting',
    status: 'scheduled',
    startsAt: '2026-07-26T13:30:00.000Z',
    endsAt: '2026-07-26T14:00:00.000Z',
    allDay: false,
    assignedMemberIds: ['team-office'],
  },
  blockedTime: {
    title: 'Blocked Time',
    type: 'blockedTime',
    status: 'scheduled',
    startsAt: '2026-07-26T20:00:00.000Z',
    endsAt: '2026-07-26T21:00:00.000Z',
    allDay: false,
    assignedMemberIds: ['owner'],
  },
}

export function getSchedulingFixtureEvents({
  workspaceId,
  capabilities,
  timezone,
}: {
  workspaceId: string
  capabilities: SchedulingCapabilities
  timezone: string
}): SchedulingEvent[] {
  return capabilities.supportedEventTypes
    .map((type, index) => {
      const fixture = fixtureByType[type]
      if (!fixture) return null
      return {
        ...fixture,
        id: `${workspaceId}-${type}`,
        workspaceId,
        timezone,
        createdAt: now,
        updatedAt: now,
      } satisfies SchedulingEvent
    })
    .filter((event): event is SchedulingEvent => Boolean(event))
    .slice(0, 5)
}

export function getSchedulingFixtureSeries({
  workspaceId,
  capabilities,
}: {
  workspaceId: string
  capabilities: SchedulingCapabilities
}): SchedulingSeries[] {
  const series: SchedulingSeries[] = []
  if (capabilities.supportedEventTypes.includes('recurringServiceVisit')) {
    series.push({
      id: `${workspaceId}-recurring-service-plan`,
      workspaceId,
      title: 'Recurring Service Plan',
      eventType: 'recurringServiceVisit',
      recurrenceRule: { frequency: 'weekly', interval: 2, endType: 'never' },
      nextOccurrenceAt: '2026-07-30T13:00:00.000Z',
      status: 'active',
      assignedMemberIds: ['crew-a'],
      linkedRecord: {
        recordType: 'client',
        recordId: 'client-northstar',
        label: 'NorthStar Electric',
      },
      pricePerVisit: 250,
      createdAt: now,
      updatedAt: now,
    })
  }
  if (capabilities.supportedEventTypes.includes('recurringDelivery')) {
    series.push({
      id: `${workspaceId}-recurring-delivery-series`,
      workspaceId,
      title: 'Recurring Delivery Series',
      eventType: 'recurringDelivery',
      recurrenceRule: { frequency: 'monthly', interval: 1, endType: 'never' },
      nextOccurrenceAt: '2026-08-01T15:00:00.000Z',
      status: 'active',
      assignedMemberIds: ['delivery'],
      linkedRecord: {
        recordType: 'customer',
        recordId: 'customer-1001',
        label: 'Corbin Wesche',
      },
      createdAt: now,
      updatedAt: now,
    })
  }
  return series
}

export function getCreateOptionsForCapabilities(
  capabilities: SchedulingCapabilities,
) {
  const supported = new Set(
    SCHEDULING_PRESETS[capabilities.preset].supportedEventTypes,
  )
  return capabilities.supportedEventTypes
    .filter((type) => supported.has(type))
    .map((type) => getSchedulingEventTypeDefinition(type))
}

export function sectionEventTypes(
  section: SchedulingSectionKey,
): SchedulingEventType[] {
  return Object.values(SCHEDULING_EVENT_TYPES)
    .filter((definition) => definition.sections.includes(section))
    .map((definition) => definition.key)
}

export function eventTypeBelongsToSection(
  type: SchedulingEventType,
  section: SchedulingSectionKey,
) {
  return getSchedulingEventTypeDefinition(type).sections.includes(section)
}

export function getTeamAvailabilityFixtures({
  workspaceId,
}: {
  workspaceId: string
}): TeamAvailabilityRecord[] {
  return [
    {
      id: `${workspaceId}-working-hours-owner`,
      workspaceId,
      kind: 'workingHours',
      scope: 'member',
      workspaceMemberId: 'owner',
      memberId: 'owner',
      memberName: 'Owner',
      scheduleMode: 'custom',
      daysOfWeek: [1, 2, 3, 4, 5],
      startsAt: '09:00',
      endsAt: '17:00',
      timezone: 'America/New_York',
    },
    {
      id: `${workspaceId}-working-hours-office`,
      workspaceId,
      kind: 'workingHours',
      scope: 'team',
      teamId: 'team-office',
      teamName: 'Office Team',
      memberId: 'team-office',
      memberName: 'Office Team',
      scheduleMode: 'custom',
      daysOfWeek: [1, 2, 3, 4, 5],
      startsAt: '08:30',
      endsAt: '16:30',
      timezone: 'America/New_York',
    },
    {
      id: `${workspaceId}-time-off-owner`,
      workspaceId,
      kind: 'timeOff',
      memberId: 'owner',
      memberName: 'Owner',
      reason: 'Personal time',
      startsAt: '2026-07-31T13:00:00.000Z',
      endsAt: '2026-07-31T17:00:00.000Z',
      allDay: false,
      timezone: 'America/New_York',
      category: 'personal',
      createdByUserId: 'owner',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}-holiday-closure`,
      workspaceId,
      kind: 'availabilityException',
      scope: 'workspace',
      exceptionType: 'closed',
      title: 'Independence Day',
      date: '2026-07-04',
      allDayClosed: true,
      timezone: 'America/New_York',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `${workspaceId}-time-off-office-admin-block`,
      workspaceId,
      kind: 'timeOff',
      memberId: 'team-office',
      memberName: 'Office Team',
      reason: 'Admin Block',
      title: 'Admin Block',
      startsAt: '2026-07-29T19:00:00.000Z',
      endsAt: '2026-07-29T20:00:00.000Z',
      allDay: false,
      timezone: 'America/New_York',
      category: 'unavailable',
      createdByUserId: 'owner',
      createdAt: now,
      updatedAt: now,
    },
  ]
}
