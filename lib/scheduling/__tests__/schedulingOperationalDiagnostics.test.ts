import { DomainOutboxStatus, SchedulingReminderStatus } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  domainOutboxEvent: {
    count: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  schedulingReminderSchedule: {
    count: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  schedulingNotificationDelivery: {
    count: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  $transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMocks }))

import {
  getSchedulingNotificationWorkerDiagnostics,
  recoverSchedulingNotificationWorkerLeases,
} from '@/lib/scheduling/notifications/notificationService'

const NOW = new Date('2026-09-24T16:00:00.000Z')

describe('Scheduling operational diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('SCHEDULING_NOTIFICATIONS_ENABLED', 'true')
    prismaMocks.domainOutboxEvent.count.mockImplementation(
      async ({ where }) => {
        if (where.leaseExpiresAt) return 1
        if (where.status === DomainOutboxStatus.PENDING) return 4
        if (where.status === DomainOutboxStatus.PROCESSING) return 2
        if (where.status === DomainOutboxStatus.FAILED) return 3
        if (where.status === DomainOutboxStatus.DEAD) return 5
        return 0
      },
    )
    prismaMocks.schedulingReminderSchedule.count.mockImplementation(
      async ({ where }) => {
        if (where.leaseExpiresAt) return 1
        if (where.status === SchedulingReminderStatus.SCHEDULED) {
          return where.scheduledForUtc ? 6 : 8
        }
        if (where.status === SchedulingReminderStatus.PROCESSING) return 2
        if (where.status === SchedulingReminderStatus.FAILED) return 3
        if (where.status === SchedulingReminderStatus.PERMANENTLY_FAILED)
          return 4
        return 0
      },
    )
    prismaMocks.schedulingNotificationDelivery.count.mockResolvedValue(1)
    prismaMocks.domainOutboxEvent.findFirst
      .mockResolvedValueOnce({
        createdAt: new Date('2026-09-24T15:59:40.000Z'),
      })
      .mockResolvedValueOnce({
        processedAt: new Date('2026-09-24T15:59:55.000Z'),
      })
    prismaMocks.schedulingReminderSchedule.findFirst
      .mockResolvedValueOnce({
        scheduledForUtc: new Date('2026-09-24T15:59:30.000Z'),
      })
      .mockResolvedValueOnce({
        sentAt: new Date('2026-09-24T15:59:54.000Z'),
      })
    prismaMocks.schedulingNotificationDelivery.findFirst.mockResolvedValue({
      sentAt: new Date('2026-09-24T15:59:53.000Z'),
    })
  })

  it('distinguishes retryable, terminal, and overdue Scheduling work', async () => {
    const diagnostics = await getSchedulingNotificationWorkerDiagnostics({
      nowUtc: NOW,
    })

    expect(diagnostics).toMatchObject({
      outboxPending: 4,
      outboxProcessing: 2,
      outboxRetryableFailed: 3,
      outboxDead: 5,
      oldestEligiblePendingAgeMs: 20_000,
      reminderPending: 8,
      reminderProcessing: 2,
      reminderRetryableFailed: 3,
      reminderPermanentlyFailed: 4,
      reminderOverdue: 6,
      oldestOverdueAgeMs: 30_000,
      lastSuccessfulExecution: '2026-09-24T15:59:55.000Z',
    })
  })

  it('recovers only Scheduling outbox leases', async () => {
    prismaMocks.$transaction.mockResolvedValue([
      { count: 1 },
      { count: 2 },
      { count: 3 },
    ])

    await recoverSchedulingNotificationWorkerLeases({ nowUtc: NOW })

    expect(prismaMocks.domainOutboxEvent.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          topic: { startsWith: 'scheduling.' },
        }),
      }),
    )
  })

  it('does not mutate expired leases while notifications are disabled', async () => {
    vi.stubEnv('SCHEDULING_NOTIFICATIONS_ENABLED', 'false')

    await expect(
      recoverSchedulingNotificationWorkerLeases({ nowUtc: NOW }),
    ).resolves.toEqual({
      recoveredOutbox: 0,
      recoveredReminders: 0,
      recoveredDeliveries: 0,
    })
    expect(prismaMocks.$transaction).not.toHaveBeenCalled()
  })
})
