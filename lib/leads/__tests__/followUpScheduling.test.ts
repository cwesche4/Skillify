import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { prismaLeadsStore } from '@/lib/leads/prismaStore'
import { LeadStage } from '@/lib/prisma/enums'

const OLD_DUE = new Date('2026-09-25T14:00:00.000Z')
const NEW_DUE = new Date('2026-09-28T18:00:00.000Z')
const UPDATED_AT = new Date('2026-09-23T19:00:00.000Z')

function lead(followUpAt: Date | null) {
  return {
    id: 'lead-a',
    workspaceId: 'workspace-a',
    displayName: 'Taylor Smith',
    companyName: null,
    email: 'taylor@example.com',
    phone: null,
    stage: LeadStage.FOLLOW_UP,
    source: 'Referral',
    estimatedValueCents: null,
    currency: 'USD',
    nextStep: 'Call about the estimate',
    followUpAt,
    assignedMemberId: 'member-a',
    notes: null,
    convertedCustomerId: null,
    convertedAt: null,
    convertedCustomer: null,
    createdByUserId: 'profile-a',
    createdAt: new Date('2026-09-20T12:00:00.000Z'),
    updatedAt: UPDATED_AT,
    archivedAt: null,
  }
}

function updateTransaction(input: {
  before?: Date | null
  after?: Date | null
  active?: boolean
  eventError?: Error
}) {
  const before = input.before === undefined ? OLD_DUE : input.before
  const after = input.after === undefined ? NEW_DUE : input.after
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'lead-a' }]),
    lead: {
      findFirst: vi
        .fn()
        .mockResolvedValueOnce({
          stage: LeadStage.FOLLOW_UP,
          followUpAt: before,
        })
        .mockResolvedValueOnce(lead(after)),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    simpleAutomationInstallation: {
      findFirst: vi.fn(async () =>
        input.active === false ? null : { id: 'installation-a' },
      ),
    },
    domainOutboxEvent: {
      create: vi.fn(async (_input: unknown) => {
        if (input.eventError) throw input.eventError
        return { id: 'follow-up-event-a' }
      }),
    },
  }
  mocks.transaction.mockImplementation(async (...args) => {
    const callback = args[0]
    if (typeof callback !== 'function') {
      throw new Error(
        `Expected transaction callback, received ${typeof callback}`,
      )
    }
    return callback(tx)
  })
  return tx
}

describe('transactional durable Lead follow-up scheduling', () => {
  beforeEach(() => {
    mocks.transaction.mockReset()
  })

  it('creates future delayed work in the same transaction as a changed followUpAt', async () => {
    const tx = updateTransaction({})

    const result = await prismaLeadsStore.updateLead({
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      data: { followUpAt: NEW_DUE },
    })

    expect(result).toMatchObject({
      lead: { id: 'lead-a', followUpAt: NEW_DUE },
      followUpEventId: 'follow-up-event-a',
    })
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-a',
        topic: 'lead.follow_up_due',
        aggregateType: 'Lead',
        aggregateId: 'lead-a',
        availableAt: NEW_DUE,
        nextAttemptAt: NEW_DUE,
        deduplicationKey: expect.stringMatching(
          /^native:lead\.follow-up:workspace-a:lead-a:/,
        ),
        payload: expect.objectContaining({
          source: 'skillify-native',
          leadId: 'lead-a',
          scheduledFor: NEW_DUE.toISOString(),
          scheduleRevision: expect.any(String),
        }),
      }),
      select: { id: true },
    })
  })

  it('does not duplicate an identical followUpAt mutation', async () => {
    const tx = updateTransaction({ before: NEW_DUE, after: NEW_DUE })

    const result = await prismaLeadsStore.updateLead({
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      data: { followUpAt: NEW_DUE },
    })

    expect(result?.followUpEventId).toBeNull()
    expect(tx.simpleAutomationInstallation.findFirst).not.toHaveBeenCalled()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('gives a rescheduled occurrence a distinct durable revision identity', async () => {
    const firstTx = updateTransaction({})
    await prismaLeadsStore.updateLead({
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      data: { followUpAt: NEW_DUE },
    })
    const firstInput = firstTx.domainOutboxEvent.create.mock.calls[0]?.[0] as {
      data: { deduplicationKey: string }
    }
    const firstKey = firstInput.data.deduplicationKey

    const laterDue = new Date('2026-10-01T16:00:00.000Z')
    const secondTx = updateTransaction({ before: NEW_DUE, after: laterDue })
    await prismaLeadsStore.updateLead({
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      data: { followUpAt: laterDue },
    })
    const secondInput = secondTx.domainOutboxEvent.create.mock
      .calls[0]?.[0] as {
      data: { deduplicationKey: string }
    }
    const secondKey = secondInput.data.deduplicationKey

    expect(secondKey).not.toBe(firstKey)
  })

  it('clearing followUpAt creates no replacement work', async () => {
    const tx = updateTransaction({ after: null })

    const result = await prismaLeadsStore.updateLead({
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      data: { followUpAt: null },
    })

    expect(result?.followUpEventId).toBeNull()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('does not create delayed work while the automation is absent or paused', async () => {
    const tx = updateTransaction({ active: false })

    const result = await prismaLeadsStore.updateLead({
      workspaceId: 'workspace-a',
      leadId: 'lead-a',
      data: { followUpAt: NEW_DUE },
    })

    expect(result?.followUpEventId).toBeNull()
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })

  it('rejects the transactional mutation if delayed-work insertion fails', async () => {
    const tx = updateTransaction({
      eventError: new Error('outbox unavailable'),
    })

    await expect(
      prismaLeadsStore.updateLead({
        workspaceId: 'workspace-a',
        leadId: 'lead-a',
        data: { followUpAt: NEW_DUE },
      }),
    ).rejects.toThrow('outbox unavailable')
    expect(tx.lead.updateMany).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledOnce()
  })
})
