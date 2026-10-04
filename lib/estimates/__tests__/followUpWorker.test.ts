import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  updateMany: vi.fn(),
  dispatch: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    estimateFollowUpSchedule: {
      findFirst: mocks.findFirst,
      count: mocks.count,
      updateMany: mocks.updateMany,
    },
  },
}))

vi.mock('@/lib/automations/simpleAutomationDispatch', () => ({
  dispatchSimpleAutomationEvent: mocks.dispatch,
}))

import { processEstimateFollowUpSchedules } from '@/lib/estimates/followUpWorker'

const now = new Date('2026-10-04T12:00:00.000Z')

describe('Estimate Follow-Up worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryRaw.mockResolvedValue([{ id: 'schedule-a' }])
    mocks.findFirst.mockResolvedValue({
      id: 'schedule-a',
      workspaceId: 'workspace-a',
      estimateId: 'estimate-a',
      installationId: 'installation-a',
      attempts: 1,
      installation: { automationId: 'automation-a' },
    })
    mocks.count.mockResolvedValue(1)
    mocks.updateMany.mockResolvedValue({ count: 1 })
    mocks.dispatch.mockResolvedValue({ status: 'SUCCESS' })
  })

  it('dispatches one stable event identity for the claimed occurrence', async () => {
    await expect(
      processEstimateFollowUpSchedules({
        now,
        workerId: 'worker-a',
        batchSize: 20,
      }),
    ).resolves.toEqual({ claimed: 1, dispatched: 1, failed: 0, canceled: 0 })
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        installationId: 'installation-a',
        eventKey: 'estimate-follow-up:schedule-a',
        triggerPayload: expect.objectContaining({
          simpleEventKey: 'estimate-follow-up:schedule-a',
          followUpScheduleId: 'schedule-a',
          followUpClaimedBy: 'worker-a',
        }),
      }),
    )
  })

  it('turns lifecycle invalidation into cancellation instead of transport failure', async () => {
    mocks.dispatch.mockRejectedValue(
      new Error('Managed Estimate Follow-Up is no longer current.'),
    )
    const result = await processEstimateFollowUpSchedules({
      now,
      workerId: 'worker-a',
    })
    expect(result).toMatchObject({ canceled: 1, failed: 0 })
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    )
  })

  it('bounds due claims at fifty and leaves stale leases recoverable', async () => {
    mocks.queryRaw.mockResolvedValue([])
    await processEstimateFollowUpSchedules({
      now,
      workerId: 'worker-a',
      batchSize: 10_000,
    })
    const query = mocks.queryRaw.mock.calls[0]?.[0] as {
      strings: readonly string[]
      values: unknown[]
    }
    expect(query.values).toContain(50)
    expect(query.strings.join(' ')).toContain('leaseExpiresAt')
    expect(query.strings.join(' ')).toContain('SKIP LOCKED')
  })
})
