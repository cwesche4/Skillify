import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  estimateFindFirst: vi.fn(),
  existingFindFirst: vi.fn(),
  transaction: vi.fn(),
  prepareSchedule: vi.fn(),
  createJob: vi.fn(),
  createSchedule: vi.fn(),
  resolveScheduleAssignments: vi.fn(),
  createRecurring: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    estimate: { findFirst: mocks.estimateFindFirst },
    estimateOperationalization: { findFirst: mocks.existingFindFirst },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/jobs/prismaStore', () => ({
  createJobInTransaction: mocks.createJob,
}))
vi.mock('@/lib/recurring-services/prismaStore', () => ({
  createRecurringServiceInTransaction: mocks.createRecurring,
}))
vi.mock('@/lib/scheduling/repository', () => ({
  SchedulingRepositoryError: class SchedulingRepositoryError extends Error {
    code = 'invalid_input'
  },
  createSchedulingEventInTransaction: mocks.createSchedule,
  resolveSchedulingAssignmentsInTransaction: mocks.resolveScheduleAssignments,
}))
vi.mock('@/lib/scheduling/services/schedulingService', () => ({
  SchedulingServiceError: class SchedulingServiceError extends Error {
    status = 400
    fieldErrors = {}
  },
  prepareSchedulingEventForTransactionalCreate: mocks.prepareSchedule,
}))

import { operationalizeAcceptedEstimate } from '@/lib/estimates/operationalization'
import { hashEstimateOperationalizationRequest } from '@/lib/estimates/operationalizationHash'
import { estimateOperationalizationSchema } from '@/lib/estimates/operationalizationValidation'

const customer = {
  id: 'customer-a',
  displayName: 'Jamie Rivera',
  contactName: 'Jamie Rivera',
  email: 'jamie@example.com',
  phone: '555-0101',
  serviceAddressLine1: '12 Oak Lane',
  serviceAddressLine2: null,
  serviceAddressCity: 'Raleigh',
  serviceAddressRegion: 'NC',
  serviceAddressPostalCode: '27601',
  serviceAddressCountry: 'US',
  archivedAt: null,
  updatedAt: new Date('2026-10-01T12:00:00.000Z'),
}

const estimate = {
  id: 'estimate-a',
  workspaceId: 'ws-a',
  referenceNumber: 'EST-A',
  revisionNumber: 2,
  status: 'ACCEPTED',
  archivedAt: null,
  version: 4,
  title: 'Season kickoff',
  scopeDescription: 'Complete the cleanup and maintain weekly.',
  oneTimeSubtotalCents: 30_000,
  recurringPerVisitSubtotalCents: 8_000,
  currency: 'USD',
  customer,
  lead: null,
  operationalization: null,
  lineItems: [
    {
      id: 'line-one',
      title: 'Cleanup',
      description: 'Clean beds',
      billingBasis: 'ONE_TIME',
      amountCents: 30_000,
      sortOrder: 0,
    },
    {
      id: 'line-recurring',
      title: 'Weekly mowing',
      description: 'Mow and trim',
      billingBasis: 'PER_VISIT',
      amountCents: 8_000,
      sortOrder: 1,
    },
  ],
}

const rawInput = {
  expectedVersion: 4,
  idempotencyKey: '11111111-1111-4111-8111-111111111111',
  oneTime: {
    title: 'Kickoff Job',
    notes: 'Use side gate',
    priority: 'HIGH',
    assignments: [{ assignmentType: 'MEMBER', workspaceMemberId: 'member-a' }],
    lineItems: [
      {
        estimateLineItemId: 'line-one',
        createJobStep: true,
        stepTitle: 'Operational cleanup',
      },
    ],
  },
  recurring: [
    {
      estimateLineItemId: 'line-recurring',
      serviceInstructions: 'Close gate',
      priority: 'NORMAL',
      stepTemplates: [{ title: 'Mow', description: null }],
      schedule: {
        startsAt: '2026-10-05T13:00:00.000Z',
        endsAt: '2026-10-05T14:00:00.000Z',
        timezone: 'America/New_York',
        recurrenceRule: {
          frequency: 'weekly',
          interval: 1,
          daysOfWeek: [1],
          endType: 'never',
        },
        locationType: 'customerLocation',
        assignments: [{ assignmentType: 'TEAM', teamId: 'team-a' }],
      },
    },
  ],
}

const actor = {
  workspaceId: 'ws-a',
  userProfileId: 'profile-manager',
  actorUserId: 'profile-manager',
  workspaceMemberId: 'member-manager',
  canManageScheduling: true,
}

function completedRecord(requestHash = 'a'.repeat(64)) {
  return {
    id: 'handoff-a',
    workspaceId: 'ws-a',
    estimateId: 'estimate-a',
    referenceNumber: 'EST-A',
    customerId: 'customer-a',
    requestHash,
    idempotencyKey: rawInput.idempotencyKey,
    acceptedEstimateVersion: 4,
    operationalizedByUserId: 'profile-manager',
    operationalizedAt: new Date('2026-10-01T13:00:00.000Z'),
    createdAt: new Date('2026-10-01T13:00:00.000Z'),
    items: [
      {
        estimateLineItemId: 'line-one',
        targetKind: 'JOB',
        jobId: 'job-a',
        jobStepId: 'step-a',
        recurringServiceId: null,
      },
      {
        estimateLineItemId: 'line-recurring',
        targetKind: 'RECURRING_SERVICE',
        jobId: null,
        jobStepId: null,
        recurringServiceId: 'service-a',
      },
    ],
  }
}

function installTransaction() {
  const requestHash = hashEstimateOperationalizationRequest(
    estimateOperationalizationSchema.parse(rawInput),
  )
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 'estimate-a' }]),
    estimate: { findFirst: vi.fn().mockResolvedValue(estimate) },
    estimateOperationalization: {
      create: vi.fn().mockResolvedValue({ id: 'handoff-a' }),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue(completedRecord(requestHash)),
    },
    estimateOperationalizationItem: {
      createMany: vi.fn().mockResolvedValue({ count: 2 }),
    },
  }
  mocks.transaction.mockImplementation(async (callback) => callback(tx))
  return tx
}

describe('accepted Estimate operationalization orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.estimateFindFirst.mockResolvedValue(estimate)
    mocks.existingFindFirst.mockResolvedValue(null)
    mocks.prepareSchedule.mockResolvedValue({
      title: 'Weekly mowing',
      type: 'recurringServiceVisit',
      status: 'scheduled',
      startsAt: '2026-10-05T13:00:00.000Z',
      endsAt: '2026-10-05T14:00:00.000Z',
      timezone: 'America/New_York',
      assignedMemberIds: [],
      assignments: [{ assignmentType: 'TEAM', teamId: 'team-a' }],
      recurrenceRule: {
        frequency: 'weekly',
        interval: 1,
        daysOfWeek: [1],
        endType: 'never',
      },
      externalCalendarState: 'notConnected',
    })
    mocks.createJob.mockResolvedValue({
      id: 'job-a',
      workItems: [{ id: 'step-a', kind: 'JOB_STEP', sortOrder: 0 }],
    })
    mocks.createSchedule.mockResolvedValue({ recurrenceSeriesId: 'series-a' })
    mocks.resolveScheduleAssignments.mockResolvedValue({
      memberIdByInput: new Map(),
      teamNameById: new Map([['team-a', 'Team A']]),
    })
    mocks.createRecurring.mockResolvedValue({ id: 'service-a' })
  })

  it('creates mixed work atomically with server-derived economics and complete provenance', async () => {
    const tx = installTransaction()
    const result = await operationalizeAcceptedEstimate({
      actor,
      estimateId: 'estimate-a',
      rawInput,
    })
    expect(result).toMatchObject({
      jobId: 'job-a',
      recurringServiceIds: ['service-a'],
      replayed: false,
    })
    expect(mocks.resolveScheduleAssignments).toHaveBeenCalledTimes(1)
    expect(mocks.createJob).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        data: expect.objectContaining({
          valueCents: 30_000,
          currency: 'USD',
          schedulingEventId: null,
          status: 'OPEN',
          customerId: 'customer-a',
        }),
      }),
    )
    expect(mocks.createRecurring).toHaveBeenCalledWith(
      expect.objectContaining({
        tx,
        data: expect.objectContaining({
          pricePerVisitCents: 8_000,
          currency: 'USD',
          recurrenceSeriesId: 'series-a',
        }),
      }),
    )
    expect(tx.estimateOperationalizationItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          estimateLineItemId: 'line-one',
          targetKind: 'JOB',
          jobId: 'job-a',
          jobStepId: 'step-a',
        }),
        expect.objectContaining({
          estimateLineItemId: 'line-recurring',
          targetKind: 'RECURRING_SERVICE',
          recurringServiceId: 'service-a',
        }),
      ]),
    })
  })

  it('returns an identical persisted retry without starting another transaction', async () => {
    const first = installTransaction()
    await operationalizeAcceptedEstimate({
      actor,
      estimateId: 'estimate-a',
      rawInput,
    })
    const persisted =
      await first.estimateOperationalization.findUniqueOrThrow.mock.results[0]
        .value
    mocks.estimateFindFirst.mockResolvedValue({
      ...estimate,
      operationalization: persisted,
    })
    mocks.transaction.mockClear()
    const replay = await operationalizeAcceptedEstimate({
      actor,
      estimateId: 'estimate-a',
      rawInput,
    })
    expect(replay.replayed).toBe(true)
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('replays the original persisted request before applying a now-stale version check', async () => {
    const first = installTransaction()
    await operationalizeAcceptedEstimate({
      actor,
      estimateId: 'estimate-a',
      rawInput,
    })
    const persisted =
      await first.estimateOperationalization.findUniqueOrThrow.mock.results[0]
        .value
    mocks.estimateFindFirst.mockResolvedValue({
      ...estimate,
      version: estimate.version + 1,
      operationalization: persisted,
    })
    mocks.transaction.mockClear()

    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).resolves.toMatchObject({ replayed: true, jobId: 'job-a' })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('reconciles a concurrent identical winner and rejects a changed winner', async () => {
    const requestHash = hashEstimateOperationalizationRequest(
      estimateOperationalizationSchema.parse(rawInput),
    )
    mocks.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique winner', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    )
    mocks.existingFindFirst.mockResolvedValueOnce(completedRecord(requestHash))
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).resolves.toMatchObject({ replayed: true, jobId: 'job-a' })

    mocks.existingFindFirst.mockResolvedValueOnce(
      completedRecord('b'.repeat(64)),
    )
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_OPERATIONALIZED', status: 409 })
  })

  it('rejects a different persisted configuration and any family-level winner', async () => {
    mocks.estimateFindFirst.mockResolvedValueOnce({
      ...estimate,
      operationalization: completedRecord('b'.repeat(64)),
    })
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_OPERATIONALIZED', status: 409 })

    mocks.estimateFindFirst.mockResolvedValueOnce(estimate)
    mocks.existingFindFirst.mockResolvedValueOnce({
      ...completedRecord('b'.repeat(64)),
      estimateId: 'estimate-revision-a',
    })
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toMatchObject({ code: 'ALREADY_OPERATIONALIZED', status: 409 })
  })

  it.each(['DRAFT', 'PRESENTED', 'DECLINED', 'SUPERSEDED', 'VOIDED'])(
    'rejects %s lifecycle before starting a transaction',
    async (status) => {
      mocks.estimateFindFirst.mockResolvedValueOnce({ ...estimate, status })
      await expect(
        operationalizeAcceptedEstimate({
          actor,
          estimateId: 'estimate-a',
          rawInput,
        }),
      ).rejects.toMatchObject({ code: 'CONFLICT', status: 409 })
      expect(mocks.transaction).not.toHaveBeenCalled()
    },
  )

  it('resolves a converted Lead Customer and rejects an archived Customer', async () => {
    mocks.estimateFindFirst.mockResolvedValueOnce({
      ...estimate,
      customer: null,
      lead: { convertedCustomer: customer },
    })
    installTransaction().estimate.findFirst.mockResolvedValueOnce({
      ...estimate,
      customer: null,
      lead: { convertedCustomer: customer },
    })
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).resolves.toMatchObject({ customerId: 'customer-a' })

    mocks.estimateFindFirst.mockResolvedValueOnce({
      ...estimate,
      customer: { ...customer, archivedAt: new Date() },
    })
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_REQUIRED', status: 409 })
  })

  it('rejects stale Estimates and missing converted Customers before writes', async () => {
    mocks.estimateFindFirst.mockResolvedValueOnce({ ...estimate, version: 5 })
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toMatchObject({ code: 'STALE_ESTIMATE', status: 409 })
    mocks.estimateFindFirst.mockResolvedValueOnce({
      ...estimate,
      customer: null,
      lead: { convertedCustomer: null },
    })
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_REQUIRED', status: 409 })
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('does not create provenance or later recurring targets after a Job failure', async () => {
    const tx = installTransaction()
    mocks.createJob.mockRejectedValueOnce(new Error('injected Job failure'))
    await expect(
      operationalizeAcceptedEstimate({
        actor,
        estimateId: 'estimate-a',
        rawInput,
      }),
    ).rejects.toThrow('injected Job failure')
    expect(mocks.createSchedule).not.toHaveBeenCalled()
    expect(mocks.createRecurring).not.toHaveBeenCalled()
    expect(tx.estimateOperationalizationItem.createMany).not.toHaveBeenCalled()
  })
})
