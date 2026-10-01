import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createEstimateService,
  EstimateServiceError,
  type EstimateMutationResult,
  type EstimateStore,
} from '@/lib/estimates/service'
import type { EstimateRecord } from '@/lib/estimates/types'
import { EstimateStatus, WorkspaceBusinessModel } from '@/lib/prisma/enums'

const NOW = new Date('2026-03-08T16:00:00.000Z')
const actor = { workspaceId: 'ws-a', userProfileId: 'profile-manager' }

function record(overrides: Partial<EstimateRecord> = {}): EstimateRecord {
  return {
    id: 'estimate-a',
    workspaceId: 'ws-a',
    referenceNumber: 'EST-A1B2C3D4E5',
    revisionNumber: 1,
    previousRevisionId: null,
    leadId: 'lead-a',
    customerId: null,
    title: 'Spring cleanup',
    scopeDescription: 'Clean beds and remove debris.',
    contactNameSnapshot: 'Jamie Rivera',
    contactEmailSnapshot: 'jamie@example.com',
    contactPhoneSnapshot: null,
    serviceAddressLine1Snapshot: null,
    serviceAddressLine2Snapshot: null,
    serviceAddressCitySnapshot: null,
    serviceAddressRegionSnapshot: null,
    serviceAddressPostalCodeSnapshot: null,
    serviceAddressCountrySnapshot: null,
    currency: 'USD',
    oneTimeSubtotalCents: 20_000,
    recurringPerVisitSubtotalCents: 7_500,
    status: EstimateStatus.DRAFT,
    expiresOn: '2026-03-08',
    version: 1,
    createdByUserId: 'profile-manager',
    presentedByUserId: null,
    acceptedByUserId: null,
    declinedByUserId: null,
    voidedByUserId: null,
    presentedAt: null,
    acceptedAt: null,
    declinedAt: null,
    voidedAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    archivedAt: null,
    lineItems: [],
    lead: { id: 'lead-a', displayName: 'Jamie Rivera', archivedAt: null },
    customer: null,
    createdBy: {
      id: 'profile-manager',
      fullName: 'Morgan Manager',
      email: 'morgan@example.com',
    },
    presentedBy: null,
    acceptedBy: null,
    declinedBy: null,
    voidedBy: null,
    ...overrides,
  }
}

function setup(overrides: Partial<EstimateStore> = {}) {
  const current = record()
  const store: EstimateStore = {
    getWorkspaceBusinessModel: vi.fn(
      async () => WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
    ),
    getWorkspaceTimezone: vi.fn(async () => 'America/New_York'),
    createEstimate: vi.fn(async ({ data }) =>
      record({
        leadId: data.leadId ?? null,
        customerId: data.customerId ?? null,
        currency: data.currency,
      }),
    ),
    listEstimates: vi.fn(async () => ({
      estimates: [current],
      nextCursor: null,
    })),
    getEstimateDetail: vi.fn(async () => ({
      estimate: current,
      revisions: [],
      revisionHistoryTruncated: false,
    })),
    updateDraft: vi.fn(async () => ({
      status: 'OK' as const,
      estimate: current,
    })),
    transition: vi.fn(async (input): Promise<EstimateMutationResult> => {
      if (
        input.action === 'accept' &&
        current.expiresOn &&
        current.expiresOn < input.workspaceDateKey
      ) {
        return { status: 'EXPIRED' }
      }
      return {
        status: 'OK',
        estimate: record({
          status:
            input.action === 'present'
              ? EstimateStatus.PRESENTED
              : input.action === 'accept'
                ? EstimateStatus.ACCEPTED
                : input.action === 'decline'
                  ? EstimateStatus.DECLINED
                  : EstimateStatus.VOIDED,
          version: 2,
        }),
      }
    }),
    createRevision: vi.fn(async () => ({
      status: 'OK' as const,
      estimate: record({ id: 'estimate-rev-2', revisionNumber: 2 }),
    })),
    archiveEstimate: vi.fn(async () => ({
      status: 'OK' as const,
      estimate: record({ archivedAt: NOW }),
    })),
    ...overrides,
  }
  return { store, service: createEstimateService(store, { now: () => NOW }) }
}

const validCreate = {
  leadId: 'lead-a',
  title: 'Spring cleanup and mowing',
  currency: 'usd',
  expiresOn: '2026-03-20',
  lineItems: [
    { title: 'Cleanup', billingBasis: 'ONE_TIME', amountCents: 20_000 },
    { title: 'Mowing', billingBasis: 'PER_VISIT', amountCents: 7_500 },
  ],
}

describe('Estimate domain service', () => {
  it.each([
    [{ leadId: 'lead-a' }, 'Lead'],
    [{ customerId: 'customer-a' }, 'Customer'],
    [{ leadId: 'lead-a', customerId: 'customer-a' }, 'both'],
  ])('creates from %s commercial context', async (context, _label) => {
    const { service, store } = setup()
    await service.createEstimate(actor, { ...validCreate, ...context })
    expect(store.createEstimate).toHaveBeenCalledWith({
      actor,
      data: expect.objectContaining({
        ...context,
        currency: 'USD',
        lineItems: expect.arrayContaining([
          expect.objectContaining({ billingBasis: 'ONE_TIME' }),
          expect.objectContaining({ billingBasis: 'PER_VISIT' }),
        ]),
      }),
    })
  })

  it('requires at least one Lead or Customer', async () => {
    const { service } = setup()
    await expect(
      service.createEstimate(actor, {
        ...validCreate,
        leadId: undefined,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it.each([-1, 100_000_001, 1.5, Number.NaN])(
    'rejects invalid integer-cent amount %s',
    async (amountCents) => {
      const { service } = setup()
      await expect(
        service.createEstimate(actor, {
          ...validCreate,
          lineItems: [
            { title: 'Cleanup', billingBasis: 'ONE_TIME', amountCents },
          ],
        }),
      ).rejects.toMatchObject({ status: 400 })
    },
  )

  it('rejects a subtotal above the supported range', async () => {
    const { service } = setup()
    await expect(
      service.createEstimate(actor, {
        ...validCreate,
        lineItems: [
          {
            title: 'First project',
            billingBasis: 'ONE_TIME',
            amountCents: 60_000_000,
          },
          {
            title: 'Second project',
            billingBasis: 'ONE_TIME',
            amountCents: 60_000_000,
          },
        ],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects client-forged totals, lifecycle state, revision, and actor fields', async () => {
    const { service, store } = setup()
    await expect(
      service.createEstimate(actor, {
        ...validCreate,
        oneTimeSubtotalCents: 1,
        status: 'ACCEPTED',
        revisionNumber: 99,
        acceptedByUserId: 'spoofed-user',
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(store.createEstimate).not.toHaveBeenCalled()
  })

  it('uses bounded pagination and the workspace business date for saved views', async () => {
    const { service, store } = setup()
    await service.listEstimates('ws-a', {
      view: 'PAST_EXPIRY',
      pageSize: '50',
      cursor: 'estimate-before',
    })
    expect(store.listEstimates).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      view: 'PAST_EXPIRY',
      pageSize: 50,
      cursor: 'estimate-before',
      workspaceDateKey: '2026-03-08',
    })
    await expect(
      service.listEstimates('ws-a', { pageSize: 51 }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('passes expectedVersion through every mutation and maps stale writes to 409', async () => {
    const stale = vi.fn(async () => ({ status: 'STALE' as const }))
    const { service } = setup({ updateDraft: stale })
    await expect(
      service.updateEstimate(actor, 'estimate-a', {
        expectedVersion: 4,
        title: 'Changed title',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
    expect(stale).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateId: 'estimate-a',
        data: expect.objectContaining({ expectedVersion: 4 }),
      }),
    )
  })

  it('maps Presented immutability to a conflict', async () => {
    const { service } = setup({
      updateDraft: vi.fn(async () => ({ status: 'IMMUTABLE' as const })),
    })
    await expect(
      service.updateEstimate(actor, 'estimate-a', {
        expectedVersion: 1,
        title: 'Mutated historical scope',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it.each(['present', 'accept', 'decline', 'void'] as const)(
    'routes %s through the transactional lifecycle store',
    async (action) => {
      const { service, store } = setup()
      await service.transitionEstimate(actor, 'estimate-a', action, {
        expectedVersion: 1,
      })
      expect(store.transition).toHaveBeenCalledWith(
        expect.objectContaining({
          actor,
          estimateId: 'estimate-a',
          action,
          expectedVersion: 1,
        }),
      )
    },
  )

  it('creates a new durable revision rather than updating the prior row', async () => {
    const { service, store } = setup()
    const revision = await service.createRevision(actor, 'estimate-a', {
      expectedVersion: 7,
    })
    expect(revision).toMatchObject({ id: 'estimate-rev-2', revisionNumber: 2 })
    expect(store.createRevision).toHaveBeenCalledWith({
      actor,
      estimateId: 'estimate-a',
      expectedVersion: 7,
    })
  })

  it('denies expired acceptance after the workspace-local date changes', async () => {
    const { service } = setup()
    await expect(
      service.transitionEstimate(actor, 'estimate-a', 'accept', {
        expectedVersion: 1,
      }),
    ).resolves.toMatchObject({ status: EstimateStatus.ACCEPTED })

    const afterExpiry = createEstimateService(setup().store, {
      now: () => new Date('2026-03-09T04:01:00.000Z'),
    })
    await expect(
      afterExpiry.transitionEstimate(actor, 'estimate-a', 'accept', {
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it.each([
    ['UTC', '2026-03-08T23:59:59.000Z', '2026-03-08'],
    ['America/New_York', '2026-03-09T03:59:59.000Z', '2026-03-08'],
    ['Asia/Tokyo', '2026-03-08T15:00:00.000Z', '2026-03-09'],
  ])(
    'derives expiry authority in %s instead of the server/browser timezone',
    async (timezone, instant, expectedDate) => {
      const transition = vi.fn(async () => ({
        status: 'OK' as const,
        estimate: record(),
      }))
      const { store } = setup({
        getWorkspaceTimezone: vi.fn(async () => timezone),
        transition,
      })
      const service = createEstimateService(store, {
        now: () => new Date(instant),
      })
      await service.transitionEstimate(actor, 'estimate-a', 'present', {
        expectedVersion: 1,
      })
      expect(transition).toHaveBeenCalledWith(
        expect.objectContaining({ workspaceDateKey: expectedDate }),
      )
    },
  )

  it('fails closed outside the Simple Service Business model', async () => {
    const { service, store } = setup({
      getWorkspaceBusinessModel: vi.fn(
        async () => WorkspaceBusinessModel.DIRECT_SALES,
      ),
    })
    await expect(service.listEstimates('ws-a')).rejects.toBeInstanceOf(
      EstimateServiceError,
    )
    expect(store.listEstimates).not.toHaveBeenCalled()
  })
})
