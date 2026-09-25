import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { $transaction: mocks.transaction },
}))

import { prismaLeadsStore } from '@/lib/leads/prismaStore'
import { LeadStage } from '@/lib/prisma/enums'

const CREATED_AT = new Date('2026-09-23T14:00:00.000Z')
const data = {
  workspaceId: 'workspace-a',
  displayName: 'Taylor Smith',
  companyName: 'Smith Landscaping',
  email: 'taylor@example.com',
  phone: null,
  stage: LeadStage.NEW,
  source: 'Referral',
  estimatedValueCents: null,
  currency: 'USD',
  nextStep: null,
  followUpAt: null,
  assignedMemberId: 'member-a',
  notes: null,
  createdByUserId: 'profile-a',
}

describe('Prisma Lead transactional outbox creation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('writes the Lead and immutable lead.created snapshot in one transaction', async () => {
    const tx = {
      lead: {
        create: vi.fn(async () => ({
          ...data,
          id: 'lead-a',
          convertedCustomerId: null,
          convertedAt: null,
          convertedCustomer: null,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
          archivedAt: null,
        })),
      },
      domainOutboxEvent: {
        create: vi.fn(async () => ({ id: 'event-a' })),
      },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaLeadsStore.createLead(data)

    expect(result).toMatchObject({
      lead: { id: 'lead-a' },
      eventId: 'event-a',
    })
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'workspace-a',
        topic: 'lead.created',
        aggregateType: 'Lead',
        aggregateId: 'lead-a',
        deduplicationKey: 'native:lead.created:workspace-a:lead-a',
        payload: {
          source: 'skillify-native',
          workspaceId: 'workspace-a',
          leadId: 'lead-a',
          displayName: 'Taylor Smith',
          companyName: 'Smith Landscaping',
          email: 'taylor@example.com',
          phone: null,
          leadSource: 'Referral',
          assignedMemberId: 'member-a',
          occurredAt: CREATED_AT.toISOString(),
        },
      }),
      select: { id: true },
    })
  })

  it('rejects the whole transactional operation when event insertion fails', async () => {
    const tx = {
      lead: {
        create: vi.fn(async () => ({
          ...data,
          id: 'lead-a',
          createdAt: CREATED_AT,
        })),
      },
      domainOutboxEvent: {
        create: vi.fn(async () => {
          throw new Error('outbox unavailable')
        }),
      },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(prismaLeadsStore.createLead(data)).rejects.toThrow(
      'outbox unavailable',
    )
    expect(tx.lead.create).toHaveBeenCalledOnce()
    expect(tx.domainOutboxEvent.create).toHaveBeenCalledOnce()
  })

  it('transactionally schedules an explicit follow-up when the recipe is active', async () => {
    const dueAt = new Date('2026-09-25T15:00:00.000Z')
    const tx = {
      lead: {
        create: vi.fn(async () => ({
          ...data,
          id: 'lead-a',
          followUpAt: dueAt,
          convertedCustomerId: null,
          convertedAt: null,
          convertedCustomer: null,
          createdAt: CREATED_AT,
          updatedAt: CREATED_AT,
          archivedAt: null,
        })),
      },
      simpleAutomationInstallation: {
        findFirst: vi.fn(async () => ({ id: 'installation-a' })),
      },
      domainOutboxEvent: {
        create: vi
          .fn()
          .mockResolvedValueOnce({ id: 'created-event-a' })
          .mockResolvedValueOnce({ id: 'follow-up-event-a' }),
      },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    const result = await prismaLeadsStore.createLead({
      ...data,
      followUpAt: dueAt,
    })

    expect(result.followUpEventId).toBe('follow-up-event-a')
    expect(tx.domainOutboxEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          topic: 'lead.follow_up_due',
          availableAt: dueAt,
          nextAttemptAt: dueAt,
        }),
      }),
    )
  })

  it('does not attempt event insertion when Lead creation fails', async () => {
    const tx = {
      lead: {
        create: vi.fn(async () => {
          throw new Error('lead insert failed')
        }),
      },
      domainOutboxEvent: {
        create: vi.fn(),
      },
    }
    mocks.transaction.mockImplementation(async (callback) => callback(tx))

    await expect(prismaLeadsStore.createLead(data)).rejects.toThrow(
      'lead insert failed',
    )
    expect(tx.domainOutboxEvent.create).not.toHaveBeenCalled()
  })
})
