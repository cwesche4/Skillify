import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  serviceFindFirst: vi.fn(),
  jobUpdateMany: vi.fn(),
  jobFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
    recurringService: { findFirst: mocks.serviceFindFirst },
    job: {
      updateMany: mocks.jobUpdateMany,
      findMany: mocks.jobFindMany,
    },
  },
}))

import { prismaRecurringJobLifecycleStore } from '@/lib/recurring-services/jobLifecycle'

const NOW = new Date('2026-09-26T16:00:00.000Z')
const START = new Date('2026-10-05T13:00:00.000Z')
const END = new Date('2026-10-05T14:00:00.000Z')
const MOVED_START = new Date('2026-10-06T15:00:00.000Z')
const MOVED_END = new Date('2026-10-06T16:00:00.000Z')

function transaction(input: {
  jobStatus?: string
  eventStatus?: string
  occurrenceState?: string
  deletedAt?: Date | null
  completedAt?: Date | null
  eventStart?: Date
  eventEnd?: Date
  jobAssignments?: Array<Record<string, unknown>>
  eventAssignments?: Array<Record<string, unknown>>
  members?: Array<{ id: string }>
  teams?: Array<{ id: string; name: string }>
}) {
  const job = {
    id: 'job-1',
    schedulingEventId: 'occurrence-1',
    status: input.jobStatus ?? 'SCHEDULED',
    scheduledStartAt: START,
    scheduledEndAt: END,
    assignments: input.jobAssignments ?? [],
  }
  const event = {
    id: 'occurrence-1',
    status: input.eventStatus ?? 'SCHEDULED',
    occurrenceState: input.occurrenceState ?? 'OVERRIDDEN',
    recurrenceSeriesId: 'series-1',
    startsAtUtc: input.eventStart ?? START,
    endsAtUtc: input.eventEnd ?? END,
    canceledAt: null,
    completedAt: input.completedAt ?? null,
    deletedAt: input.deletedAt ?? null,
    assignments: input.eventAssignments ?? [],
  }
  return {
    $queryRaw: vi.fn(async () => [{ id: 'locked' }]),
    job: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({ id: 'job-1' })
        .mockResolvedValueOnce(job),
      update: vi.fn(async () => job),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    schedulingEvent: {
      findFirst: vi.fn(async () => event),
      update: vi.fn(async () => event),
    },
    workspaceMember: {
      findMany: vi.fn(async () => input.members ?? []),
    },
    workspaceTeam: { findMany: vi.fn(async () => input.teams ?? []) },
    jobAssignment: {
      deleteMany: vi.fn(async () => ({ count: 0 })),
      createMany: vi.fn(async () => ({ count: 0 })),
    },
    schedulingEventActivity: { create: vi.fn(async () => ({})) },
    domainOutboxEvent: { create: vi.fn(async () => ({ id: 'outbox-next' })) },
  }
}

describe('Recurring Job lifecycle Prisma synchronization', () => {
  beforeEach(() => vi.clearAllMocks())

  it('fails a management unable transition when Scheduling already finalized the occurrence', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: 'occurrence-1' }]),
      job: {
        findFirst: vi.fn(async () => ({
          id: 'job-1',
          schedulingEventId: 'occurrence-1',
        })),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      schedulingEvent: { findFirst: vi.fn(async () => null) },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringJobLifecycleStore.markUnableToComplete({
        workspaceId: 'ws-1',
        jobId: 'job-1',
        expectedStatus: 'IN_PROGRESS',
        reporterMemberId: 'member-manager',
        reason: 'WEATHER',
        note: null,
        executorMemberId: undefined,
        occurredAt: NOW,
      }),
    ).resolves.toBeNull()
    expect(tx.job.updateMany).not.toHaveBeenCalled()
  })

  it('updates the schedule snapshot and resolves an unable Job only after Scheduling moved the occurrence', async () => {
    const tx = transaction({
      jobStatus: 'UNABLE_TO_COMPLETE',
      eventStart: MOVED_START,
      eventEnd: MOVED_END,
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const first = await prismaRecurringJobLifecycleStore.synchronizeOccurrence({
      workspaceId: 'ws-1',
      occurrenceId: 'occurrence-1',
      cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
      now: NOW,
    })
    expect(first).toBe('updated')
    expect(tx.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        scheduledStartAt: MOVED_START,
        scheduledEndAt: MOVED_END,
        status: 'SCHEDULED',
      },
    })
  })

  it('makes occurrence schedule replay harmless and never rewrites completed Job history', async () => {
    const replayTx = transaction({})
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback(replayTx),
    )
    expect(
      await prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'occurrence-1',
        cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
        now: NOW,
      }),
    ).toBe('unchanged')
    expect(replayTx.job.update).not.toHaveBeenCalled()

    const completedTx = transaction({
      jobStatus: 'COMPLETED',
      eventStart: MOVED_START,
      eventEnd: MOVED_END,
    })
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback(completedTx),
    )
    expect(
      await prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'occurrence-1',
        cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
        now: NOW,
      }),
    ).toBe('protected')
    expect(completedTx.job.update).not.toHaveBeenCalled()
  })

  it('idempotently replaces nonterminal Job assignments from authoritative Scheduling principals', async () => {
    const tx = transaction({
      jobAssignments: [
        {
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-old',
          teamId: null,
          roleLabel: null,
          displaySnapshot: 'Old worker',
        },
      ],
      eventAssignments: [
        {
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-new',
          teamId: null,
          roleLabel: 'Lead',
          displaySnapshot: 'New worker',
        },
        {
          assignmentType: 'TEAM',
          workspaceMemberId: null,
          teamId: 'team-1',
          roleLabel: null,
          displaySnapshot: null,
        },
      ],
      members: [{ id: 'member-new' }],
      teams: [{ id: 'team-1', name: 'Crew One' }],
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'occurrence-1',
        cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
        now: NOW,
      }),
    ).resolves.toBe('updated')
    expect(tx.jobAssignment.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'ws-1', jobId: 'job-1' },
    })
    expect(tx.jobAssignment.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          workspaceId: 'ws-1',
          jobId: 'job-1',
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-new',
        }),
        expect.objectContaining({
          workspaceId: 'ws-1',
          jobId: 'job-1',
          assignmentType: 'TEAM',
          teamId: 'team-1',
          displaySnapshot: 'Crew One',
        }),
      ]),
      skipDuplicates: true,
    })
    expect(tx.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { assigneeMemberId: null },
    })
  })

  it('protects completed assignment history from later Scheduling reassignment', async () => {
    const tx = transaction({
      jobStatus: 'COMPLETED',
      eventAssignments: [
        {
          assignmentType: 'TEAM',
          workspaceMemberId: null,
          teamId: 'team-new',
          roleLabel: null,
          displaySnapshot: 'New Crew',
        },
      ],
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'occurrence-1',
        cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
        now: NOW,
      }),
    ).resolves.toBe('protected')
    expect(tx.jobAssignment.deleteMany).not.toHaveBeenCalled()
    expect(tx.jobAssignment.createMany).not.toHaveBeenCalled()
  })

  it('ignores occurrences without a linked recurring Job', async () => {
    const tx = transaction({})
    tx.job.findFirst = vi.fn(async () => null)
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    expect(
      await prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'manual-event',
        cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
        now: NOW,
      }),
    ).toBe('missing')
    expect(tx.$queryRaw).not.toHaveBeenCalled()
    expect(tx.job.update).not.toHaveBeenCalled()
  })

  it('cancels a nonterminal linked Job with structured metadata but protects completed history', async () => {
    const canceledTx = transaction({
      eventStatus: 'CANCELED',
      occurrenceState: 'CANCELED',
    })
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback(canceledTx),
    )
    expect(
      await prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'occurrence-1',
        cancellation: { reason: 'WEATHER', note: 'Unsafe conditions.' },
        now: NOW,
      }),
    ).toBe('updated')
    expect(canceledTx.job.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: 'CANCELED',
        cancellationReason: 'WEATHER',
        cancellationNote: 'Unsafe conditions.',
        canceledAt: NOW,
      },
    })

    const completedTx = transaction({
      jobStatus: 'COMPLETED',
      eventStatus: 'CANCELED',
      occurrenceState: 'CANCELED',
    })
    mocks.transaction.mockImplementationOnce(async (callback) =>
      callback(completedTx),
    )
    expect(
      await prismaRecurringJobLifecycleStore.synchronizeOccurrence({
        workspaceId: 'ws-1',
        occurrenceId: 'occurrence-1',
        cancellation: { reason: 'SCHEDULE_CANCELED', note: null },
        now: NOW,
      }),
    ).toBe('protected')
    expect(completedTx.job.update).not.toHaveBeenCalled()
  })

  it('completes the occurrence from current authoritative Job state and emits one Scheduling event', async () => {
    const tx = transaction({ jobStatus: 'COMPLETED' })
    tx.job.findFirst = vi.fn(async () => ({
      status: 'COMPLETED',
      completedAt: NOW,
      schedulingEventId: 'occurrence-1',
    }))
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result =
      await prismaRecurringJobLifecycleStore.completeOccurrenceFromJob({
        workspaceId: 'ws-1',
        jobId: 'job-1',
        completedAt: NOW,
        actorUserId: 'profile-member',
        sourceOutboxEventId: 'source-outbox-1',
      })

    expect(result).toBe('completed')
    expect(tx.schedulingEvent.update).toHaveBeenCalledWith({
      where: { id: 'occurrence-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        occurrenceState: 'COMPLETED',
        completedAt: NOW,
        canceledAt: null,
        deletedAt: null,
      }),
    })
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: 'scheduling.event.completed',
        deduplicationKey: 'scheduling:job-completion-sync:source-outbox-1',
      }),
    })
  })

  it('treats completion replay as already completed without duplicating outbox work', async () => {
    const tx = transaction({
      jobStatus: 'COMPLETED',
      eventStatus: 'COMPLETED',
      completedAt: NOW,
    })
    tx.job.findFirst = vi.fn(async () => ({
      status: 'COMPLETED',
      completedAt: NOW,
      schedulingEventId: 'occurrence-1',
    }))
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    expect(
      await prismaRecurringJobLifecycleStore.completeOccurrenceFromJob({
        workspaceId: 'ws-1',
        jobId: 'job-1',
        completedAt: NOW,
        actorUserId: 'profile-member',
        sourceOutboxEventId: 'source-outbox-replay',
      }),
    ).toBe('already-completed')
    expect(tx.schedulingEvent.update).not.toHaveBeenCalled()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('does not resurrect a canceled occurrence from a stale completion signal', async () => {
    const tx = transaction({
      jobStatus: 'COMPLETED',
      eventStatus: 'CANCELED',
      occurrenceState: 'CANCELED',
    })
    tx.job.findFirst = vi.fn(async () => ({
      status: 'COMPLETED',
      completedAt: NOW,
      schedulingEventId: 'occurrence-1',
    }))
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringJobLifecycleStore.completeOccurrenceFromJob({
        workspaceId: 'ws-1',
        jobId: 'job-1',
        completedAt: NOW,
        actorUserId: 'profile-member',
        sourceOutboxEventId: 'stale-completion',
      }),
    ).resolves.toBe('stale')
    expect(tx.schedulingEvent.update).not.toHaveBeenCalled()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('cancels only future nonterminal Jobs when the linked service ends', async () => {
    mocks.serviceFindFirst.mockResolvedValue({ id: 'service-1', endedAt: NOW })
    mocks.jobUpdateMany.mockResolvedValue({ count: 3 })

    const count =
      await prismaRecurringJobLifecycleStore.synchronizeEndedService({
        workspaceId: 'ws-1',
        seriesId: 'series-1',
        now: NOW,
      })

    expect(count).toBe(3)
    expect(mocks.jobUpdateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws-1',
        recurringServiceId: 'service-1',
        archivedAt: null,
        status: {
          in: [
            'OPEN',
            'SCHEDULED',
            'IN_PROGRESS',
            'WAITING_ON_CLIENT',
            'UNABLE_TO_COMPLETE',
          ],
        },
        scheduledStartAt: { gte: NOW },
      },
      data: {
        status: 'CANCELED',
        cancellationReason: 'SERVICE_ENDED',
        cancellationNote: null,
        canceledAt: NOW,
      },
    })
  })
})
