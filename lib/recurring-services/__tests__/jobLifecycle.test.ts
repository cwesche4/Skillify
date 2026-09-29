import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import type { JobRecord } from '@/lib/jobs/types'
import {
  createRecurringJobLifecycleService,
  reconcileRecurringJobLifecycleForSchedulingOutbox,
  type RecurringJobLifecycleStore,
} from '@/lib/recurring-services/jobLifecycle'

const NOW = new Date('2026-09-26T15:00:00.000Z')
const START = new Date('2026-10-02T13:00:00.000Z')
const END = new Date('2026-10-02T14:00:00.000Z')

function recurringJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    id: 'job-1',
    workspaceId: 'ws-1',
    title: 'Weekly lawn service',
    description: null,
    notes: null,
    status: 'SCHEDULED',
    priority: 'NORMAL',
    customerReferenceId: null,
    customerId: 'customer-1',
    customerDisplayName: 'Customer',
    serviceLocationSnapshot: null,
    customerContactNameSnapshot: null,
    customerPhoneSnapshot: null,
    customerEmailSnapshot: null,
    valueCents: 6500,
    currency: 'USD',
    scheduledStartAt: START,
    scheduledEndAt: END,
    recurringServiceId: 'service-1',
    schedulingEventId: 'occurrence-1',
    serviceInstructionsSnapshot: null,
    completedAt: null,
    cancellationReason: null,
    cancellationNote: null,
    canceledAt: null,
    unableToCompleteReason: null,
    unableToCompleteNote: null,
    unableToCompleteAt: null,
    unableToCompleteReportedByMemberId: null,
    assigneeMemberId: 'member-1',
    createdByUserId: 'profile-manager',
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    ...overrides,
  }
}

function createMemory() {
  let job = recurringJob()
  const store: RecurringJobLifecycleStore = {
    findJob: vi.fn(async ({ workspaceId, jobId }) =>
      job.workspaceId === workspaceId && job.id === jobId ? job : null,
    ),
    canExecuteJob: vi.fn(
      async ({ workspaceId, jobId, workspaceMemberId }) =>
        job.workspaceId === workspaceId &&
        job.id === jobId &&
        job.assigneeMemberId === workspaceMemberId,
    ),
    markUnableToComplete: vi.fn(async (input) => {
      if (
        job.workspaceId !== input.workspaceId ||
        job.id !== input.jobId ||
        job.status !== input.expectedStatus ||
        (input.executorMemberId &&
          !(await store.canExecuteJob({
            workspaceId: input.workspaceId,
            jobId: input.jobId,
            workspaceMemberId: input.executorMemberId,
          })))
      ) {
        return null
      }
      job = {
        ...job,
        status: 'UNABLE_TO_COMPLETE',
        unableToCompleteReason: input.reason,
        unableToCompleteNote: input.note,
        unableToCompleteAt: input.occurredAt,
        unableToCompleteReportedByMemberId: input.reporterMemberId,
      }
      return job
    }),
    synchronizeOccurrence: vi.fn(async () => 'updated' as const),
    synchronizeSeries: vi.fn(async () => 0),
    synchronizeEndedService: vi.fn(async () => 0),
    completeOccurrenceFromJob: vi.fn(async () => 'completed' as const),
  }
  const cancelOccurrence = vi.fn(async () => undefined)
  const rescheduleOccurrence = vi.fn(async () => undefined)
  const service = createRecurringJobLifecycleService(
    store,
    { cancelOccurrence, rescheduleOccurrence },
    { now: () => NOW },
  )
  return {
    store,
    service,
    cancelOccurrence,
    rescheduleOccurrence,
    getJob: () => job,
    setJob: (next: JobRecord) => {
      job = next
    },
  }
}

const memberActor = {
  workspaceId: 'ws-1',
  userProfileId: 'profile-member',
  workspaceMemberId: 'member-1',
  canManage: false,
}
const managerActor = {
  workspaceId: 'ws-1',
  userProfileId: 'profile-manager',
  workspaceMemberId: 'manager-1',
  canManage: true,
}

describe('Recurring Job lifecycle commands', () => {
  let memory: ReturnType<typeof createMemory>

  beforeEach(() => {
    memory = createMemory()
  })

  it('lets only the directly assigned Member report Unable to Complete with structured metadata', async () => {
    const updated = await memory.service.reportUnableToComplete(
      memberActor,
      'job-1',
      { reason: 'WEATHER', note: 'Lightning nearby.' },
    )

    expect(updated).toMatchObject({
      status: 'UNABLE_TO_COMPLETE',
      unableToCompleteReason: 'WEATHER',
      unableToCompleteNote: 'Lightning nearby.',
      unableToCompleteAt: NOW,
      unableToCompleteReportedByMemberId: 'member-1',
    })
    expect(memory.store.markUnableToComplete).toHaveBeenCalledWith(
      expect.objectContaining({ executorMemberId: 'member-1' }),
    )
    expect(memory.cancelOccurrence).not.toHaveBeenCalled()
    expect(memory.rescheduleOccurrence).not.toHaveBeenCalled()
  })

  it.each([
    ['unassigned', null],
    ['assigned to someone else', 'member-2'],
  ])(
    'denies a Member when the recurring Job is %s',
    async (_label, assignee) => {
      memory.setJob(recurringJob({ assigneeMemberId: assignee }))
      await expect(
        memory.service.reportUnableToComplete(memberActor, 'job-1', {
          reason: 'ACCESS_ISSUE',
        }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    },
  )

  it('allows a current eligible Team member and keeps the atomic execution fence', async () => {
    memory.setJob(recurringJob({ assigneeMemberId: null }))
    vi.mocked(memory.store.canExecuteJob).mockResolvedValue(true)

    await expect(
      memory.service.reportUnableToComplete(memberActor, 'job-1', {
        reason: 'ACCESS_ISSUE',
      }),
    ).resolves.toMatchObject({ status: 'UNABLE_TO_COMPLETE' })
    expect(memory.store.markUnableToComplete).toHaveBeenCalledWith(
      expect.objectContaining({ executorMemberId: 'member-1' }),
    )
  })

  it('allows management to report the exception without changing Scheduling or completing work', async () => {
    memory.setJob(
      recurringJob({ assigneeMemberId: null, status: 'IN_PROGRESS' }),
    )
    const updated = await memory.service.reportUnableToComplete(
      managerActor,
      'job-1',
      { reason: 'EQUIPMENT' },
    )
    expect(updated.status).toBe('UNABLE_TO_COMPLETE')
    expect(memory.cancelOccurrence).not.toHaveBeenCalled()
    expect(memory.rescheduleOccurrence).not.toHaveBeenCalled()
  })

  it('skips exactly one occurrence for management and carries the structured reason into the durable Scheduling signal', async () => {
    await memory.service.skipVisit(managerActor, 'job-1', {
      reason: 'CUSTOMER_REQUEST',
      note: 'Customer is away.',
      idempotencyKey: 'skip-1',
    })

    expect(memory.cancelOccurrence).toHaveBeenCalledWith({
      actor: expect.objectContaining({ canManageScheduling: true }),
      eventId: 'occurrence-1',
      status: 'canceled',
      scope: 'thisOccurrence',
      expectedVersion: undefined,
      idempotencyKey: 'skip-1',
      jobCancellation: {
        reason: 'CUSTOMER_REQUEST',
        note: 'Customer is away.',
      },
    })
    expect(memory.store.synchronizeOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId: 'occurrence-1',
        cancellation: {
          reason: 'CUSTOMER_REQUEST',
          note: 'Customer is away.',
        },
      }),
    )
  })

  it('denies Skip Visit and management resolution to an ordinary Member', async () => {
    await expect(
      memory.service.skipVisit(memberActor, 'job-1', { reason: 'WEATHER' }),
    ).rejects.toMatchObject({ status: 403 })
    memory.setJob(recurringJob({ status: 'UNABLE_TO_COMPLETE' }))
    await expect(
      memory.service.rescheduleUnable(memberActor, 'job-1', {
        startsAt: '2026-10-03T13:00:00.000Z',
        endsAt: '2026-10-03T14:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('reschedules an unable Job only through the authoritative occurrence and then reconciles its snapshot', async () => {
    memory.setJob(
      recurringJob({
        status: 'UNABLE_TO_COMPLETE',
        unableToCompleteReason: 'WEATHER',
        unableToCompleteAt: NOW,
      }),
    )
    await memory.service.rescheduleUnable(managerActor, 'job-1', {
      startsAt: '2026-10-03T13:00:00.000Z',
      endsAt: '2026-10-03T14:00:00.000Z',
      idempotencyKey: 'reschedule-1',
    })

    expect(memory.rescheduleOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'occurrence-1',
        scope: 'thisOccurrence',
        input: {
          startsAt: '2026-10-03T13:00:00.000Z',
          endsAt: '2026-10-03T14:00:00.000Z',
        },
      }),
    )
    expect(memory.store.synchronizeOccurrence).toHaveBeenCalledOnce()
  })
})

describe('Recurring Job lifecycle outbox routing', () => {
  function mockStore(): RecurringJobLifecycleStore {
    return {
      findJob: vi.fn(),
      canExecuteJob: vi.fn(async () => false),
      markUnableToComplete: vi.fn(),
      synchronizeOccurrence: vi.fn(async () => 'updated' as const),
      synchronizeSeries: vi.fn(async () => 2),
      synchronizeEndedService: vi.fn(async () => 3),
      completeOccurrenceFromJob: vi.fn(async () => 'completed' as const),
    }
  }

  it('replays occurrence reschedules and cancellations against authoritative state with structured reasons', async () => {
    const store = mockStore()
    await reconcileRecurringJobLifecycleForSchedulingOutbox(
      {
        outboxEventId: 'outbox-1',
        workspaceId: 'ws-1',
        topic: 'scheduling.recurrence.occurrence_canceled',
        aggregateId: 'occurrence-1',
        payload: {
          occurrenceId: 'occurrence-1',
          jobCancellation: { reason: 'HOLIDAY', note: 'Office closed.' },
        },
        now: NOW,
      },
      store,
    )
    expect(store.synchronizeOccurrence).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      occurrenceId: 'occurrence-1',
      cancellation: { reason: 'HOLIDAY', note: 'Office closed.' },
      now: NOW,
    })

    await reconcileRecurringJobLifecycleForSchedulingOutbox(
      {
        outboxEventId: 'outbox-2',
        workspaceId: 'ws-1',
        topic: 'scheduling.event.updated',
        aggregateId: 'occurrence-1',
        payload: { eventId: 'occurrence-1' },
        now: NOW,
      },
      store,
    )
    expect(store.synchronizeOccurrence).toHaveBeenCalledTimes(2)
  })

  it('routes series end, pause, and split without treating pause as cancellation', async () => {
    const store = mockStore()
    await reconcileRecurringJobLifecycleForSchedulingOutbox(
      {
        outboxEventId: 'outbox-end',
        workspaceId: 'ws-1',
        topic: 'scheduling.recurrence_series.canceled',
        aggregateId: 'series-1',
        payload: { seriesId: 'series-1' },
      },
      store,
    )
    expect(store.synchronizeEndedService).toHaveBeenCalledWith(
      expect.objectContaining({ seriesId: 'series-1' }),
    )

    await reconcileRecurringJobLifecycleForSchedulingOutbox(
      {
        outboxEventId: 'outbox-pause',
        workspaceId: 'ws-1',
        topic: 'scheduling.recurrence_series.paused',
        aggregateId: 'series-1',
        payload: { seriesId: 'series-1' },
      },
      store,
    )
    expect(store.synchronizeSeries).not.toHaveBeenCalled()

    await reconcileRecurringJobLifecycleForSchedulingOutbox(
      {
        outboxEventId: 'outbox-split',
        workspaceId: 'ws-1',
        topic: 'scheduling.recurrence.series_split',
        aggregateId: 'series-2',
        payload: { originalSeriesId: 'series-1', newSeriesId: 'series-2' },
      },
      store,
    )
    expect(store.synchronizeSeries).toHaveBeenCalledTimes(2)
  })

  it('uses the durable completion occurrence to synchronize Scheduling idempotently', async () => {
    const store = mockStore()
    await reconcileRecurringJobLifecycleForSchedulingOutbox(
      {
        outboxEventId: 'outbox-complete',
        workspaceId: 'ws-1',
        topic: 'scheduling.recurring_job.completed',
        aggregateId: 'job-1',
        payload: {
          jobId: 'job-1',
          completedAt: NOW.toISOString(),
          actorUserId: 'profile-member',
        },
      },
      store,
    )
    expect(store.completeOccurrenceFromJob).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      jobId: 'job-1',
      completedAt: NOW,
      actorUserId: 'profile-member',
      sourceOutboxEventId: 'outbox-complete',
    })
  })
})
