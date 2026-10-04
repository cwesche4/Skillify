import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  scheduleFollowUp: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    $transaction: vi.fn(async (callback) =>
      callback({
        estimateDelivery: { updateMany: mocks.updateMany },
      }),
    ),
    estimateDelivery: {
      findFirst: mocks.findFirst,
      updateMany: mocks.updateMany,
    },
  },
}))

vi.mock('@/lib/estimates/followUp', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/estimates/followUp')>()),
  scheduleEstimateFollowUpForSentDelivery: mocks.scheduleFollowUp,
}))

import { processEstimateDeliveryQueue } from '@/lib/estimates/deliveryWorker'

const now = new Date('2026-10-03T12:00:00.000Z')

function claimedDelivery(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 'delivery-a',
    workspaceId: 'workspace-a',
    estimateId: 'estimate-a',
    recipientEmail: 'customer@example.test',
    status: 'PROCESSING',
    attempts: 1,
    claimedBy: 'worker-a',
    estimateShare: {
      publicId: 'p'.repeat(43),
      businessIdentitySnapshot: { displayName: 'Example Services' },
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      revokedAt: null,
    },
    estimate: {
      archivedAt: null,
      status: 'PRESENTED',
      decisionEvidence: null,
      expiresOn: null,
      referenceNumber: 'EST-1234567890',
      revisionNumber: 2,
      title: 'Seasonal service',
      workspace: {
        businessModel: 'SIMPLE_SERVICE_BUSINESS',
        settings: null,
      },
    },
    ...overrides,
  }
}

describe('Estimate delivery worker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv(
      'ESTIMATE_SHARE_SIGNING_KEY',
      Buffer.alloc(32, 7).toString('base64'),
    )
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://app.example.test')
    mocks.queryRaw.mockResolvedValue([{ id: 'delivery-a' }])
    mocks.findFirst.mockResolvedValue(claimedDelivery())
    mocks.updateMany.mockResolvedValue({ count: 1 })
  })

  it('sends with a stable provider idempotency key and records provider acceptance', async () => {
    const resolveSender = vi.fn().mockResolvedValue({
      connectionId: 'connection-a',
      apiKey: 'not-a-real-key',
      from: 'Example Services <estimates@example.test>',
    })
    const send = vi.fn().mockResolvedValue({
      status: 'sent',
      provider: 'resend',
      providerMessageId: 'provider-message-a',
    })

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender,
      send,
    })

    expect(result).toEqual({ claimed: 1, sent: 1, failed: 0, canceled: 0 })
    expect(resolveSender).toHaveBeenCalledWith('workspace-a')
    expect(send).toHaveBeenCalledWith({
      sender: expect.objectContaining({ connectionId: 'connection-a' }),
      message: expect.objectContaining({
        to: 'customer@example.test',
        idempotencyKey: 'estimate-delivery:delivery-a',
      }),
    })
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'delivery-a',
        status: 'PROCESSING',
        claimedBy: 'worker-a',
      },
      data: expect.objectContaining({
        status: 'SENT',
        provider: 'resend',
        providerMessageId: 'provider-message-a',
        sentAt: now,
        claimedBy: null,
        leaseExpiresAt: null,
      }),
    })
  })

  it('cancels rather than sending when final Estimate state is stale', async () => {
    mocks.findFirst.mockResolvedValue(
      claimedDelivery({
        estimate: {
          archivedAt: null,
          status: 'ACCEPTED',
          expiresOn: null,
          referenceNumber: 'EST-1234567890',
          revisionNumber: 2,
          title: 'Seasonal service',
          workspace: {
            businessModel: 'SIMPLE_SERVICE_BUSINESS',
            settings: null,
          },
        },
      }),
    )
    const resolveSender = vi.fn()
    const send = vi.fn()

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender,
      send,
    })

    expect(result.canceled).toBe(1)
    expect(resolveSender).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'CANCELED' }),
      }),
    )
  })

  it('cancels when terminal decision evidence exists even if status is stale Presented', async () => {
    mocks.findFirst.mockResolvedValue(
      claimedDelivery({
        estimate: {
          archivedAt: null,
          status: 'PRESENTED',
          decisionEvidence: { id: 'decision-a' },
          expiresOn: null,
          referenceNumber: 'EST-1234567890',
          revisionNumber: 2,
          title: 'Seasonal service',
          workspace: {
            businessModel: 'SIMPLE_SERVICE_BUSINESS',
            settings: null,
          },
        },
      }),
    )
    const resolveSender = vi.fn()
    const send = vi.fn()

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender,
      send,
    })

    expect(result.canceled).toBe(1)
    expect(resolveSender).not.toHaveBeenCalled()
    expect(send).not.toHaveBeenCalled()
  })

  it.each([
    ['missing', null],
    ['invalid', { scheduling: { timezone: 'Not/A_Timezone' } }],
  ])(
    'cancels an automated follow-up when the persisted timezone is %s',
    async (_label, settings) => {
      mocks.findFirst.mockResolvedValue(
        claimedDelivery({
          origin: 'AUTOMATED_FOLLOW_UP',
          estimate: {
            archivedAt: null,
            status: 'PRESENTED',
            expiresOn: null,
            referenceNumber: 'EST-1234567890',
            revisionNumber: 2,
            title: 'Seasonal service',
            workspace: {
              businessModel: 'SIMPLE_SERVICE_BUSINESS',
              settings,
            },
          },
        }),
      )
      const resolveSender = vi.fn()
      const send = vi.fn()

      const result = await processEstimateDeliveryQueue({
        now,
        workerId: 'worker-a',
        resolveSender,
        send,
      })

      expect(result.canceled).toBe(1)
      expect(resolveSender).not.toHaveBeenCalled()
      expect(send).not.toHaveBeenCalled()
    },
  )

  it('revalidates commercial expiry after sender resolution and before send', async () => {
    mocks.findFirst
      .mockResolvedValueOnce(claimedDelivery())
      .mockResolvedValueOnce(
        claimedDelivery({
          estimate: {
            archivedAt: null,
            status: 'PRESENTED',
            expiresOn: '2026-10-02',
            referenceNumber: 'EST-1234567890',
            revisionNumber: 2,
            title: 'Seasonal service',
            workspace: {
              businessModel: 'SIMPLE_SERVICE_BUSINESS',
              settings: null,
            },
          },
        }),
      )
    const send = vi.fn()

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender: vi.fn().mockResolvedValue({
        connectionId: 'connection-a',
        apiKey: 'not-a-real-key',
        from: 'estimates@example.test',
      }),
      send,
    })

    expect(result.canceled).toBe(1)
    expect(send).not.toHaveBeenCalled()
  })

  it('schedules retryable failures with bounded backoff', async () => {
    const send = vi.fn().mockResolvedValue({
      status: 'failed',
      provider: 'resend',
      code: 'RESEND_503',
      message: 'Temporarily unavailable.',
      retryable: true,
    })

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender: vi.fn().mockResolvedValue({
        connectionId: 'connection-a',
        apiKey: 'not-a-real-key',
        from: 'estimates@example.test',
      }),
      send,
    })

    expect(result.failed).toBe(1)
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'FAILED',
          nextAttemptAt: new Date('2026-10-03T12:01:00.000Z'),
          lastErrorCode: 'RESEND_503',
        }),
      }),
    )
  })

  it('makes sender configuration failures permanent', async () => {
    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender: vi.fn().mockRejectedValue(new Error('Sender unavailable')),
      send: vi.fn(),
    })

    expect(result.failed).toBe(1)
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PERMANENTLY_FAILED',
          nextAttemptAt: null,
          lastErrorCode: 'SENDER_CONFIGURATION_UNAVAILABLE',
        }),
      }),
    )
  })

  it('does not count a stale worker whose fenced final update loses ownership', async () => {
    mocks.updateMany.mockResolvedValue({ count: 0 })

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      resolveSender: vi.fn().mockResolvedValue({
        connectionId: 'connection-a',
        apiKey: 'not-a-real-key',
        from: 'estimates@example.test',
      }),
      send: vi.fn().mockResolvedValue({
        status: 'sent',
        provider: 'resend',
        providerMessageId: 'provider-message-a',
      }),
    })

    expect(result).toEqual({ claimed: 1, sent: 0, failed: 0, canceled: 0 })
  })

  it('bounds each claim batch at fifty records', async () => {
    mocks.queryRaw.mockResolvedValue([])

    const result = await processEstimateDeliveryQueue({
      now,
      workerId: 'worker-a',
      batchSize: 10_000,
    })

    expect(result.claimed).toBe(0)
    expect(
      (mocks.queryRaw.mock.calls[0]?.[0] as { values: unknown[] }).values,
    ).toContain(50)
  })
})
