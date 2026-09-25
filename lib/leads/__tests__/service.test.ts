import { beforeEach, describe, expect, it, vi } from 'vitest'

import { LeadStage, WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  createLeadService,
  LeadServiceError,
  type LeadsStore,
} from '@/lib/leads/service'
import type {
  CreateLeadData,
  ConvertedCustomerSummary,
  LeadRecord,
  UpdateLeadData,
} from '@/lib/leads/types'

const NOW = new Date('2026-09-23T12:00:00.000Z')

function createMemoryStore() {
  let sequence = 0
  const leads: LeadRecord[] = []
  const events: string[] = []
  const customers: Array<
    ConvertedCustomerSummary & {
      workspaceId: string
      contactName: string | null
      notes: string | null
      assignedMemberId: string | null
      createdByUserId: string
      serviceAddressLine1: string | null
    }
  > = []
  const models = new Map([
    ['ws-service', WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    ['ws-service-b', WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    ['ws-legacy', WorkspaceBusinessModel.DIRECT_SALES],
  ])
  const members = new Set(['ws-service:member-a', 'ws-service-b:member-b'])
  const calls: string[] = []
  const store: LeadsStore = {
    async getWorkspaceBusinessModel(workspaceId) {
      calls.push('getWorkspaceBusinessModel')
      return models.get(workspaceId) ?? null
    },
    async isWorkspaceMember({ workspaceId, memberId }) {
      calls.push('isWorkspaceMember')
      return members.has(`${workspaceId}:${memberId}`)
    },
    async createLead(data: CreateLeadData) {
      calls.push('createLead')
      const row: LeadRecord = {
        ...data,
        id: `lead-${++sequence}`,
        convertedCustomerId: null,
        convertedAt: null,
        convertedCustomer: null,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
      }
      leads.push(row)
      const eventId = `event-${sequence}`
      events.push(eventId)
      return { lead: row, eventId, followUpEventId: null }
    },
    async findLead({ workspaceId, leadId }) {
      calls.push('findLead')
      return (
        leads.find(
          (lead) =>
            lead.workspaceId === workspaceId &&
            lead.id === leadId &&
            !lead.archivedAt,
        ) ?? null
      )
    },
    async listLeads({ workspaceId, search, stage }) {
      calls.push('listLeads')
      const query = search?.toLowerCase()
      return leads.filter(
        (lead) =>
          lead.workspaceId === workspaceId &&
          !lead.archivedAt &&
          (!stage || lead.stage === stage) &&
          (!query ||
            [
              lead.displayName,
              lead.companyName,
              lead.email,
              lead.phone,
              lead.nextStep,
            ]
              .filter(Boolean)
              .join(' ')
              .toLowerCase()
              .includes(query)),
      )
    },
    async updateLead({ workspaceId, leadId, expectedStage, data }) {
      calls.push('updateLead')
      const index = leads.findIndex(
        (lead) =>
          lead.workspaceId === workspaceId &&
          lead.id === leadId &&
          !lead.archivedAt &&
          (expectedStage === undefined || lead.stage === expectedStage) &&
          !(
            data.stage !== undefined &&
            data.stage !== LeadStage.WON &&
            lead.convertedCustomerId
          ),
      )
      if (index < 0) return null
      leads[index] = { ...leads[index], ...data, updatedAt: NOW }
      return { lead: leads[index], followUpEventId: null }
    },
    async archiveLead({ workspaceId, leadId, archivedAt }) {
      calls.push('archiveLead')
      const lead = leads.find(
        (item) =>
          item.workspaceId === workspaceId &&
          item.id === leadId &&
          !item.archivedAt,
      )
      if (!lead) return null
      lead.archivedAt = archivedAt
      return lead
    },
    async convertLead(input) {
      if (
        models.get(input.workspaceId) !==
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
      ) {
        return { status: 'UNAVAILABLE' }
      }
      const lead = leads.find(
        (item) =>
          item.id === input.leadId && item.workspaceId === input.workspaceId,
      )
      if (!lead) return { status: 'NOT_FOUND' }
      if (lead.convertedCustomerId && lead.convertedCustomer) {
        return {
          status: 'ALREADY_CONVERTED',
          lead,
          customer: lead.convertedCustomer,
        }
      }
      if (lead.archivedAt) return { status: 'NOT_FOUND' }
      const normalizedEmail = lead.email?.trim().toLowerCase() || null
      const normalizedPhone = lead.phone?.replace(/\D/g, '') || null
      const candidates = customers.filter(
        (customer) =>
          customer.workspaceId === input.workspaceId &&
          ((normalizedEmail &&
            customer.email?.trim().toLowerCase() === normalizedEmail) ||
            (normalizedPhone &&
              customer.phone?.replace(/\D/g, '') === normalizedPhone)),
      )
      if (candidates.length && !input.confirmDuplicate) {
        return { status: 'DUPLICATE_WARNING', lead, candidates }
      }
      const customer = {
        id: `customer-${customers.length + 1}`,
        workspaceId: input.workspaceId,
        displayName: lead.companyName ?? lead.displayName,
        companyName: lead.companyName,
        contactName: lead.displayName,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        assignedMemberId: lead.assignedMemberId,
        createdByUserId: input.converterUserProfileId,
        serviceAddressLine1: null,
        archivedAt: null,
      }
      customers.push(customer)
      lead.stage = LeadStage.WON
      lead.convertedAt = input.convertedAt
      lead.convertedCustomerId = customer.id
      lead.convertedCustomer = customer
      return { status: 'SUCCESS', lead, customer }
    },
  }
  return { store, leads, customers, events, calls }
}

describe('durable Lead service', () => {
  let memory: ReturnType<typeof createMemoryStore>
  let service: ReturnType<typeof createLeadService>
  const actor = { workspaceId: 'ws-service', userProfileId: 'user-a' }

  beforeEach(() => {
    memory = createMemoryStore()
    service = createLeadService(memory.store, { now: () => NOW })
  })

  it('creates individual and business Leads with optional contact details and duplicate details', async () => {
    const first = await service.createLead(actor, {
      displayName: 'Taylor Smith',
      email: 'taylor@example.com',
      estimatedValueCents: 350_000,
      followUpAt: '2026-09-25T15:00:00.000Z',
      nextStep: 'Call about the estimate',
      assignedMemberId: 'member-a',
      source: 'Referral',
    })
    const second = await service.createLead(actor, {
      displayName: 'Taylor Smith',
      companyName: 'Smith Landscaping',
      email: 'taylor@example.com',
      phone: null,
    })

    expect(first).toMatchObject({
      stage: LeadStage.NEW,
      estimatedValueCents: 350_000,
      currency: 'USD',
      assignedMemberId: 'member-a',
      companyName: null,
    })
    expect(first.followUpAt).toEqual(new Date('2026-09-25T15:00:00.000Z'))
    expect(second.companyName).toBe('Smith Landscaping')
    expect(memory.leads).toHaveLength(2)
  })

  it('schedules post-commit event processing without coupling Lead success to delivery', async () => {
    const processCommittedEvent = vi
      .fn()
      .mockRejectedValue(new Error('worker unavailable'))
    const onEventProcessingError = vi.fn()
    service = createLeadService(memory.store, {
      processCommittedEvent,
      onEventProcessingError,
    })

    const lead = await service.createLead(actor, { displayName: 'New Lead' })

    expect(lead.id).toBe('lead-1')
    expect(processCommittedEvent).toHaveBeenCalledWith('event-1')
    await vi.waitFor(() =>
      expect(onEventProcessingError).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'worker unavailable' }),
      ),
    )
  })

  it('starts best-effort processing for newly committed follow-up work', async () => {
    const lead = await service.createLead(actor, { displayName: 'Due Lead' })
    const updateLead = memory.store.updateLead.bind(memory.store)
    memory.store.updateLead = vi.fn(async (input) => {
      const result = await updateLead(input)
      return result ? { ...result, followUpEventId: 'follow-up-event-1' } : null
    })
    const processCommittedEvent = vi.fn(async () => undefined)
    service = createLeadService(memory.store, { processCommittedEvent })

    await service.updateLead(actor, lead.id, {
      followUpAt: '2026-09-25T15:00:00.000Z',
    })

    await vi.waitFor(() =>
      expect(processCommittedEvent).toHaveBeenCalledWith('follow-up-event-1'),
    )
  })

  it('rejects client-controlled event and workspace fields', async () => {
    await expect(
      service.createLead(actor, {
        displayName: 'Injected Lead',
        workspaceId: 'ws-service-b',
        eventType: 'lead.created',
        eventPayload: { leadId: 'forged' },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    expect(memory.leads).toHaveLength(0)
    expect(memory.events).toHaveLength(0)
  })

  it('does not emit another creation event for edit, stage change, archive, or conversion', async () => {
    const edited = await service.createLead(actor, { displayName: 'Edited' })
    await service.updateLead(actor, edited.id, { displayName: 'Edited Again' })
    await service.updateLead(actor, edited.id, { stage: LeadStage.CONTACTED })
    await service.archiveLead(actor, edited.id)

    const converted = await service.createLead(actor, {
      displayName: 'Converted',
    })
    await service.convertLeadToCustomer(actor, converted.id, {})

    expect(memory.events).toEqual(['event-1', 'event-2'])
  })

  it('rejects foreign assignments and unsupported workspace models', async () => {
    await expect(
      service.createLead(actor, {
        displayName: 'Foreign owner',
        assignedMemberId: 'member-b',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    await expect(
      service.createLead(
        { workspaceId: 'ws-legacy', userProfileId: 'user-a' },
        { displayName: 'Legacy Lead' },
      ),
    ).rejects.toMatchObject({ status: 403, code: 'UNAVAILABLE' })
  })

  it('supports the Simple Service lifecycle and leaves Won independent of Customers', async () => {
    let lead = await service.createLead(actor, {
      displayName: 'Lifecycle Lead',
    })
    for (const stage of [
      LeadStage.CONTACTED,
      LeadStage.ESTIMATE_VISIT,
      LeadStage.FOLLOW_UP,
      LeadStage.WON,
    ]) {
      lead = await service.updateLead(actor, lead.id, { stage })
    }
    expect(lead.stage).toBe(LeadStage.WON)
    expect(lead).not.toHaveProperty('customerId')
    expect(memory.calls).not.toContain('createCustomer')
    expect(memory.calls).not.toContain('createJob')
    expect(memory.calls).not.toContain('createRevenueTransaction')
    expect(memory.calls).not.toContain('createSchedulingEvent')
    expect(memory.calls).not.toContain('dispatchAutomation')

    expect(
      (await service.updateLead(actor, lead.id, { stage: LeadStage.LOST }))
        .stage,
    ).toBe(LeadStage.LOST)
  })

  it('validates stage values', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Invalid stage',
    })
    await expect(
      service.updateLead(actor, lead.id, { stage: 'QUALIFIED' }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    })
  })

  it('returns a conflict when a concurrent stage change wins', async () => {
    const lead = await service.createLead(actor, { displayName: 'Race Lead' })
    const racingStore: LeadsStore = {
      ...memory.store,
      async updateLead(input) {
        const stored = memory.leads.find((item) => item.id === input.leadId)!
        stored.stage = LeadStage.FOLLOW_UP
        return memory.store.updateLead(input)
      },
    }
    const racingService = createLeadService(racingStore)
    await expect(
      racingService.updateLead(actor, lead.id, {
        stage: LeadStage.NEW,
        notes: 'A full-form edit with the originally read stage.',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
  })

  it('cannot move a concurrently converted Won Lead back to another stage', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Won Race Lead',
      stage: LeadStage.WON,
    })
    const racingStore: LeadsStore = {
      ...memory.store,
      async updateLead(input) {
        await memory.store.convertLead({
          workspaceId: input.workspaceId,
          leadId: input.leadId,
          converterUserProfileId: 'user-b',
          confirmDuplicate: true,
          convertedAt: NOW,
        })
        return memory.store.updateLead(input)
      },
    }
    const racingService = createLeadService(racingStore)
    await expect(
      racingService.updateLead(actor, lead.id, {
        stage: LeadStage.FOLLOW_UP,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
    expect(lead.stage).toBe(LeadStage.WON)
    expect(lead.convertedCustomerId).not.toBeNull()
  })

  it('scopes reads, search, and stage filters to the workspace', async () => {
    await service.createLead(actor, {
      displayName: 'Alpha Lawn',
      stage: LeadStage.NEW,
    })
    await service.createLead(actor, {
      displayName: 'Beta Lawn',
      stage: LeadStage.CONTACTED,
    })
    const otherService = createLeadService(memory.store)
    await otherService.createLead(
      { workspaceId: 'ws-service-b', userProfileId: 'user-b' },
      { displayName: 'Alpha Foreign' },
    )
    expect(
      await service.listLeads('ws-service', { search: 'Alpha' }),
    ).toHaveLength(1)
    expect(
      await service.listLeads('ws-service', { stage: LeadStage.CONTACTED }),
    ).toHaveLength(1)
    expect(await service.getLead('ws-service-b', memory.leads[0].id)).toBeNull()
  })

  it('soft archives Leads, excludes them from active reads, and has no domain side effects', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Archive Lead',
    })
    const archived = await service.archiveLead(actor, lead.id)
    expect(archived.archivedAt).toEqual(NOW)
    expect(await service.listLeads('ws-service')).toEqual([])
    await expect(
      service.updateLead(actor, lead.id, { notes: 'Too late' }),
    ).rejects.toMatchObject({ status: 404 })
    expect(memory.calls).not.toContain('createCustomer')
    expect(memory.calls).not.toContain('archiveJob')
  })

  it.each([
    LeadStage.NEW,
    LeadStage.CONTACTED,
    LeadStage.ESTIMATE_VISIT,
    LeadStage.FOLLOW_UP,
    LeadStage.WON,
  ])('explicitly converts an active %s Lead and ends Won', async (stage) => {
    const lead = await service.createLead(actor, {
      displayName: 'Jamie Rivera',
      companyName: 'Rivera Landscaping',
      email: 'jamie@example.com',
      phone: '(555) 010-1000',
      stage,
      source: 'Referral',
      estimatedValueCents: 500_000,
      nextStep: 'Send proposal',
      followUpAt: '2026-10-01T12:00:00.000Z',
      assignedMemberId: 'member-a',
      notes: 'Prefers text messages.',
    })

    const result = await service.convertLeadToCustomer(
      { workspaceId: actor.workspaceId, userProfileId: 'converter-b' },
      lead.id,
      {},
    )

    expect(result.status).toBe('SUCCESS')
    if (result.status !== 'SUCCESS') throw new Error('Expected conversion')
    expect(result.lead).toMatchObject({
      stage: LeadStage.WON,
      createdByUserId: 'user-a',
      convertedAt: NOW,
      convertedCustomerId: result.customer.id,
    })
    expect(memory.customers[0]).toMatchObject({
      displayName: 'Rivera Landscaping',
      companyName: 'Rivera Landscaping',
      contactName: 'Jamie Rivera',
      email: 'jamie@example.com',
      phone: '(555) 010-1000',
      notes: 'Prefers text messages.',
      assignedMemberId: 'member-a',
      createdByUserId: 'converter-b',
      serviceAddressLine1: null,
    })
    expect(memory.customers[0]).not.toHaveProperty('estimatedValueCents')
    expect(memory.customers[0]).not.toHaveProperty('source')
    expect(memory.customers[0]).not.toHaveProperty('followUpAt')
  })

  it('uses the person-facing display name for an individual Customer', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Jordan Lee',
    })
    await service.convertLeadToCustomer(actor, lead.id, {})
    expect(memory.customers[0]).toMatchObject({
      displayName: 'Jordan Lee',
      companyName: null,
      contactName: 'Jordan Lee',
    })
  })

  it('warns on normalized email or phone, mutates nothing, then converts on explicit confirmation', async () => {
    const first = await service.createLead(actor, {
      displayName: 'First Contact',
      email: 'match@example.com',
    })
    await service.convertLeadToCustomer(actor, first.id, {})
    const lead = await service.createLead(actor, {
      displayName: 'Possible Duplicate',
      email: ' MATCH@example.com ',
      phone: '555-0200',
    })

    const warning = await service.convertLeadToCustomer(actor, lead.id, {})
    expect(warning.status).toBe('DUPLICATE_WARNING')
    expect(memory.customers).toHaveLength(1)
    expect(lead.convertedCustomerId).toBeNull()
    expect(lead.stage).toBe(LeadStage.NEW)

    const confirmed = await service.convertLeadToCustomer(actor, lead.id, {
      confirmDuplicate: true,
    })
    expect(confirmed.status).toBe('SUCCESS')
    expect(memory.customers).toHaveLength(2)
  })

  it('warns on normalized phone even when email does not match', async () => {
    const first = await service.createLead(actor, {
      displayName: 'Phone Customer',
      phone: '+1 (919) 555-0144',
    })
    await service.convertLeadToCustomer(actor, first.id, {})
    const lead = await service.createLead(actor, {
      displayName: 'Phone Match',
      email: 'different@example.com',
      phone: '1-919-555-0144',
    })
    await expect(
      service.convertLeadToCustomer(actor, lead.id, {}),
    ).resolves.toMatchObject({ status: 'DUPLICATE_WARNING' })
    expect(memory.customers).toHaveLength(1)
  })

  it('rejects client-supplied Customer fields in conversion intent', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Server Snapshot',
    })
    await expect(
      service.convertLeadToCustomer(actor, lead.id, {
        confirmDuplicate: false,
        displayName: 'Forged Customer',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    expect(memory.customers).toHaveLength(0)
  })

  it('is idempotent, preserves convertedAt, and never replaces an archived converted Customer', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Idempotent Lead',
    })
    const first = await service.convertLeadToCustomer(actor, lead.id, {})
    expect(first.status).toBe('SUCCESS')
    const originalConvertedAt = lead.convertedAt
    memory.customers[0].archivedAt = new Date('2026-09-24T12:00:00.000Z')
    lead.convertedCustomer!.archivedAt = memory.customers[0].archivedAt

    const repeated = await service.convertLeadToCustomer(actor, lead.id, {})
    expect(repeated.status).toBe('ALREADY_CONVERTED')
    expect(memory.customers).toHaveLength(1)
    expect(lead.convertedAt).toBe(originalConvertedAt)
    if (repeated.status === 'ALREADY_CONVERTED') {
      expect(repeated.customer.archivedAt).not.toBeNull()
    }
  })

  it('keeps converted Leads Won while allowing independent non-stage edits and archival', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Historical Lead',
      email: 'before@example.com',
    })
    await service.convertLeadToCustomer(actor, lead.id, {})
    await expect(
      service.updateLead(actor, lead.id, { stage: LeadStage.FOLLOW_UP }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })

    const edited = await service.updateLead(actor, lead.id, {
      email: 'after@example.com',
    })
    expect(edited.email).toBe('after@example.com')
    expect(memory.customers[0].email).toBe('before@example.com')
    await service.archiveLead(actor, lead.id)
    expect(memory.customers[0].archivedAt).toBeNull()
    expect(lead.convertedCustomerId).toBe(memory.customers[0].id)
  })

  it('fails closed for archived, foreign, and unsupported Lead conversion', async () => {
    const archived = await service.createLead(actor, {
      displayName: 'Archived Lead',
    })
    await service.archiveLead(actor, archived.id)
    await expect(
      service.convertLeadToCustomer(actor, archived.id, {}),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      service.convertLeadToCustomer(actor, 'lead-foreign', {}),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      service.convertLeadToCustomer(
        { workspaceId: 'ws-legacy', userProfileId: 'user-a' },
        archived.id,
        {},
      ),
    ).rejects.toMatchObject({ status: 403, code: 'UNAVAILABLE' })
  })

  it('resolves concurrent repeated commands to one Customer', async () => {
    const lead = await service.createLead(actor, {
      displayName: 'Concurrent Lead',
    })
    const results = await Promise.all([
      service.convertLeadToCustomer(actor, lead.id, {}),
      service.convertLeadToCustomer(actor, lead.id, {}),
    ])
    expect(memory.customers).toHaveLength(1)
    expect(results.map((result) => result.status).sort()).toEqual([
      'ALREADY_CONVERTED',
      'SUCCESS',
    ])
  })
})
