import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  prisma: {
    estimateShare: { findUnique: vi.fn() },
    estimateDecision: { findFirst: vi.fn() },
    estimate: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
  tx: {
    $queryRaw: vi.fn(),
    estimateShare: { findUnique: vi.fn(), update: vi.fn() },
    estimate: { findFirst: vi.fn(), update: vi.fn() },
    estimateDecision: { findFirst: vi.fn(), create: vi.fn() },
    estimateDelivery: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }))

import {
  decidePublicEstimate,
  getPublicEstimate,
  queueEstimateDelivery,
  revokeEstimateShare,
} from '@/lib/estimates/customerExperience'

const now = new Date('2026-10-03T12:00:00.000Z')

function estimate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate-a',
    workspaceId: 'workspace-a',
    referenceNumber: 'EST-1234567890',
    revisionNumber: 2,
    title: 'Seasonal service',
    scopeDescription: 'Complete the proposed service.',
    contactNameSnapshot: 'Customer Name',
    contactEmailSnapshot: 'private@example.test',
    contactPhoneSnapshot: '555-0100',
    serviceAddressLine1Snapshot: '1 Main St',
    serviceAddressLine2Snapshot: null,
    serviceAddressCitySnapshot: 'Town',
    serviceAddressRegionSnapshot: 'NY',
    serviceAddressPostalCodeSnapshot: '10001',
    serviceAddressCountrySnapshot: 'US',
    currency: 'USD',
    oneTimeSubtotalCents: 10000,
    recurringPerVisitSubtotalCents: 2500,
    status: 'PRESENTED',
    version: 3,
    expiresOn: '2026-10-10',
    archivedAt: null,
    lineItems: [
      {
        id: 'line-private-id',
        workspaceId: 'workspace-a',
        estimateId: 'estimate-a',
        title: 'Initial service',
        description: null,
        billingBasis: 'ONE_TIME',
        amountCents: 10000,
        sortOrder: 0,
      },
    ],
    decisionEvidence: null,
    workspace: {
      businessModel: 'SIMPLE_SERVICE_BUSINESS',
      settings: { scheduling: { timezone: 'UTC' } },
    },
    ...overrides,
  }
}

function share() {
  return {
    id: 'share-a',
    workspaceId: 'workspace-a',
    estimateId: 'estimate-a',
    publicId: 'p'.repeat(43),
    businessIdentitySnapshot: {
      displayName: 'Example Services',
      phone: '555-0110',
      address: null,
    },
    expiresAt: new Date('2027-01-01T00:00:00.000Z'),
    revokedAt: null,
    createdAt: new Date('2026-10-03T12:00:00.500Z'),
  }
}

describe('Estimate customer experience service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof mocks.tx) => unknown) => callback(mocks.tx),
    )
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'locked' }])
  })

  it('returns a dedicated redacted DTO with separate one-time/per-visit truth', async () => {
    mocks.prisma.estimateShare.findUnique.mockResolvedValue({
      ...share(),
      estimate: estimate(),
    })
    const dto = await getPublicEstimate({
      publicId: 'p'.repeat(43),
      csrfToken: 'csrf-token',
      now,
    })
    expect(dto.state).toBe('PRESENTED')
    if (!('oneTimeSubtotalCents' in dto)) throw new Error()
    expect(dto.oneTimeSubtotalCents).toBe(10000)
    expect(dto.recurringPerVisitSubtotalCents).toBe(2500)
    expect(dto.canAccept).toBe(true)
    const serialized = JSON.stringify(dto)
    expect(serialized).not.toContain('workspace-a')
    expect(serialized).not.toContain('line-private-id')
    expect(serialized).not.toContain('private@example.test')
    expect(serialized).not.toContain('555-0100')
  })

  it('shows only safe state for a superseded exact revision', async () => {
    mocks.prisma.estimateShare.findUnique.mockResolvedValue({
      ...share(),
      estimate: estimate({ status: 'SUPERSEDED' }),
    })
    const dto = await getPublicEstimate({
      publicId: 'p'.repeat(43),
      csrfToken: 'csrf-token',
      now,
    })
    expect(dto).toMatchObject({
      state: 'REPLACED',
      canAccept: false,
      canDecline: false,
    })
    expect(JSON.stringify(dto)).not.toContain('Seasonal service')
  })

  it('records a customer acceptance without creating operational work', async () => {
    mocks.tx.estimateShare.findUnique
      .mockResolvedValueOnce({
        workspaceId: 'workspace-a',
        estimateId: 'estimate-a',
      })
      .mockResolvedValueOnce(share())
    mocks.tx.estimate.findFirst.mockResolvedValue(estimate())
    mocks.tx.estimateDecision.findFirst.mockResolvedValue(null)
    mocks.tx.estimateDecision.create.mockResolvedValue({
      id: 'decision-a',
      decision: 'ACCEPTED',
      source: 'CUSTOMER_LINK',
    })
    mocks.tx.estimate.update.mockResolvedValue({
      ...estimate(),
      status: 'ACCEPTED',
    })

    const result = await decidePublicEstimate({
      publicId: 'p'.repeat(43),
      now,
      rawInput: {
        decision: 'ACCEPTED',
        acknowledgmentName: 'Customer Name',
        csrfToken: 'csrf-token-value',
      },
    })

    expect(result.replayed).toBe(false)
    expect(mocks.tx.estimateDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        estimateId: 'estimate-a',
        estimateShareId: 'share-a',
        decision: 'ACCEPTED',
        source: 'CUSTOMER_LINK',
        acknowledgmentNameSnapshot: 'Customer Name',
      }),
    })
    expect(mocks.tx.estimate.update).toHaveBeenCalledWith({
      where: { id: 'estimate-a' },
      data: expect.objectContaining({
        status: 'ACCEPTED',
        acceptedByUserId: null,
      }),
    })
    expect('job' in mocks.tx).toBe(false)
    expect('recurringService' in mocks.tx).toBe(false)
  })

  it('replays the same decision and rejects the opposite decision', async () => {
    mocks.tx.estimateShare.findUnique.mockResolvedValue(share())
    mocks.tx.estimate.findFirst.mockResolvedValue(
      estimate({ status: 'ACCEPTED' }),
    )
    mocks.tx.estimateDecision.findFirst.mockResolvedValue({
      id: 'decision-a',
      decision: 'ACCEPTED',
      source: 'CUSTOMER_LINK',
    })

    const replay = await decidePublicEstimate({
      publicId: 'p'.repeat(43),
      now,
      rawInput: {
        decision: 'ACCEPTED',
        acknowledgmentName: 'Customer Name',
        csrfToken: 'csrf-token-value',
      },
    })
    expect(replay.replayed).toBe(true)

    await expect(
      decidePublicEstimate({
        publicId: 'p'.repeat(43),
        now,
        rawInput: {
          decision: 'DECLINED',
          acknowledgmentName: 'Customer Name',
          csrfToken: 'csrf-token-value',
        },
      }),
    ).rejects.toMatchObject({
      status: 409,
      code: 'CONFLICT',
    })
    expect(mocks.tx.estimate.update).not.toHaveBeenCalled()
  })

  it('records decline evidence and replays a duplicate decline without rewriting it', async () => {
    mocks.tx.estimateShare.findUnique.mockResolvedValue(share())
    mocks.tx.estimate.findFirst
      .mockResolvedValueOnce(estimate())
      .mockResolvedValueOnce(estimate({ status: 'DECLINED', version: 4 }))
    mocks.tx.estimateDecision.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'decision-declined',
        decision: 'DECLINED',
        source: 'CUSTOMER_LINK',
      })
    mocks.tx.estimateDecision.create.mockResolvedValue({
      id: 'decision-declined',
      decision: 'DECLINED',
      source: 'CUSTOMER_LINK',
    })
    mocks.tx.estimate.update.mockResolvedValue(
      estimate({ status: 'DECLINED', version: 4 }),
    )
    const input = {
      decision: 'DECLINED' as const,
      acknowledgmentName: 'Customer Name',
      declineReason: 'TIMING',
      declineNote: 'Please contact me next season.',
      csrfToken: 'csrf-token-value',
    }

    const first = await decidePublicEstimate({
      publicId: 'p'.repeat(43),
      now,
      rawInput: input,
    })
    const replay = await decidePublicEstimate({
      publicId: 'p'.repeat(43),
      now,
      rawInput: input,
    })

    expect(first.replayed).toBe(false)
    expect(replay.replayed).toBe(true)
    expect(mocks.tx.estimateDecision.create).toHaveBeenCalledTimes(1)
    expect(mocks.tx.estimateDecision.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        decision: 'DECLINED',
        declineReason: 'TIMING',
        declineNote: 'Please contact me next season.',
      }),
    })
    expect(mocks.tx.estimate.update).toHaveBeenCalledWith({
      where: { id: 'estimate-a' },
      data: expect.objectContaining({
        status: 'DECLINED',
        declinedByUserId: null,
      }),
    })
  })

  it('blocks both public decisions after the workspace-local commercial date', async () => {
    mocks.tx.estimateShare.findUnique.mockResolvedValue(share())
    mocks.tx.estimate.findFirst.mockResolvedValue(
      estimate({ expiresOn: '2026-10-02' }),
    )
    mocks.tx.estimateDecision.findFirst.mockResolvedValue(null)
    await expect(
      decidePublicEstimate({
        publicId: 'p'.repeat(43),
        now,
        rawInput: {
          decision: 'DECLINED',
          acknowledgmentName: 'Customer Name',
          csrfToken: 'csrf-token-value',
        },
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('replays an already queued exact delivery even after commercial state changes', async () => {
    mocks.tx.estimate.findFirst.mockResolvedValue(
      estimate({ status: 'ACCEPTED', version: 4 }),
    )
    mocks.tx.estimateDelivery.findUnique.mockResolvedValue({
      id: 'delivery-a',
      estimateId: 'estimate-a',
      recipientEmail: 'customer@example.test',
      estimateShare: share(),
    })

    const result = await queueEstimateDelivery({
      workspaceId: 'workspace-a',
      estimateId: 'estimate-a',
      actorUserId: 'profile-manager',
      now,
      rawInput: {
        expectedVersion: 3,
        recipientEmail: 'customer@example.test',
        idempotencyKey: 'delivery-request-a',
      },
    })

    expect(result.replayed).toBe(true)
    expect(mocks.tx.estimateDelivery.create).not.toHaveBeenCalled()
  })

  it('never records a revocation before a concurrently created share', async () => {
    mocks.tx.estimate.findFirst.mockResolvedValue(estimate())
    mocks.tx.estimateShare.findUnique.mockResolvedValue(share())
    mocks.tx.estimateShare.update.mockResolvedValue({})

    await revokeEstimateShare({
      workspaceId: 'workspace-a',
      estimateId: 'estimate-a',
      rawInput: { expectedVersion: 3 },
      now,
    })

    expect(mocks.tx.estimateShare.update).toHaveBeenCalledWith({
      where: { id: 'share-a' },
      data: { revokedAt: new Date('2026-10-03T12:00:00.500Z') },
    })
  })
})
