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
