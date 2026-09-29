import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { prismaJobsStore } from '@/lib/jobs/prismaStore'
import { JobStatus, OperationsPriority } from '@/lib/prisma/enums'

const COMPLETED_AT = new Date('2026-09-23T18:00:00.000Z')

function completedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-a',
    workspaceId: 'workspace-a',
    title: 'Spring Cleanup',
    description: null,
    notes: null,
    status: JobStatus.COMPLETED,
    priority: OperationsPriority.NORMAL,
    customerReferenceId: 'opaque-legacy-reference',
    customerId: 'customer-a',
    customerDisplayName: 'Ramirez Landscaping',
    valueCents: null,
    currency: 'USD',
    scheduledStartAt: null,
    scheduledEndAt: null,
    recurringServiceId: null,
    schedulingEventId: null,
    serviceInstructionsSnapshot: null,
    cancellationReason: null,
    cancellationNote: null,
    canceledAt: null,
    unableToCompleteReason: null,
    unableToCompleteNote: null,
    unableToCompleteAt: null,
    unableToCompleteReportedByMemberId: null,
    completedAt: COMPLETED_AT,
    assigneeMemberId: 'member-a',
    createdByUserId: 'profile-a',
    createdAt: new Date('2026-09-22T18:00:00.000Z'),
    updatedAt: COMPLETED_AT,
    archivedAt: null,
    ...overrides,
  }
}

function transaction(overrides: Record<string, unknown> = {}) {
  return {
    $queryRaw: vi.fn(async () => [{ id: 'job-a' }]),
    job: {
      updateMany: vi.fn(async () => ({ count: 1 })),
      findFirst: vi.fn(async () => completedJob()),
    },
    schedulingEvent: {
      findFirst: vi.fn(async () => ({ id: 'occurrence-a' })),
    },
    simpleAutomationInstallation: {
      findFirst: vi.fn(async () => ({ id: 'installation-a' })),
    },
    domainOutboxEvent: {
      updateMany: vi.fn(async () => ({ count: 0 })),
      create: vi.fn(async () => ({ id: 'event-a' })),
    },
    ...overrides,
  }
}

describe('Prisma Job completion transactional outbox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes one immutable job.completed occurrence in the guarded transition transaction', async () => {
    const tx = transaction()
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaJobsStore.updateJob({
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      expectedStatus: JobStatus.IN_PROGRESS,
      data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
    })

    expect(result).toMatchObject({
      job: { id: 'job-a', status: JobStatus.COMPLETED },
      completionEventId: 'event-a',
    })
    expect(tx.job.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'workspace-a',
          id: 'job-a',
          status: JobStatus.IN_PROGRESS,
        }),
      }),
    )
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-a',
        topic: 'job.completed',
        aggregateType: 'Job',
        aggregateId: 'job-a',
        deduplicationKey: expect.stringMatching(
          /^native:job\.completed:workspace-a:job-a:/,
        ),
        payload: expect.objectContaining({
          source: 'skillify-native',
          workspaceId: 'workspace-a',
          jobId: 'job-a',
          title: 'Spring Cleanup',
          customerId: 'customer-a',
          customerDisplayName: 'Ramirez Landscaping',
          assignedMemberId: 'member-a',
          completedAt: COMPLETED_AT.toISOString(),
          completionRevision: expect.any(String),
        }),
      }),
      select: { id: true },
    })
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            customerReferenceId: expect.anything(),
          }),
        }),
      }),
    )
  })

  it('rolls the completion mutation back when event insertion fails', async () => {
    const tx = transaction({
      domainOutboxEvent: {
        updateMany: vi.fn(async () => ({ count: 0 })),
        create: vi.fn(async () => {
          throw new Error('outbox unavailable')
        }),
      },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaJobsStore.updateJob({
        workspaceId: 'workspace-a',
        jobId: 'job-a',
        expectedStatus: JobStatus.OPEN,
        data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
      }),
    ).rejects.toThrow('outbox unavailable')
    expect(tx.job.updateMany).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledOnce()
  })

  it.each([
    ['already completed', JobStatus.COMPLETED, JobStatus.COMPLETED],
    ['ordinary edit', undefined, undefined],
    ['reopen', JobStatus.COMPLETED, JobStatus.IN_PROGRESS],
  ])('does not emit for %s', async (_label, expectedStatus, nextStatus) => {
    const tx = transaction({
      job: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirst: vi.fn(async () =>
          nextStatus === JobStatus.IN_PROGRESS
            ? completedJob({
                status: JobStatus.IN_PROGRESS,
                completedAt: null,
              })
            : completedJob(),
        ),
      },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaJobsStore.updateJob({
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      expectedStatus,
      data: nextStatus ? { status: nextStatus } : { title: 'Updated title' },
    })

    expect(result?.completionEventId).toBeNull()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('does not create surprise work when the V2 installation is not active', async () => {
    const tx = transaction({
      simpleAutomationInstallation: { findFirst: vi.fn(async () => null) },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaJobsStore.updateJob({
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      expectedStatus: JobStatus.OPEN,
      data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
    })

    expect(result?.completionEventId).toBeNull()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('always writes a durable Scheduling completion signal for a linked recurring Job even without an automation installation', async () => {
    const tx = transaction({
      job: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirst: vi.fn(async () =>
          completedJob({
            recurringServiceId: 'service-a',
            schedulingEventId: 'occurrence-a',
          }),
        ),
      },
      simpleAutomationInstallation: { findFirst: vi.fn(async () => null) },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaJobsStore.updateJob({
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      actorUserId: 'profile-manager',
      expectedStatus: JobStatus.IN_PROGRESS,
      data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
    })

    expect(result?.completionEventId).toBeNull()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        topic: 'scheduling.recurring_job.completed',
        aggregateType: 'Job',
        aggregateId: 'job-a',
        payload: expect.objectContaining({
          schedulingEventId: 'occurrence-a',
          actorUserId: 'profile-manager',
          completedAt: COMPLETED_AT.toISOString(),
        }),
      }),
    })
  })

  it('fails the recurring completion transition when Scheduling already finalized the occurrence', async () => {
    const tx = transaction({
      job: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirst: vi.fn(async () =>
          completedJob({
            recurringServiceId: 'service-a',
            schedulingEventId: 'occurrence-a',
          }),
        ),
      },
      schedulingEvent: { findFirst: vi.fn(async () => null) },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaJobsStore.updateJob({
        workspaceId: 'workspace-a',
        jobId: 'job-a',
        actorUserId: 'profile-member',
        expectedStatus: JobStatus.IN_PROGRESS,
        data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
      }),
    ).resolves.toBeNull()
    expect(tx.job.updateMany).not.toHaveBeenCalled()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('fails a recurring management start when Scheduling already finalized the occurrence', async () => {
    const tx = transaction({
      job: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirst: vi.fn(async () =>
          completedJob({
            status: JobStatus.SCHEDULED,
            completedAt: null,
            recurringServiceId: 'service-a',
            schedulingEventId: 'occurrence-a',
          }),
        ),
      },
      schedulingEvent: { findFirst: vi.fn(async () => null) },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaJobsStore.updateJob({
        workspaceId: 'workspace-a',
        jobId: 'job-a',
        actorUserId: 'profile-manager',
        expectedStatus: JobStatus.SCHEDULED,
        data: { status: JobStatus.IN_PROGRESS },
      }),
    ).resolves.toBeNull()
    expect(tx.job.updateMany).not.toHaveBeenCalled()
  })

  it('uses distinct revisions for separate legitimate completion occurrences', async () => {
    const revisions: string[] = []
    for (const eventId of ['event-a', 'event-b']) {
      const tx = transaction({
        domainOutboxEvent: {
          updateMany: vi.fn(async () => ({ count: 0 })),
          create: vi.fn(async ({ data }) => {
            revisions.push(data.payload.completionRevision)
            return { id: eventId }
          }),
        },
      })
      mocks.transaction.mockImplementationOnce(async (callback) => callback(tx))
      await prismaJobsStore.updateJob({
        workspaceId: 'workspace-a',
        jobId: 'job-a',
        expectedStatus: JobStatus.IN_PROGRESS,
        data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
      })
    }

    expect(revisions).toHaveLength(2)
    expect(revisions[0]).not.toBe(revisions[1])
  })

  it('supersedes older pending and in-flight occurrences before creating a recompletion', async () => {
    const tx = transaction()
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await prismaJobsStore.updateJob({
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      expectedStatus: JobStatus.IN_PROGRESS,
      data: { status: JobStatus.COMPLETED, completedAt: COMPLETED_AT },
    })

    expect(tx.domainOutboxEvent.updateMany).toHaveBeenNthCalledWith(1, {
      where: expect.objectContaining({
        aggregateId: 'job-a',
        status: { in: ['PENDING', 'FAILED'] },
      }),
      data: expect.objectContaining({
        status: 'PROCESSED',
        processingOutcome: 'NO_OP_SUPERSEDED_BY_RECOMPLETION',
      }),
    })
    expect(tx.domainOutboxEvent.updateMany).toHaveBeenNthCalledWith(2, {
      where: expect.objectContaining({
        aggregateId: 'job-a',
        status: 'PROCESSING',
      }),
      data: { processingOutcome: 'SUPERSEDED_BY_RECOMPLETION' },
    })
  })
})

describe('Prisma manual Job assignment replacement', () => {
  beforeEach(() => vi.clearAllMocks())

  function assignmentTransaction(overrides: Record<string, unknown> = {}) {
    const jobAssignment = {
      deleteMany: vi.fn(async () => ({ count: 1 })),
      createMany: vi.fn(async () => ({ count: 2 })),
    }
    return {
      tx: transaction({
        workspaceMember: {
          findMany: vi.fn(async () => [
            {
              id: 'member-a',
              user: { fullName: 'Alex Rivera', email: 'alex@example.com' },
            },
          ]),
        },
        workspaceTeam: {
          findMany: vi.fn(async () => [{ id: 'team-a', name: 'Crew One' }]),
        },
        jobAssignment,
        ...overrides,
      }),
      jobAssignment,
    }
  }

  it('revalidates and atomically replaces mixed MEMBER/TEAM assignments after locking the Job', async () => {
    const { tx, jobAssignment } = assignmentTransaction()
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaJobsStore.updateJob({
      workspaceId: 'workspace-a',
      jobId: 'job-a',
      data: { title: 'Updated title', assigneeMemberId: null },
      assignments: [
        { assignmentType: 'MEMBER', workspaceMemberId: 'member-a' },
        { assignmentType: 'TEAM', teamId: 'team-a' },
      ],
    })

    expect(result?.job.id).toBe('job-a')
    expect(tx.job.updateMany).toHaveBeenCalledOnce()
    expect(jobAssignment.deleteMany).toHaveBeenCalledWith({
      where: { workspaceId: 'workspace-a', jobId: 'job-a' },
    })
    expect(jobAssignment.createMany).toHaveBeenCalledWith({
      data: [
        {
          workspaceId: 'workspace-a',
          jobId: 'job-a',
          assignmentType: 'MEMBER',
          workspaceMemberId: 'member-a',
          teamId: null,
          roleLabel: null,
          displaySnapshot: 'Alex Rivera',
        },
        {
          workspaceId: 'workspace-a',
          jobId: 'job-a',
          assignmentType: 'TEAM',
          workspaceMemberId: null,
          teamId: 'team-a',
          roleLabel: null,
          displaySnapshot: 'Crew One',
        },
      ],
    })
  })

  it('fails closed before mutation when a target disappears during transactional revalidation', async () => {
    const { tx, jobAssignment } = assignmentTransaction({
      workspaceMember: { findMany: vi.fn(async () => []) },
    })
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaJobsStore.updateJob({
        workspaceId: 'workspace-a',
        jobId: 'job-a',
        data: { title: 'Unsafe update' },
        assignments: [
          { assignmentType: 'MEMBER', workspaceMemberId: 'member-a' },
        ],
      }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR', status: 400 })
    expect(tx.job.updateMany).not.toHaveBeenCalled()
    expect(jobAssignment.deleteMany).not.toHaveBeenCalled()
  })
})
