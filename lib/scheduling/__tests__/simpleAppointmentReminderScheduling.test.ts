import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  readiness: vi.fn(),
  queryRaw: vi.fn(),
  workspaceFindUnique: vi.fn(),
  preferenceFindFirst: vi.fn(),
  preferenceFindMany: vi.fn(),
  installationFindFirst: vi.fn(),
  dispatchFindUnique: vi.fn(),
  eventFindMany: vi.fn(),
  eventFindFirst: vi.fn(),
  reminderUpdateMany: vi.fn(),
  reminderUpsert: vi.fn(),
  reminderUpdate: vi.fn(),
  outboxUpdateMany: vi.fn(),
  reconcileRecurringJobs: vi.fn(),
  reconcileRecurringJobLifecycle: vi.fn(async () => 'ignored'),
}))

vi.mock('@/lib/recurring-services/jobMaterialization', () => ({
  reconcileRecurringServiceJobsForSchedulingOutbox:
    mocks.reconcileRecurringJobs,
}))

vi.mock('@/lib/recurring-services/jobLifecycle', () => ({
  reconcileRecurringJobLifecycleForSchedulingOutbox:
    mocks.reconcileRecurringJobLifecycle,
}))

vi.mock('@/lib/automations/simpleAutomationDispatch', () => ({
  dispatchSimpleAutomationEvent: mocks.dispatch,
}))

vi.mock('@/lib/automations/simpleAutomationReadiness', () => ({
  getSimpleAutomationReadiness: mocks.readiness,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    workspace: { findUnique: mocks.workspaceFindUnique },
    schedulingNotificationPreference: {
      findFirst: mocks.preferenceFindFirst,
      findMany: mocks.preferenceFindMany,
    },
    simpleAutomationInstallation: {
      findFirst: mocks.installationFindFirst,
    },
    simpleAutomationDispatch: { findUnique: mocks.dispatchFindUnique },
    schedulingEvent: {
      findMany: mocks.eventFindMany,
      findFirst: mocks.eventFindFirst,
    },
    schedulingReminderSchedule: {
      updateMany: mocks.reminderUpdateMany,
      upsert: mocks.reminderUpsert,
      update: mocks.reminderUpdate,
    },
    domainOutboxEvent: { updateMany: mocks.outboxUpdateMany },
  },
}))

import {
  processDueSchedulingReminders,
  processPendingNotificationDeliveries,
  processSchedulingNotificationOutbox,
  reconcileSchedulingReminders,
} from '@/lib/scheduling/notifications/notificationService'
import { SIMPLE_APPOINTMENT_REMINDER_SOURCE } from '@/lib/automations/simpleAppointmentReminder'
import {
  SIMPLE_SCHEDULE_CHANGE_SOURCE,
  buildScheduleChangeSnapshot,
} from '@/lib/automations/simpleScheduleChangeNotification'

const now = new Date('2026-10-01T12:00:00.000Z')
const startsAt = new Date('2026-10-01T14:00:00.000Z')
const appointmentConfig = {
  'reminder-offset': '1-hour',
  'notification-channel': 'in-app',
  recipient: 'appointment-assignees-or-owner',
}
const scheduleChangeConfig = {
  changes: ['time', 'assignment', 'canceled'],
  'notification-channel': 'in-app',
  recipient: 'appointment-assignees-or-owner',
}

const scheduleChange = buildScheduleChangeSnapshot({
  eventId: 'event-1',
  eventTypeKey: 'serviceAppointment',
  title: 'Spring Cleanup',
  timezone: 'America/New_York',
  recurrenceSeriesId: null,
  occurrenceOriginalAt: null,
  occurrenceState: null,
  scope: 'single',
  before: {
    startsAtUtc: new Date('2026-10-01T13:30:00.000Z'),
    status: 'scheduled',
    assignments: [{ workspaceMemberId: 'member-1' }],
  },
  after: {
    startsAtUtc: startsAt,
    status: 'scheduled',
    assignments: [{ workspaceMemberId: 'member-1' }],
  },
})!

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    workspaceId: 'workspace-1',
    eventTypeKey: 'serviceAppointment',
    title: 'Spring Cleanup',
    status: 'SCHEDULED',
    startsAtUtc: startsAt,
    endsAtUtc: new Date('2026-10-01T15:00:00.000Z'),
    timezone: 'America/New_York',
    deletedAt: null,
    recurrenceSeriesId: null,
    occurrenceOriginalAt: null,
    occurrenceState: null,
    reminderPolicy: { mode: 'none' },
    assignments: [{ workspaceMemberId: 'member-1', teamId: null }],
    attendees: [],
    recurrenceSeries: null,
    masterSeries: null,
    ...overrides,
  }
}

function installation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'installation-1',
    definitionVersion: 2,
    config: appointmentConfig,
    automation: { id: 'automation-1' },
    ...overrides,
  }
}

function claimedReminder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reminder-1',
    workspaceId: 'workspace-1',
    schedulingEventId: 'event-1',
    recurrenceSeriesId: null,
    occurrenceId: null,
    recipientType: 'simpleAutomation',
    recipientUserId: null,
    recipientWorkspaceMemberId: null,
    recipientEmail: null,
    channel: 'IN_APP',
    offsetMinutes: 60,
    scheduledForUtc: new Date('2026-10-01T13:00:00.000Z'),
    eventStartsAtUtc: startsAt,
    timezone: 'America/New_York',
    source: SIMPLE_APPOINTMENT_REMINDER_SOURCE,
    attempts: 1,
    metadata: {
      installationId: 'installation-1',
      automationId: 'automation-1',
      definitionVersion: 2,
      offsetMinutes: 60,
      eventStartsAtUtc: startsAt.toISOString(),
      occurrenceOriginalAt: null,
      scheduleRevision: 'revision-1',
    },
    ...overrides,
  }
}

function claimedScheduleChange(overrides: Record<string, unknown> = {}) {
  return claimedReminder({
    id: 'schedule-change-1',
    offsetMinutes: 0,
    scheduledForUtc: now,
    source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
    metadata: {
      installationId: 'schedule-installation-1',
      automationId: 'schedule-automation-1',
      outboxEventId: 'outbox-change-1',
      change: scheduleChange,
    },
    ...overrides,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('SCHEDULING_NOTIFICATIONS_ENABLED', 'true')
  mocks.workspaceFindUnique.mockResolvedValue({
    id: 'workspace-1',
    slug: 'acme',
    name: 'Acme',
    businessName: 'Acme',
    ownerId: 'owner-1',
    businessModel: 'SIMPLE_SERVICE_BUSINESS',
    settings: null,
    members: [],
    workspaceTeams: [],
  })
  mocks.preferenceFindFirst.mockResolvedValue(null)
  mocks.preferenceFindMany.mockResolvedValue([])
  mocks.installationFindFirst.mockResolvedValue(installation())
  mocks.readiness.mockResolvedValue({ ready: true })
  mocks.eventFindMany.mockResolvedValue([event()])
  mocks.eventFindFirst.mockResolvedValue(event())
  mocks.reminderUpdateMany.mockResolvedValue({ count: 0 })
  mocks.reminderUpsert.mockResolvedValue({ id: 'reminder-1' })
  mocks.reminderUpdate.mockResolvedValue({ id: 'reminder-1' })
  mocks.outboxUpdateMany.mockResolvedValue({ count: 1 })
  mocks.dispatch.mockResolvedValue({ dispatched: true, runId: 'run-1' })
  mocks.reconcileRecurringJobs.mockResolvedValue({
    examined: 0,
    created: 0,
    existing: 0,
    ineligible: 0,
  })
})

describe('Scheduling notification global kill switch', () => {
  it('fails closed when missing and preserves all queued work', async () => {
    delete process.env.SCHEDULING_NOTIFICATIONS_ENABLED

    await expect(processSchedulingNotificationOutbox()).resolves.toMatchObject({
      claimed: 0,
    })
    await expect(processDueSchedulingReminders()).resolves.toMatchObject({
      claimed: 0,
    })
    await expect(processPendingNotificationDeliveries()).resolves.toMatchObject(
      { claimed: 0 },
    )
    expect(mocks.queryRaw).not.toHaveBeenCalled()
  })

  it('resumes normal bounded claims after re-enable', async () => {
    vi.stubEnv('SCHEDULING_NOTIFICATIONS_ENABLED', 'false')
    await processSchedulingNotificationOutbox()
    expect(mocks.queryRaw).not.toHaveBeenCalled()

    vi.stubEnv('SCHEDULING_NOTIFICATIONS_ENABLED', 'true')
    mocks.queryRaw.mockResolvedValue([])
    await processSchedulingNotificationOutbox()
    expect(mocks.queryRaw).toHaveBeenCalledOnce()
  })
})

describe('Simple Appointment Reminder scheduling', () => {
  it('establishes one future occurrence reminder at start minus offset', async () => {
    const result = await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      reason: 'scheduling.event.created',
      nowUtc: now,
      establishedAt: now,
    })

    expect(result).toMatchObject({ created: 1, skipped: 0 })
    expect(mocks.reminderUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.reminderUpsert.mock.calls[0][0].create).toMatchObject({
      schedulingEventId: 'event-1',
      source: SIMPLE_APPOINTMENT_REMINDER_SOURCE,
      scheduledForUtc: new Date('2026-10-01T13:00:00.000Z'),
      offsetMinutes: 60,
      recipientType: 'simpleAutomation',
    })
    expect(mocks.installationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          updatedAt: { lt: now },
          automation: expect.objectContaining({ updatedAt: { lt: now } }),
        }),
      }),
    )
  })

  it('fails closed for work sharing the activation timestamp millisecond', async () => {
    mocks.installationFindFirst.mockResolvedValue(null)

    await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      reason: 'scheduling.event.created',
      nowUtc: now,
      establishedAt: now,
    })

    expect(mocks.installationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          updatedAt: { lt: now },
          automation: expect.objectContaining({ updatedAt: { lt: now } }),
        }),
      }),
    )
    expect(mocks.reminderUpsert).not.toHaveBeenCalled()
  })

  it('does not catch up when the configured reminder window has passed', async () => {
    mocks.eventFindMany.mockResolvedValue([
      event({ startsAtUtc: new Date('2026-10-01T12:20:00.000Z') }),
    ])

    const result = await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      reason: 'scheduling.event.created',
      nowUtc: now,
    })

    expect(result.skipped).toBe(1)
    expect(mocks.reminderUpsert).not.toHaveBeenCalled()
  })

  it('does not establish automation work while the installation is inactive', async () => {
    mocks.installationFindFirst.mockResolvedValue(null)

    await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      reason: 'scheduling.event.created',
      nowUtc: now,
    })

    expect(mocks.reminderUpsert).not.toHaveBeenCalled()
  })

  it('cancels prior work before establishing a rescheduled revision', async () => {
    mocks.reminderUpdateMany.mockResolvedValue({ count: 1 })
    mocks.eventFindMany.mockResolvedValue([
      event({ startsAtUtc: new Date('2026-10-02T14:00:00.000Z') }),
    ])

    const result = await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      reason: 'scheduling.event.updated',
      nowUtc: now,
    })

    expect(result.canceled).toBe(1)
    expect(
      mocks.reminderUpsert.mock.calls[0][0].create.scheduledForUtc,
    ).toEqual(new Date('2026-10-02T13:00:00.000Z'))
  })

  it('keeps jobs and internal meetings outside the target set', async () => {
    mocks.eventFindMany.mockResolvedValue([
      event({ eventTypeKey: 'scheduledJob' }),
      event({ id: 'event-2', eventTypeKey: 'internalMeeting' }),
    ])

    await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      seriesId: 'series-1',
      reason: 'scheduling.recurrence_series.created',
      nowUtc: now,
    })

    expect(mocks.reminderUpsert).not.toHaveBeenCalled()
  })

  it('suppresses an exact overlapping built-in in-app reminder', async () => {
    mocks.workspaceFindUnique.mockResolvedValue({
      id: 'workspace-1',
      slug: 'acme',
      name: 'Acme',
      businessName: 'Acme',
      ownerId: 'owner-1',
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      settings: null,
      members: [
        {
          id: 'member-1',
          userId: 'user-1',
          user: { fullName: 'Alex', email: 'alex@example.com' },
        },
      ],
      workspaceTeams: [],
    })
    mocks.eventFindMany.mockResolvedValue([
      event({
        reminderPolicy: {
          mode: 'custom',
          reminders: [
            {
              channel: 'inApp',
              offsetMinutes: 60,
              recipientGroup: 'assignedMembers',
            },
          ],
        },
      }),
    ])

    await reconcileSchedulingReminders({
      workspaceId: 'workspace-1',
      eventId: 'event-1',
      reason: 'scheduling.event.created',
      nowUtc: now,
    })

    expect(mocks.reminderUpsert).toHaveBeenCalledTimes(1)
    expect(mocks.reminderUpsert.mock.calls[0][0].create.source).toBe(
      SIMPLE_APPOINTMENT_REMINDER_SOURCE,
    )
  })
})

describe('Simple Appointment Reminder due processing', () => {
  it('does not execute a reminder before its durable due time', async () => {
    mocks.queryRaw.mockResolvedValue([])

    const result = await processDueSchedulingReminders({ nowUtc: now })

    expect(result.claimed).toBe(0)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('dispatches an eligible due reminder exactly once through Simple Automation', async () => {
    mocks.queryRaw.mockResolvedValue([claimedReminder()])

    const result = await processDueSchedulingReminders({
      nowUtc: new Date('2026-10-01T13:00:00.000Z'),
    })

    expect(result).toMatchObject({ claimed: 1, sent: 1, failed: 0 })
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        installationId: 'installation-1',
        automationId: 'automation-1',
        workspaceId: 'workspace-1',
        eventKey: 'native:scheduling-reminder:reminder-1',
        triggerPayload: expect.objectContaining({
          reminderClaimedBy: expect.any(String),
        }),
      }),
    )
  })

  it('fences failure finalization to the worker that owns the reminder lease', async () => {
    mocks.queryRaw.mockResolvedValue([claimedReminder()])
    mocks.dispatch.mockRejectedValueOnce(
      new Error('Appointment Reminder worker claim was lost.'),
    )

    const result = await processDueSchedulingReminders({
      nowUtc: new Date('2026-10-01T13:00:00.000Z'),
      workerId: 'stale-worker',
    })

    expect(result.failed).toBe(1)
    expect(mocks.reminderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'reminder-1',
          status: 'PROCESSING',
          claimedBy: 'stale-worker',
        }),
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    )
    expect(mocks.reminderUpdate).not.toHaveBeenCalled()
  })

  it.each(['CANCELED', 'COMPLETED', 'MISSED'])(
    'terminally skips a %s occurrence',
    async (status) => {
      mocks.queryRaw.mockResolvedValue([claimedReminder()])
      mocks.eventFindFirst.mockResolvedValue(event({ status }))

      const result = await processDueSchedulingReminders({
        nowUtc: new Date('2026-10-01T13:00:00.000Z'),
      })

      expect(result.skipped).toBe(1)
      expect(mocks.dispatch).not.toHaveBeenCalled()
    },
  )

  it('skips stale work after a configuration change instead of duplicating', async () => {
    mocks.queryRaw.mockResolvedValue([claimedReminder()])
    mocks.installationFindFirst.mockResolvedValue(
      installation({
        config: { ...appointmentConfig, 'reminder-offset': '30-minutes' },
      }),
    )

    const result = await processDueSchedulingReminders({
      nowUtc: new Date('2026-10-01T13:00:00.000Z'),
    })

    expect(result.skipped).toBe(1)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })

  it('reconciles a successful dispatch when reminder finalization is retried', async () => {
    mocks.queryRaw.mockResolvedValue([claimedReminder({ attempts: 2 })])
    mocks.dispatch.mockResolvedValue({ dispatched: false, duplicate: true })
    mocks.dispatchFindUnique.mockResolvedValue({ status: 'SUCCEEDED' })

    const result = await processDueSchedulingReminders({
      nowUtc: new Date('2026-10-01T13:00:00.000Z'),
    })

    expect(result.sent).toBe(1)
    expect(mocks.reminderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'reminder-1',
          claimedBy: expect.any(String),
        }),
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    )
  })
})

describe('Simple Schedule Change Notification processing', () => {
  it('establishes one immediate durable work item from a trusted change snapshot', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-change-1',
        workspaceId: 'workspace-1',
        topic: 'scheduling.event.updated',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'event-1',
        payload: { eventId: 'event-1', scheduleChange },
        attempts: 1,
        createdAt: new Date('2026-10-01T12:00:00.001Z'),
      },
    ])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })

    const result = await processSchedulingNotificationOutbox({ nowUtc: now })

    expect(result).toMatchObject({ claimed: 1, processed: 1, failed: 0 })
    expect(mocks.reminderUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          schedulingEventId: 'event-1',
          source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
          scheduledForUtc: now,
          metadata: expect.objectContaining({
            outboxEventId: 'outbox-change-1',
          }),
        }),
        update: {},
      }),
    )
    expect(mocks.installationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          updatedAt: { lt: new Date('2026-10-01T12:00:00.001Z') },
          automation: expect.objectContaining({
            updatedAt: { lt: new Date('2026-10-01T12:00:00.001Z') },
          }),
        }),
      }),
    )
    expect(
      Math.max(...mocks.reminderUpdateMany.mock.invocationCallOrder),
    ).toBeLessThan(mocks.reminderUpsert.mock.invocationCallOrder[0])
    expect(mocks.reminderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: { not: SIMPLE_SCHEDULE_CHANGE_SOURCE },
        }),
      }),
    )
    expect(mocks.outboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'outbox-change-1',
          status: 'PROCESSING',
          claimedBy: expect.any(String),
        },
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    )
  })

  it('preserves already-established change work when the outbox record retries', async () => {
    const record = {
      id: 'outbox-change-retry-1',
      workspaceId: 'workspace-1',
      topic: 'scheduling.event.updated',
      aggregateType: 'SchedulingEvent',
      aggregateId: 'event-1',
      payload: { eventId: 'event-1', scheduleChange },
      attempts: 2,
      createdAt: new Date('2026-10-01T12:00:00.001Z'),
    }
    mocks.queryRaw.mockResolvedValue([record])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })

    await processSchedulingNotificationOutbox({ nowUtc: now })
    await processSchedulingNotificationOutbox({ nowUtc: now })

    const idempotencyKey =
      mocks.reminderUpsert.mock.calls[0][0].where.workspaceId_idempotencyKey
        .idempotencyKey
    expect(mocks.reminderUpsert).toHaveBeenCalledTimes(2)
    expect(
      mocks.reminderUpsert.mock.calls.map(
        ([input]) => input.where.workspaceId_idempotencyKey.idempotencyKey,
      ),
    ).toEqual([idempotencyKey, idempotencyKey])
    expect(
      mocks.reminderUpdateMany.mock.calls.every(
        ([input]) => input.where.source?.not === SIMPLE_SCHEDULE_CHANGE_SOURCE,
      ),
    ).toBe(true)
  })

  it('fences outbox failure finalization to the claiming worker', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-change-failure-1',
        workspaceId: 'workspace-1',
        topic: 'scheduling.event.updated',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'event-1',
        payload: { eventId: 'event-1', scheduleChange },
        attempts: 1,
        createdAt: new Date('2026-10-01T12:00:00.001Z'),
      },
    ])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })
    mocks.readiness.mockRejectedValueOnce(new Error('readiness unavailable'))

    const result = await processSchedulingNotificationOutbox({
      nowUtc: now,
      workerId: 'outbox-worker-a',
    })

    expect(result.failed).toBe(1)
    expect(mocks.outboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'outbox-change-failure-1',
          status: 'PROCESSING',
          claimedBy: 'outbox-worker-a',
        },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    )
  })

  it('keeps distinct changes eligible even when a claimed batch is returned out of order', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-cancel-later',
        workspaceId: 'workspace-1',
        topic: 'scheduling.event.canceled',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'event-1',
        payload: { eventId: 'event-1', scheduleChange },
        attempts: 1,
        createdAt: new Date('2026-10-01T12:00:01.001Z'),
      },
      {
        id: 'outbox-cancel-first',
        workspaceId: 'workspace-1',
        topic: 'scheduling.event.canceled',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'event-1',
        payload: { eventId: 'event-1', scheduleChange },
        attempts: 1,
        createdAt: new Date('2026-10-01T12:00:00.001Z'),
      },
    ])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })

    await processSchedulingNotificationOutbox({ nowUtc: now })

    const workKeys = mocks.reminderUpsert.mock.calls.map(
      ([input]) => input.where.workspaceId_idempotencyKey.idempotencyKey,
    )
    expect(workKeys).toHaveLength(2)
    expect(workKeys[0]).not.toBe(workKeys[1])
    expect(mocks.reminderUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
        }),
      }),
    )
  })

  it('reconciles a recurring scope before establishing its current change', async () => {
    const recurringChange = {
      ...scheduleChange,
      recurrenceSeriesId: 'series-1',
      occurrenceOriginalAt: '2026-10-01T14:00:00.000Z',
      scope: 'entireSeries' as const,
    }
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-series-change-1',
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.series_updated',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'series-1',
        payload: {
          eventId: 'event-1',
          seriesId: 'series-1',
          scheduleChange: recurringChange,
        },
        attempts: 1,
        createdAt: new Date('2026-10-01T12:00:00.001Z'),
      },
    ])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })

    await processSchedulingNotificationOutbox({ nowUtc: now })

    expect(mocks.reminderUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
          recurrenceSeriesId: 'series-1',
        }),
      }),
    )
    expect(
      Math.max(...mocks.reminderUpdateMany.mock.invocationCallOrder),
    ).toBeLessThan(mocks.reminderUpsert.mock.invocationCallOrder[0])
  })

  it('does not treat recurrence materialization as a schedule change', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-materialized',
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.materialized',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'series-1',
        payload: { seriesId: 'series-1' },
        attempts: 1,
        createdAt: now,
      },
    ])

    await processSchedulingNotificationOutbox({ nowUtc: now })

    expect(mocks.reminderUpsert).not.toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
        }),
      }),
    )
    expect(mocks.reminderUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: { not: SIMPLE_SCHEDULE_CHANGE_SOURCE },
        }),
      }),
    )
    expect(mocks.reminderUpdateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: SIMPLE_SCHEDULE_CHANGE_SOURCE,
        }),
      }),
    )
  })

  it('dispatches current change work with the reminder worker claim', async () => {
    mocks.queryRaw.mockResolvedValue([claimedScheduleChange()])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })

    const result = await processDueSchedulingReminders({
      nowUtc: now,
      workerId: 'schedule-worker-1',
    })

    expect(result).toMatchObject({ sent: 1, failed: 0 })
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        eventKey: 'native:schedule-change:schedule-change-1',
        triggerPayload: expect.objectContaining({
          reminderClaimedBy: 'schedule-worker-1',
          outboxEventId: 'outbox-change-1',
        }),
      }),
    )
  })

  it('terminally skips an intermediate change after a newer reschedule', async () => {
    mocks.queryRaw.mockResolvedValue([claimedScheduleChange()])
    mocks.installationFindFirst.mockResolvedValue({
      id: 'schedule-installation-1',
      definitionVersion: 2,
      config: scheduleChangeConfig,
      automation: { id: 'schedule-automation-1' },
    })
    mocks.eventFindFirst.mockResolvedValue(
      event({ startsAtUtc: new Date('2026-10-01T15:00:00.000Z') }),
    )

    const result = await processDueSchedulingReminders({ nowUtc: now })

    expect(result.skipped).toBe(1)
    expect(mocks.dispatch).not.toHaveBeenCalled()
  })
})

describe('recurring Scheduling outbox routing', () => {
  it('reconciles later recurrence materialization signals', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-materialized',
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.materialized',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'series-1',
        payload: {
          seriesId: 'series-1',
          materializedOccurrenceIds: ['occurrence-1'],
        },
        attempts: 1,
        createdAt: now,
      },
    ])
    mocks.eventFindFirst.mockResolvedValue(null)
    mocks.eventFindMany.mockResolvedValue([
      event({
        id: 'occurrence-1',
        recurrenceSeriesId: 'series-1',
        occurrenceOriginalAt: startsAt,
      }),
    ])

    const result = await processSchedulingNotificationOutbox({ nowUtc: now })

    expect(result).toMatchObject({ claimed: 1, processed: 1, failed: 0 })
    expect(mocks.reconcileRecurringJobs).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      topic: 'scheduling.recurrence.materialized',
      payload: {
        seriesId: 'series-1',
        materializedOccurrenceIds: ['occurrence-1'],
      },
    })
    expect(mocks.reconcileRecurringJobLifecycle).toHaveBeenCalledWith({
      outboxEventId: 'outbox-materialized',
      workspaceId: 'workspace-1',
      topic: 'scheduling.recurrence.materialized',
      aggregateId: 'series-1',
      payload: {
        seriesId: 'series-1',
        materializedOccurrenceIds: ['occurrence-1'],
      },
      now,
    })
    expect(mocks.reminderUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          schedulingEventId: 'occurrence-1',
          source: SIMPLE_APPOINTMENT_REMINDER_SOURCE,
        }),
      }),
    )
  })

  it('reconciles only materialized occurrences for a series-level event', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-1',
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence_series.created',
        aggregateType: 'SchedulingRecurrenceSeries',
        aggregateId: 'series-1',
        payload: { seriesId: 'series-1', masterEventId: 'master-1' },
        attempts: 1,
        createdAt: now,
      },
    ])
    mocks.eventFindFirst.mockResolvedValue(null)
    mocks.eventFindMany.mockResolvedValue([
      event({
        id: 'occurrence-1',
        recurrenceSeriesId: 'series-1',
        occurrenceOriginalAt: startsAt,
      }),
      event({
        id: 'occurrence-2',
        recurrenceSeriesId: 'series-1',
        occurrenceOriginalAt: new Date('2026-10-08T14:00:00.000Z'),
        startsAtUtc: new Date('2026-10-08T14:00:00.000Z'),
      }),
    ])

    const result = await processSchedulingNotificationOutbox({ nowUtc: now })

    expect(result).toMatchObject({ claimed: 1, processed: 1, failed: 0 })
    expect(mocks.reminderUpsert).toHaveBeenCalledTimes(2)
    expect(mocks.eventFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recurrenceSeriesId: 'series-1' }),
        take: 500,
      }),
    )
  })

  it('keeps a failed recurring Job materialization retryable under the outbox lease', async () => {
    mocks.queryRaw.mockResolvedValue([
      {
        id: 'outbox-materialized-failure',
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.materialized',
        aggregateType: 'SchedulingEvent',
        aggregateId: 'series-1',
        payload: {
          seriesId: 'series-1',
          materializedOccurrenceIds: ['occurrence-1'],
        },
        attempts: 1,
        createdAt: now,
      },
    ])
    mocks.reconcileRecurringJobs.mockRejectedValueOnce(
      new Error('Job persistence unavailable'),
    )

    const result = await processSchedulingNotificationOutbox({
      nowUtc: now,
      workerId: 'recurring-job-worker',
    })

    expect(result).toMatchObject({ claimed: 1, processed: 0, failed: 1 })
    expect(mocks.outboxUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'outbox-materialized-failure',
          status: 'PROCESSING',
          claimedBy: 'recurring-job-worker',
        },
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    )
  })
})
