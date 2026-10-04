import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import {
  calculateEstimateFollowUpDueAt,
  estimateFollowUpConfigurationFingerprint,
  getEstimateFollowUpDelayDays,
  queueAutomatedEstimateFollowUpDelivery,
  reconcileQueuedEstimateFollowUpRun,
  scheduleEstimateFollowUpForSentDelivery,
} from '@/lib/estimates/followUp'

describe('Estimate Follow-Up authority', () => {
  beforeEach(() => vi.clearAllMocks())

  it.each([
    ['1-day', 1],
    ['3-days', 3],
    ['7-days', 7],
  ])('accepts the bounded %s delay', (value, days) => {
    expect(getEstimateFollowUpDelayDays({ 'estimate-delay': value })).toBe(days)
  })

  it('preserves New York wall-clock time across the spring DST boundary', () => {
    const result = calculateEstimateFollowUpDueAt({
      sentAt: new Date('2026-03-07T15:30:00.000Z'),
      timezone: 'America/New_York',
      delayDays: 1,
    })
    expect(result).toEqual({
      dueDateKey: '2026-03-08',
      dueAt: new Date('2026-03-08T14:30:00.000Z'),
    })
  })

  it('preserves New York wall-clock time across the fall DST boundary', () => {
    expect(
      calculateEstimateFollowUpDueAt({
        sentAt: new Date('2026-10-31T15:30:00.000Z'),
        timezone: 'America/New_York',
        delayDays: 1,
      }),
    ).toEqual({
      dueDateKey: '2026-11-01',
      dueAt: new Date('2026-11-01T16:30:00.000Z'),
    })
  })

  it.each([
    [
      'UTC midnight',
      'UTC',
      '2026-01-10T00:00:00.000Z',
      '2026-01-11T00:00:00.000Z',
    ],
    [
      'New York midnight',
      'America/New_York',
      '2026-01-10T05:00:00.000Z',
      '2026-01-11T05:00:00.000Z',
    ],
    [
      'Tokyo near midnight',
      'Asia/Tokyo',
      '2026-01-10T14:59:00.000Z',
      '2026-01-11T14:59:00.000Z',
    ],
  ])(
    'preserves %s across a calendar-day shift',
    (_label, timezone, sent, due) => {
      expect(
        calculateEstimateFollowUpDueAt({
          sentAt: new Date(sent),
          timezone,
          delayDays: 1,
        }).dueAt,
      ).toEqual(new Date(due))
    },
  )

  it.each([
    ['UTC', '2026-10-04T09:15:00.000Z'],
    ['Asia/Tokyo', '2026-10-04T09:15:00.000Z'],
  ])('moves calendar dates deterministically in %s', (timezone, instant) => {
    const sentAt = new Date(instant)
    const result = calculateEstimateFollowUpDueAt({
      sentAt,
      timezone,
      delayDays: 3,
    })
    expect(result.dueDateKey).toBe(
      timezone === 'UTC' ? '2026-10-07' : '2026-10-07',
    )
    expect(result.dueAt.getTime()).toBeGreaterThan(sentAt.getTime())
  })

  it('uses a stable configuration fingerprint', () => {
    expect(
      estimateFollowUpConfigurationFingerprint({
        definitionVersion: 1,
        config: { b: true, a: '3-days' },
      }),
    ).toBe(
      estimateFollowUpConfigurationFingerprint({
        definitionVersion: 1,
        config: { a: '3-days', b: true },
      }),
    )
  })

  it('reconciles a durable queued delivery without creating a second AutomationRun', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 'dispatch-a' }]),
      simpleAutomationDispatch: {
        findFirst: vi.fn().mockResolvedValue({ id: 'dispatch-a' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      estimateFollowUpSchedule: {
        findFirst: vi.fn().mockResolvedValue({ id: 'schedule-a' }),
      },
      automationRun: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      automationRunEvent: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }
    mocks.transaction.mockImplementationOnce(async (callback) => callback(tx))

    await expect(
      reconcileQueuedEstimateFollowUpRun({
        workspaceId: 'workspace-a',
        installationId: 'installation-a',
        eventKey: 'estimate-follow-up:schedule-a',
        dispatchId: 'dispatch-a',
        runId: 'run-a',
        now: new Date('2026-10-04T12:00:00.000Z'),
      }),
    ).resolves.toBe(true)

    expect(tx.estimateFollowUpSchedule.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        dispatchId: 'dispatch-a',
        automationRunId: 'run-a',
        status: 'DISPATCHED',
        generatedDeliveryId: { not: null },
      }),
      select: { id: true },
    })
    expect(tx.automationRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'run-a', status: 'RUNNING' }),
        data: expect.objectContaining({ status: 'SUCCESS' }),
      }),
    )
    expect(tx.simpleAutomationDispatch.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'dispatch-a',
          runId: 'run-a',
          status: 'PROCESSING',
        }),
        data: expect.objectContaining({ status: 'SUCCEEDED' }),
      }),
    )
  })

  it('never enrolls an automated follow-up delivery recursively', async () => {
    const tx = {
      estimateDelivery: {
        findUnique: vi.fn().mockResolvedValue({
          origin: 'AUTOMATED_FOLLOW_UP',
          status: 'SENT',
          sentAt: new Date(),
          estimate: {},
          estimateShare: {},
        }),
      },
    }
    await expect(
      scheduleEstimateFollowUpForSentDelivery(tx as never, {
        deliveryId: 'automated-delivery',
        now: new Date(),
      }),
    ).resolves.toBeNull()
  })

  it.each([
    ['missing', null],
    ['invalid', { scheduling: { timezone: 'Not/A_Timezone' } }],
  ])(
    'does not enroll when the raw persisted timezone is %s',
    async (_label, settings) => {
      const create = vi.fn()
      const tx = {
        estimateDelivery: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'delivery-a',
            workspaceId: 'workspace-a',
            estimateId: 'estimate-a',
            origin: 'MANUAL',
            status: 'SENT',
            sentAt: new Date('2026-10-04T12:00:00.000Z'),
            requestedAt: new Date('2026-10-04T11:59:00.000Z'),
            estimate: {
              status: 'PRESENTED',
              archivedAt: null,
              decisionEvidence: null,
              expiresOn: '2026-10-31',
              workspace: {
                businessModel: 'SIMPLE_SERVICE_BUSINESS',
                settings,
              },
            },
            estimateShare: {
              revokedAt: null,
              expiresAt: new Date('2026-11-01T00:00:00.000Z'),
            },
          }),
          findFirst: vi.fn().mockResolvedValue(null),
        },
        simpleAutomationInstallation: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'installation-a',
            definitionVersion: 1,
            config: { 'estimate-delay': '3-days' },
          }),
        },
        estimateFollowUpSchedule: { create },
      }

      await expect(
        scheduleEstimateFollowUpForSentDelivery(tx as never, {
          deliveryId: 'delivery-a',
          now: new Date('2026-10-04T12:00:00.000Z'),
        }),
      ).resolves.toBeNull()
      expect(create).not.toHaveBeenCalled()
    },
  )

  it.each([
    ['missing', null],
    ['invalid', { scheduling: { timezone: 'Not/A_Timezone' } }],
  ])(
    'fails orchestration closed when the raw persisted timezone is %s',
    async (_label, settings) => {
      const upsert = vi.fn()
      const tx = {
        $queryRaw: vi.fn().mockResolvedValue([{ id: 'schedule-a' }]),
        estimateFollowUpSchedule: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'schedule-a',
            workspaceId: 'workspace-a',
            estimateId: 'estimate-a',
            sourceDeliveryId: 'delivery-a',
            configurationFingerprint: estimateFollowUpConfigurationFingerprint({
              definitionVersion: 1,
              config: { 'estimate-delay': '3-days' },
            }),
            sourceDelivery: {
              id: 'delivery-a',
              estimateShareId: 'share-a',
              requestedAt: new Date('2026-10-04T11:59:00.000Z'),
              recipientEmail: 'customer@example.test',
              origin: 'MANUAL',
              status: 'SENT',
            },
            estimate: {
              archivedAt: null,
              status: 'PRESENTED',
              decisionEvidence: null,
              expiresOn: '2026-10-31',
              workspace: {
                businessModel: 'SIMPLE_SERVICE_BUSINESS',
                settings,
                subscription: { plan: 'Basic' },
                owner: { subscription: null },
              },
            },
            installation: {
              id: 'installation-a',
              definitionKey: 'estimate-follow-up',
              definitionVersion: 1,
              removedAt: null,
              config: { 'estimate-delay': '3-days' },
              lastConfiguredByUserId: 'user-a',
              automation: { id: 'automation-a', status: 'ACTIVE' },
            },
          }),
        },
        estimateShare: {
          findFirst: vi.fn().mockResolvedValue({ id: 'share-a' }),
        },
        estimateDelivery: {
          findFirst: vi.fn().mockResolvedValue(null),
          upsert,
        },
      }
      mocks.transaction.mockImplementationOnce(async (callback) => callback(tx))

      await expect(
        queueAutomatedEstimateFollowUpDelivery({
          workspaceId: 'workspace-a',
          automationId: 'automation-a',
          runId: 'run-a',
          triggerPayload: {
            followUpScheduleId: 'schedule-a',
            followUpClaimedBy: 'worker-a',
            simpleEventKey: 'estimate-follow-up:schedule-a',
          },
          now: new Date('2026-10-04T12:00:00.000Z'),
        }),
      ).rejects.toThrow('Managed Estimate Follow-Up is no longer current.')
      expect(upsert).not.toHaveBeenCalled()
    },
  )
})
