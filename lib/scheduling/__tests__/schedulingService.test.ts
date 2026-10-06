import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  SchedulingEvent,
  TeamAvailabilityRecord,
} from '@/lib/scheduling/types'

const mocks = vi.hoisted(() => ({
  prisma: {
    workspace: {
      findUnique: vi.fn(),
    },
    workspaceSettings: {
      findUnique: vi.fn(),
    },
    calendarEventMapping: {
      updateMany: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    workspaceTeam: {
      findMany: vi.fn(),
    },
    workspaceLocation: {
      findMany: vi.fn(),
    },
  },
  schedulingRepository: {
    createEvent: vi.fn(),
    getEventById: vi.fn(),
    markSchedulingEventForExternalSync: vi.fn(),
    createAvailabilityRecord: vi.fn(),
    updateAvailabilityRecord: vi.fn(),
    duplicateEvent: vi.fn(),
    cancelRecurringEvent: vi.fn(),
    transitionEventStatus: vi.fn(),
    deleteRecurringEvent: vi.fn(),
    softDeleteEvent: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({
  prisma: mocks.prisma,
}))

vi.mock('@/lib/scheduling/repository', () => ({
  schedulingRepository: mocks.schedulingRepository,
}))

import {
  changeSchedulingEventStatus,
  createSchedulingAvailabilityRecord,
  createSchedulingEvent,
  deleteSchedulingEvent,
  duplicateSchedulingEvent,
} from '@/lib/scheduling/services/schedulingService'

const actor = {
  workspaceId: 'workspace-alpha',
  actorUserId: 'user-owner',
  workspaceMemberId: 'workspace-member-owner',
  canManageScheduling: true,
}

const baseWorkingHours = {
  kind: 'workingHours',
  memberName: 'Owner',
  scheduleMode: 'custom',
  daysOfWeek: [1, 2, 3, 4, 5],
  startsAt: '09:00',
  endsAt: '17:00',
  timezone: 'America/New_York',
} satisfies Omit<
  Extract<TeamAvailabilityRecord, { kind: 'workingHours' }>,
  'id' | 'workspaceId'
>

const recurringOccurrence = {
  id: 'occurrence-1',
  workspaceId: actor.workspaceId,
  title: 'Recurring service visit',
  type: 'recurringServiceVisit',
  status: 'scheduled',
  startsAt: '2026-07-31T14:00:00.000Z',
  endsAt: '2026-07-31T15:00:00.000Z',
  allDay: false,
  timezone: 'America/New_York',
  assignedMemberIds: ['workspace-member-owner'],
  recurrenceSeriesId: 'series-1',
  occurrenceOriginalAt: '2026-07-31T14:00:00.000Z',
  occurrenceState: 'generated',
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
} satisfies SchedulingEvent

describe('scheduling availability service', () => {
  beforeEach(() => {
    mocks.prisma.workspace.findUnique.mockReset()
    mocks.prisma.workspaceSettings.findUnique.mockReset()
    mocks.prisma.calendarEventMapping.updateMany.mockReset()
    mocks.prisma.workspaceMember.findFirst.mockReset()
    mocks.prisma.workspaceMember.findMany.mockReset()
    mocks.prisma.workspaceTeam.findMany.mockReset()
    mocks.prisma.workspaceLocation.findMany.mockReset()
    mocks.schedulingRepository.createAvailabilityRecord.mockReset()
    mocks.schedulingRepository.updateAvailabilityRecord.mockReset()
    mocks.schedulingRepository.duplicateEvent.mockReset()
    mocks.schedulingRepository.cancelRecurringEvent.mockReset()
    mocks.schedulingRepository.transitionEventStatus.mockReset()
    mocks.schedulingRepository.deleteRecurringEvent.mockReset()
    mocks.schedulingRepository.softDeleteEvent.mockReset()
    mocks.schedulingRepository.createEvent.mockReset()
    mocks.schedulingRepository.getEventById.mockReset()
    mocks.schedulingRepository.markSchedulingEventForExternalSync.mockReset()
    mocks.schedulingRepository.createAvailabilityRecord.mockImplementation(
      async ({ record }) => ({
        id: 'created-working-hours',
        workspaceId: actor.workspaceId,
        ...record,
      }),
    )
    mocks.prisma.workspace.findUnique.mockResolvedValue({
      id: actor.workspaceId,
      businessModel: 'CONSULTATIVE_SALES',
      timezone: 'America/New_York',
    })
    mocks.prisma.workspaceSettings.findUnique.mockResolvedValue(null)
    mocks.prisma.workspaceMember.findMany.mockResolvedValue([])
    mocks.prisma.calendarEventMapping.updateMany.mockResolvedValue({ count: 0 })
  })

  it('defaults recurring cancellation to this occurrence so lifecycle protections cannot be bypassed', async () => {
    mocks.schedulingRepository.getEventById
      .mockResolvedValueOnce(recurringOccurrence)
      .mockResolvedValueOnce({ ...recurringOccurrence, status: 'canceled' })

    await changeSchedulingEventStatus({
      actor,
      eventId: recurringOccurrence.id,
      status: 'canceled',
    })

    expect(
      mocks.schedulingRepository.cancelRecurringEvent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: actor.workspaceId,
        occurrenceId: recurringOccurrence.id,
        scope: 'thisOccurrence',
      }),
    )
    expect(
      mocks.schedulingRepository.transitionEventStatus,
    ).not.toHaveBeenCalled()
  })

  it('defaults recurring deletion to this occurrence so completed history stays protected', async () => {
    mocks.schedulingRepository.getEventById.mockResolvedValue(
      recurringOccurrence,
    )

    await deleteSchedulingEvent({
      actor,
      eventId: recurringOccurrence.id,
    })

    expect(
      mocks.schedulingRepository.deleteRecurringEvent,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: actor.workspaceId,
        occurrenceId: recurringOccurrence.id,
        scope: 'thisOccurrence',
      }),
    )
    expect(mocks.schedulingRepository.softDeleteEvent).not.toHaveBeenCalled()
  })

  it('re-reads created events before reporting scheduling success', async () => {
    const createdEvent = {
      id: 'event-created',
      workspaceId: actor.workspaceId,
      title: 'Emergency Service',
      type: 'internalMeeting',
      status: 'scheduled',
      startsAt: '2026-07-31T02:00:00.000Z',
      endsAt: '2026-07-31T03:00:00.000Z',
      allDay: false,
      timezone: 'America/New_York',
      assignedMemberIds: ['workspace-member-owner'],
      createdAt: '2026-07-30T14:00:00.000Z',
      updatedAt: '2026-07-30T14:00:00.000Z',
    }
    mocks.schedulingRepository.createEvent.mockResolvedValue(createdEvent)
    mocks.schedulingRepository.getEventById.mockResolvedValue({
      ...createdEvent,
      title: 'Emergency Service persisted',
    })

    const result = await createSchedulingEvent({
      actor,
      input: {
        title: 'Emergency Service',
        type: 'internalMeeting',
        status: 'scheduled',
        startsAt: '2026-07-31T02:00:00.000Z',
        endsAt: '2026-07-31T03:00:00.000Z',
        allDay: false,
        timezone: 'America/New_York',
        assignedMemberIds: ['workspace-member-owner'],
      },
    })

    expect(mocks.schedulingRepository.getEventById).toHaveBeenCalledWith({
      workspaceId: actor.workspaceId,
      eventId: 'event-created',
    })
    expect(result.title).toBe('Emergency Service persisted')
  })

  it('preserves normalized MEMBER assignment targets in the recurring Scheduling write contract', async () => {
    mocks.prisma.workspace.findUnique.mockResolvedValue({
      id: actor.workspaceId,
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      timezone: 'America/New_York',
    })
    const createdEvent = {
      id: 'event-created',
      workspaceId: actor.workspaceId,
      title: 'Recurring lawn service',
      type: 'recurringServiceVisit',
      status: 'scheduled',
      startsAt: '2026-07-31T13:00:00.000Z',
      endsAt: '2026-07-31T14:00:00.000Z',
      allDay: false,
      timezone: 'America/New_York',
      assignedMemberIds: ['workspace-member-owner'],
      createdAt: '2026-07-30T14:00:00.000Z',
      updatedAt: '2026-07-30T14:00:00.000Z',
    }
    mocks.schedulingRepository.createEvent.mockResolvedValue(createdEvent)
    mocks.schedulingRepository.getEventById.mockResolvedValue(createdEvent)

    await createSchedulingEvent({
      actor,
      input: {
        title: 'Recurring lawn service',
        type: 'recurringServiceVisit',
        startsAt: '2026-07-31T13:00:00.000Z',
        endsAt: '2026-07-31T14:00:00.000Z',
        timezone: 'America/New_York',
        locationType: 'toBeDetermined',
        assignedMemberIds: ['workspace-member-owner'],
        assignments: [
          {
            assignmentType: 'MEMBER',
            workspaceMemberId: 'workspace-member-owner',
            displaySnapshot: 'Owner',
          },
        ],
        linkedRecord: {
          recordType: 'customer',
          recordId: 'customer-1',
          label: 'Morgan Home',
        },
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [1, 3, 5],
          endType: 'never',
        },
      },
    })

    expect(mocks.schedulingRepository.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          assignedMemberIds: ['workspace-member-owner'],
          assignments: [
            expect.objectContaining({
              assignmentType: 'MEMBER',
              workspaceMemberId: 'workspace-member-owner',
            }),
          ],
          recurrenceRule: expect.objectContaining({
            daysOfWeek: [1, 3, 5],
          }),
        }),
      }),
    )
  })

  it('rejects a direct API attempt to create a TEAM-assigned recurring service visit', async () => {
    await expect(
      createSchedulingEvent({
        actor,
        input: {
          title: 'Recurring lawn service',
          type: 'recurringServiceVisit',
          startsAt: '2026-07-31T13:00:00.000Z',
          endsAt: '2026-07-31T14:00:00.000Z',
          timezone: 'America/New_York',
          locationType: 'toBeDetermined',
          assignments: [
            {
              assignmentType: 'TEAM',
              teamId: 'team-1',
              displaySnapshot: 'Crew One',
            },
          ],
          recurrenceRule: {
            frequency: 'weekly',
            interval: 1,
            daysOfWeek: [1, 3, 5],
            endType: 'never',
          },
        },
      }),
    ).rejects.toMatchObject({
      status: 400,
      message:
        'Recurring Services support member assignments only during controlled launch.',
    })
    expect(mocks.schedulingRepository.createEvent).not.toHaveBeenCalled()
  })

  it('does not report scheduling success when read-after-write fails', async () => {
    mocks.schedulingRepository.createEvent.mockResolvedValue({
      id: 'event-created',
      workspaceId: actor.workspaceId,
      title: 'Emergency Service',
      type: 'internalMeeting',
      status: 'scheduled',
      startsAt: '2026-07-31T02:00:00.000Z',
      endsAt: '2026-07-31T03:00:00.000Z',
      allDay: false,
      timezone: 'America/New_York',
      assignedMemberIds: ['workspace-member-owner'],
      createdAt: '2026-07-30T14:00:00.000Z',
      updatedAt: '2026-07-30T14:00:00.000Z',
    })
    mocks.schedulingRepository.getEventById.mockResolvedValue(null)

    await expect(
      createSchedulingEvent({
        actor,
        input: {
          title: 'Emergency Service',
          type: 'internalMeeting',
          status: 'scheduled',
          startsAt: '2026-07-31T02:00:00.000Z',
          endsAt: '2026-07-31T03:00:00.000Z',
          allDay: false,
          timezone: 'America/New_York',
          assignedMemberIds: ['workspace-member-owner'],
        },
      }),
    ).rejects.toMatchObject({
      message:
        'The event was not found after scheduling. No success confirmation was sent.',
      status: 500,
    })
  })

  it('validates member Working Hours against the active workspace member relationship', async () => {
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue({
      id: 'workspace-member-owner',
    })

    await createSchedulingAvailabilityRecord({
      actor,
      record: {
        ...baseWorkingHours,
        scope: 'member',
        memberId: 'workspace-member-owner',
        workspaceMemberId: 'workspace-member-owner',
      },
    })

    expect(mocks.prisma.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'workspace-member-owner',
        workspaceId: 'workspace-alpha',
      },
      select: { id: true },
    })
    expect(
      mocks.schedulingRepository.createAvailabilityRecord,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-alpha',
        record: expect.objectContaining({
          scope: 'member',
          workspaceMemberId: 'workspace-member-owner',
        }),
      }),
    )
  })

  it('rejects member Working Hours for a foreign or missing workspace member', async () => {
    mocks.prisma.workspaceMember.findFirst.mockResolvedValue(null)

    await expect(
      createSchedulingAvailabilityRecord({
        actor,
        record: {
          ...baseWorkingHours,
          scope: 'member',
          memberId: 'workspace-member-foreign',
          workspaceMemberId: 'workspace-member-foreign',
        },
      }),
    ).rejects.toMatchObject({
      message: 'Choose an active team member.',
      fieldErrors: {
        workspaceMemberId: 'Choose an active team member.',
      },
    })
    expect(
      mocks.schedulingRepository.createAvailabilityRecord,
    ).not.toHaveBeenCalled()
  })

  it('stores Team Working Hours only when the team is authoritative and active', async () => {
    mocks.prisma.workspaceTeam.findMany.mockResolvedValue([
      {
        id: 'team-field',
        workspaceId: 'workspace-alpha',
        name: 'Field Crew',
        description: null,
        teamType: 'FIELD_CREW',
        leadMemberId: null,
        isActive: true,
        archivedAt: null,
        createdAt: '2026-07-25T12:00:00.000Z',
        updatedAt: '2026-07-25T12:00:00.000Z',
        members: [],
      },
    ])

    await createSchedulingAvailabilityRecord({
      actor,
      record: {
        ...baseWorkingHours,
        scope: 'team',
        memberId: 'team-field',
        teamId: 'team-field',
      },
    })

    expect(
      mocks.schedulingRepository.createAvailabilityRecord,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          scope: 'team',
          teamId: 'team-field',
          teamName: 'Field Crew',
          memberName: 'Field Crew',
        }),
      }),
    )
  })

  it('rejects Team Working Hours for foreign or archived teams', async () => {
    mocks.prisma.workspaceTeam.findMany.mockResolvedValue([])
    await expect(
      createSchedulingAvailabilityRecord({
        actor,
        record: {
          ...baseWorkingHours,
          scope: 'team',
          memberId: 'team-office',
          memberName: 'Office Team',
          teamId: 'team-office',
          teamName: 'Office Team',
        },
      }),
    ).rejects.toMatchObject({
      message: 'Choose an active workspace team.',
      fieldErrors: {
        teamId: 'Choose an active workspace team.',
      },
    })
    expect(
      mocks.schedulingRepository.createAvailabilityRecord,
    ).not.toHaveBeenCalled()
  })

  it('stores Location Working Hours only when the location is authoritative and active', async () => {
    mocks.prisma.workspaceLocation.findMany.mockResolvedValue([
      {
        id: 'location-main',
        workspaceId: 'workspace-alpha',
        name: 'Main Office',
        locationType: 'OFFICE',
        city: 'Fairfax',
        region: 'VA',
        timezone: 'America/New_York',
        isPrimary: true,
        isActive: true,
        archivedAt: null,
        createdAt: '2026-07-25T12:00:00.000Z',
        updatedAt: '2026-07-25T12:00:00.000Z',
      },
    ])

    await createSchedulingAvailabilityRecord({
      actor,
      record: {
        ...baseWorkingHours,
        scope: 'location',
        memberId: 'location:location-main',
        locationId: 'location-main',
      },
    })

    expect(
      mocks.schedulingRepository.createAvailabilityRecord,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        record: expect.objectContaining({
          scope: 'location',
          locationId: 'location-main',
          locationName: 'Main Office',
          memberName: 'Main Office',
        }),
      }),
    )
  })

  it('rejects Location Working Hours for foreign or archived locations', async () => {
    mocks.prisma.workspaceLocation.findMany.mockResolvedValue([])
    await expect(
      createSchedulingAvailabilityRecord({
        actor,
        record: {
          ...baseWorkingHours,
          scope: 'location',
          memberId: 'location:main-office',
          memberName: 'Main Office',
          locationId: 'main-office',
          locationName: 'Main Office',
        },
      }),
    ).rejects.toMatchObject({
      message: 'Choose an active workspace location.',
      fieldErrors: {
        locationId: 'Choose an active workspace location.',
      },
    })
    expect(
      mocks.schedulingRepository.createAvailabilityRecord,
    ).not.toHaveBeenCalled()
  })

  it('passes recurrence duplication scope through to the repository', async () => {
    mocks.schedulingRepository.duplicateEvent.mockResolvedValue({
      id: 'duplicated-series',
      workspaceId: actor.workspaceId,
    })

    await duplicateSchedulingEvent({
      actor,
      eventId: 'recurring-event',
      scope: 'entireSeries',
    })

    expect(mocks.schedulingRepository.duplicateEvent).toHaveBeenCalledWith({
      workspaceId: actor.workspaceId,
      actorUserId: actor.actorUserId,
      eventId: 'recurring-event',
      scope: 'entireSeries',
    })
  })
})
