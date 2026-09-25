import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  updateMany: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    domainOutboxEvent: {
      updateMany: mocks.updateMany,
      findUnique: mocks.findUnique,
      findMany: mocks.findMany,
    },
  },
}))

import { defaultDomainEventProcessorDependencies } from '@/lib/domain-events/processor'

const NOW = new Date('2026-09-23T18:00:00.000Z')

describe('persisted native event lease fencing', () => {
  beforeEach(() => {
    mocks.updateMany.mockReset()
    mocks.findUnique.mockReset()
    mocks.findMany.mockReset()
  })

  it('allows exactly one worker to claim a pending event', async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    mocks.findUnique.mockResolvedValue({
      id: 'event-a',
      workspaceId: 'workspace-a',
      topic: 'lead.created',
      aggregateType: 'Lead',
      aggregateId: 'lead-a',
      payload: {},
      attempts: 1,
      claimedBy: 'worker-a',
    })

    // The database serializes the competing conditional UPDATEs; model the
    // winning and losing results without racing Vitest's dynamic module loader.
    const workerA = await defaultDomainEventProcessorDependencies.claim({
      eventId: 'event-a',
      workerId: 'worker-a',
      now: NOW,
    })
    const workerB = await defaultDomainEventProcessorDependencies.claim({
      eventId: 'event-a',
      workerId: 'worker-b',
      now: NOW,
    })

    expect(workerA).toMatchObject({ id: 'event-a', claimedBy: 'worker-a' })
    expect(workerB).toBeNull()
  })

  it('prevents a stale worker from finalizing a reclaimed event', async () => {
    mocks.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await expect(
      defaultDomainEventProcessorDependencies.complete({
        eventId: 'event-a',
        workerId: 'worker-a',
        now: NOW,
        outcome: 'DISPATCHED',
      }),
    ).rejects.toThrow('Native event processing lease was lost.')
    await expect(
      defaultDomainEventProcessorDependencies.complete({
        eventId: 'event-a',
        workerId: 'worker-b',
        now: NOW,
        outcome: 'DISPATCHED',
      }),
    ).resolves.toBeUndefined()

    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ claimedBy: 'worker-a' }),
      }),
    )
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ claimedBy: 'worker-b' }),
      }),
    )
  })

  it('selects only supported automation-ingress topics and leaves scheduling partitioned', async () => {
    mocks.findMany.mockResolvedValue([])

    await defaultDomainEventProcessorDependencies.listPendingIds({
      now: NOW,
      limit: 25,
    })

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          availableAt: { lte: NOW },
          AND: expect.arrayContaining([
            {
              OR: [
                {
                  topic: { in: ['lead.created', 'lead.follow_up_due'] },
                  aggregateType: 'Lead',
                },
                { topic: 'job.completed', aggregateType: 'Job' },
                {
                  topic: 'integration.hubspot.webhook',
                  aggregateType: 'HubSpotIntegration',
                },
              ],
            },
          ]),
        }),
      }),
    )
  })

  it('backs off retryable failures and deterministically dead-letters attempt five', async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 })
    const baseEvent = {
      id: 'event-a',
      workspaceId: 'workspace-a',
      topic: 'lead.created',
      aggregateType: 'Lead',
      aggregateId: 'lead-a',
      payload: {},
      claimedBy: 'worker-a',
    }

    await defaultDomainEventProcessorDependencies.fail({
      event: { ...baseEvent, attempts: 1 },
      now: NOW,
      error: new Error('temporary'),
    })
    await defaultDomainEventProcessorDependencies.fail({
      event: { ...baseEvent, attempts: 5 },
      now: NOW,
      error: new Error('permanent'),
    })

    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          nextAttemptAt: new Date(NOW.getTime() + 30_000),
          processingOutcome: 'RETRY_PENDING',
        }),
      }),
    )
    expect(mocks.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DEAD',
          nextAttemptAt: null,
          processingOutcome: 'FAILED_PERMANENTLY',
        }),
      }),
    )
  })
})
