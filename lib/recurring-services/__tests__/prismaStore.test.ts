import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { prismaRecurringServiceStore } from '@/lib/recurring-services/prismaStore'

const createData = {
  workspaceId: 'workspace-1',
  customerId: 'customer-1',
  recurrenceSeriesId: 'series-1',
  name: 'Weekly Lawn Maintenance',
  description: null,
  serviceInstructions: 'Close the rear gate.',
  pricePerVisitCents: 6500,
  currency: 'USD',
  defaultJobPriority: 'NORMAL' as const,
  status: 'ACTIVE' as const,
  createdByUserId: 'profile-1',
  stepTemplates: [],
}

function transaction(outboxError?: Error) {
  return {
    $queryRaw: vi
      .fn()
      .mockResolvedValueOnce([{ id: 'customer-1' }])
      .mockResolvedValueOnce([
        {
          id: 'series-1',
          status: 'ACTIVE',
          eventTypeKey: 'recurringServiceVisit',
        },
      ]),
    recurringService: {
      findFirst: vi.fn(async () => null),
      create: vi.fn(async () => ({
        id: 'service-1',
        ...createData,
        endedAt: null,
        createdAt: new Date('2026-09-26T12:00:00.000Z'),
        updatedAt: new Date('2026-09-26T12:00:00.000Z'),
        stepTemplates: [],
      })),
    },
    domainOutboxEvent: {
      create: vi.fn(async () => {
        if (outboxError) throw outboxError
        return { id: 'outbox-1' }
      }),
    },
  }
}

describe('Recurring Service link-time reconciliation outbox', () => {
  beforeEach(() => vi.clearAllMocks())

  it('commits the service and bounded reconciliation signal in one transaction', async () => {
    const tx = transaction()
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const created =
      await prismaRecurringServiceStore.createRecurringService(createData)

    expect(created.id).toBe('service-1')
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: {
        workspaceId: 'workspace-1',
        topic: 'scheduling.recurrence.materialized',
        aggregateType: 'SchedulingRecurrenceSeries',
        aggregateId: 'series-1',
        deduplicationKey: 'recurring-service:reconcile:service-1',
        payload: {
          seriesId: 'series-1',
          recurringServiceId: 'service-1',
          recurringServiceReconciliation: true,
        },
      },
    })
  })

  it('lets the parent relation supply composite keys for nested step templates', async () => {
    const tx = transaction()
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await prismaRecurringServiceStore.createRecurringService({
      ...createData,
      stepTemplates: [
        {
          title: 'Complete service checklist',
          description: 'Record the result.',
          sortOrder: 0,
        },
      ],
    })

    expect(tx.recurringService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stepTemplates: {
            create: [
              {
                title: 'Complete service checklist',
                description: 'Record the result.',
                sortOrder: 0,
              },
            ],
          },
        }),
      }),
    )
  })

  it('does not allow service creation to succeed without its recovery signal', async () => {
    const tx = transaction(new Error('outbox unavailable'))
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaRecurringServiceStore.createRecurringService(createData),
    ).rejects.toThrow('outbox unavailable')
    expect(tx.recurringService.create).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledOnce()
  })
})
