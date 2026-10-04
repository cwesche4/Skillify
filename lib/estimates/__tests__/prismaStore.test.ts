import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  estimateFindMany: vi.fn(),
  estimateFindFirst: vi.fn(),
  operationalizationFindFirst: vi.fn(),
  leadFindFirst: vi.fn(),
  customerFindFirst: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    $transaction: mocks.transaction,
    estimate: {
      findMany: mocks.estimateFindMany,
      findFirst: mocks.estimateFindFirst,
    },
    estimateOperationalization: {
      findFirst: mocks.operationalizationFindFirst,
    },
    lead: { findFirst: mocks.leadFindFirst },
    customer: { findFirst: mocks.customerFindFirst },
  },
}))

import { prismaEstimateStore } from '@/lib/estimates/prismaStore'
import { EstimateStatus } from '@/lib/prisma/enums'

const NOW = new Date('2026-09-30T16:00:00.000Z')
const actor = { workspaceId: 'ws-a', userProfileId: 'profile-manager' }

function estimate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'estimate-a',
    workspaceId: 'ws-a',
    referenceNumber: 'EST-A1B2C3D4E5',
    revisionNumber: 1,
    previousRevisionId: null,
    leadId: 'lead-a',
    customerId: null,
    title: 'Spring cleanup',
    scopeDescription: null,
    contactNameSnapshot: 'Jamie Rivera',
    contactEmailSnapshot: null,
    contactPhoneSnapshot: null,
    serviceAddressLine1Snapshot: null,
    serviceAddressLine2Snapshot: null,
    serviceAddressCitySnapshot: null,
    serviceAddressRegionSnapshot: null,
    serviceAddressPostalCodeSnapshot: null,
    serviceAddressCountrySnapshot: null,
    currency: 'USD',
    oneTimeSubtotalCents: 10_000,
    recurringPerVisitSubtotalCents: 0,
    status: EstimateStatus.DRAFT,
    expiresOn: '2026-10-15',
    version: 1,
    lineItems: [
      {
        id: 'line-a',
        title: 'Cleanup',
        description: null,
        billingBasis: 'ONE_TIME',
        amountCents: 10_000,
        sortOrder: 0,
      },
    ],
    ...overrides,
  }
}

function installTransaction(tx: Record<string, unknown>) {
  mocks.transaction.mockImplementation(async (callback) => callback(tx))
}

describe('Estimate Prisma store lifecycle and concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.queryRaw.mockResolvedValue([])
    mocks.operationalizationFindFirst.mockResolvedValue(null)
    mocks.leadFindFirst.mockResolvedValue(null)
    mocks.customerFindFirst.mockResolvedValue(null)
  })

  it('rejects a Lead and Customer pair unless the Lead converted to that Customer', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [
        {
          id: 'lead-a',
          displayName: 'Jamie Rivera',
          companyName: null,
          email: null,
          phone: null,
          convertedCustomerId: null,
        },
      ]),
      estimate: { create: vi.fn() },
    }
    installTransaction(tx)

    await expect(
      prismaEstimateStore.createEstimate({
        actor,
        data: {
          leadId: 'lead-a',
          customerId: 'customer-unrelated',
          title: 'Cleanup',
          scopeDescription: null,
          currency: 'USD',
          expiresOn: null,
          lineItems: [],
        },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    expect(tx.estimate.create).not.toHaveBeenCalled()
  })

  it('rejects a stale Draft replacement before changing content or totals', async () => {
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: 'estimate-a' }]),
      estimate: {
        findFirst: vi.fn(async () => estimate({ version: 2 })),
        update: vi.fn(),
      },
      estimateLineItem: { deleteMany: vi.fn(), createMany: vi.fn() },
    }
    installTransaction(tx)

    await expect(
      prismaEstimateStore.updateDraft({
        actor,
        estimateId: 'estimate-a',
        data: {
          expectedVersion: 1,
          lineItems: [
            {
              title: 'Forged stale edit',
              description: null,
              billingBasis: 'ONE_TIME',
              amountCents: 1,
            },
          ],
        },
      }),
    ).resolves.toEqual({ status: 'STALE' })
    expect(tx.estimate.update).not.toHaveBeenCalled()
    expect(tx.estimateLineItem.deleteMany).not.toHaveBeenCalled()
  })

  it('supersedes the active Presented family revision when a later replacement is presented', async () => {
    const current = estimate({
      id: 'revision-3',
      revisionNumber: 3,
      previousRevisionId: 'revision-2',
    })
    const tx = {
      $queryRaw: vi
        .fn()
        .mockResolvedValueOnce([{ id: 'revision-3' }])
        .mockResolvedValueOnce([
          { id: 'revision-1', status: EstimateStatus.PRESENTED },
          { id: 'revision-2', status: EstimateStatus.VOIDED },
          { id: 'revision-3', status: EstimateStatus.DRAFT },
        ]),
      estimate: {
        findFirst: vi.fn(async () => current),
        updateMany: vi.fn(async () => ({ count: 1 })),
        update: vi.fn(async () => current),
      },
    }
    installTransaction(tx)

    await expect(
      prismaEstimateStore.transition({
        actor,
        estimateId: 'revision-3',
        action: 'present',
        expectedVersion: 1,
        workspaceDateKey: '2026-09-30',
        now: NOW,
      }),
    ).resolves.toMatchObject({ status: 'OK' })
    expect(tx.estimate.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'ws-a',
        referenceNumber: 'EST-A1B2C3D4E5',
        status: EstimateStatus.PRESENTED,
      },
      data: {
        status: EstimateStatus.SUPERSEDED,
        version: { increment: 1 },
      },
    })
    expect(tx.estimate.update).toHaveBeenCalledWith({
      where: { id: 'revision-3' },
      data: {
        status: EstimateStatus.PRESENTED,
        presentedAt: NOW,
        presentedByUserId: 'profile-manager',
        version: { increment: 1 },
      },
    })
  })

  it('fails a competing Decline after acceptance wins the row lock', async () => {
    const accepted = estimate({
      status: EstimateStatus.ACCEPTED,
      version: 2,
    })
    const tx = {
      $queryRaw: vi.fn(async () => [{ id: 'estimate-a' }]),
      estimate: {
        findFirst: vi.fn(async () => accepted),
        update: vi.fn(),
      },
    }
    installTransaction(tx)

    await expect(
      prismaEstimateStore.transition({
        actor,
        estimateId: 'estimate-a',
        action: 'decline',
        expectedVersion: 1,
        workspaceDateKey: '2026-09-30',
        now: NOW,
      }),
    ).resolves.toEqual({ status: 'STALE' })
    expect(tx.estimate.update).not.toHaveBeenCalled()
  })

  it('uses an immutable workspace-bound keyset cursor', async () => {
    const firstUpdatedAt = new Date('2026-09-30T16:00:00.000Z')
    const first = estimate({
      id: 'estimate-newer',
      updatedAt: firstUpdatedAt,
    })
    const second = estimate({
      id: 'estimate-older',
      updatedAt: new Date('2026-09-29T16:00:00.000Z'),
    })
    mocks.estimateFindMany.mockResolvedValueOnce([first, second])

    const firstPage = await prismaEstimateStore.listEstimates({
      workspaceId: 'ws-a',
      view: 'ALL',
      pageSize: 1,
      workspaceDateKey: '2026-09-30',
      now: NOW,
    })

    expect(firstPage.nextCursor).toEqual(expect.any(String))
    mocks.estimateFindMany.mockResolvedValueOnce([])
    await prismaEstimateStore.listEstimates({
      workspaceId: 'ws-a',
      view: 'ALL',
      pageSize: 1,
      cursor: firstPage.nextCursor!,
      workspaceDateKey: '2026-09-30',
      now: NOW,
    })
    expect(mocks.estimateFindMany.mock.calls).toContainEqual([
      expect.objectContaining({
        where: expect.objectContaining({
          workspaceId: 'ws-a',
          OR: [
            { updatedAt: { lt: firstUpdatedAt } },
            { updatedAt: firstUpdatedAt, id: { lt: first.id } },
          ],
        }),
      }),
    ])

    await expect(
      prismaEstimateStore.listEstimates({
        workspaceId: 'ws-b',
        view: 'ALL',
        pageSize: 1,
        cursor: firstPage.nextCursor!,
        workspaceDateKey: '2026-09-30',
        now: NOW,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('uses reference-family operationalization authority for work views', async () => {
    const accepted = estimate({
      status: EstimateStatus.ACCEPTED,
      updatedAt: NOW,
    })
    mocks.queryRaw
      .mockResolvedValueOnce([{ id: 'estimate-a' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'estimate-a' }])
    mocks.estimateFindMany
      .mockResolvedValueOnce([accepted])
      .mockResolvedValueOnce([
        {
          id: 'estimate-a',
          status: EstimateStatus.ACCEPTED,
          expiresOn: null,
          archivedAt: null,
          decisionEvidence: null,
          operationalization: null,
          shares: [],
          followUpSchedules: [],
        },
      ])

    const result = await prismaEstimateStore.listEstimates({
      workspaceId: 'ws-a',
      view: 'WORK_CREATED',
      pageSize: 20,
      workspaceDateKey: '2026-09-30',
      now: NOW,
    })

    expect(result.estimates).toHaveLength(1)
    expect(result.estimates[0]?.attention).toMatchObject({
      workCreated: true,
    })
    expect(mocks.estimateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ['estimate-a'] } }),
      }),
    )
    const sql = (
      mocks.queryRaw.mock.calls[0]?.[0] as { strings: string[] }
    ).strings.join(' ')
    expect(sql).toContain('work."referenceNumber" = estimate."referenceNumber"')
  })

  it('bounds revision history and reports truncation explicitly', async () => {
    mocks.estimateFindFirst.mockResolvedValueOnce(estimate())
    mocks.estimateFindMany.mockResolvedValueOnce(
      Array.from({ length: 101 }, (_, index) => ({
        id: `revision-${index + 1}`,
        revisionNumber: index + 1,
      })),
    )

    const detail = await prismaEstimateStore.getEstimateDetail({
      workspaceId: 'ws-a',
      estimateId: 'estimate-a',
    })
    expect(detail?.revisions).toHaveLength(100)
    expect(detail?.revisionHistoryTruncated).toBe(true)
    expect(mocks.estimateFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 101 }),
    )
  })
})
