import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { prismaCustomerStore } from '@/lib/customers/prismaStore'

describe('Customer archive Recurring Service guard', () => {
  beforeEach(() => vi.clearAllMocks())

  it('serializes on the Customer and blocks archive while an active service exists', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: 'customer-a' }]),
      recurringService: {
        findFirst: vi.fn(async () => ({ id: 'service-a' })),
      },
      customer: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findFirst: vi.fn(),
      },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(
      prismaCustomerStore.archiveCustomer({
        workspaceId: 'workspace-a',
        customerId: 'customer-a',
        archivedAt: new Date('2026-09-27T12:00:00.000Z'),
      }),
    ).resolves.toEqual({ blockedByActiveRecurringService: true })
    expect(tx.$queryRaw).toHaveBeenCalledOnce()
    expect(tx.customer.updateMany).not.toHaveBeenCalled()
  })
})
