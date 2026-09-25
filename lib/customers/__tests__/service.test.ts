import { beforeEach, describe, expect, it } from 'vitest'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  createCustomerService,
  CustomerServiceError,
  type CustomerStore,
} from '@/lib/customers/service'
import type {
  CreateCustomerData,
  CustomerRecord,
  UpdateCustomerData,
} from '@/lib/customers/types'

const NOW = new Date('2026-09-22T18:00:00.000Z')

function createMemoryStore() {
  let sequence = 0
  const customers: CustomerRecord[] = []
  const calls: string[] = []
  const models = new Map([
    ['ws-service', WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    ['ws-service-b', WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS],
    ['ws-direct', WorkspaceBusinessModel.DIRECT_SALES],
    ['ws-consultative', WorkspaceBusinessModel.CONSULTATIVE_SALES],
    ['ws-commerce', WorkspaceBusinessModel.PRODUCT_COMMERCE],
  ])
  const members = new Set([
    'ws-service:member-service',
    'ws-direct:member-direct',
  ])

  const store: CustomerStore = {
    async getWorkspaceBusinessModel(workspaceId) {
      calls.push('getWorkspaceBusinessModel')
      return models.get(workspaceId) ?? null
    },
    async isWorkspaceMember({ workspaceId, memberId }) {
      calls.push('isWorkspaceMember')
      return members.has(`${workspaceId}:${memberId}`)
    },
    async createCustomer(data: CreateCustomerData) {
      calls.push('createCustomer')
      const row: CustomerRecord = {
        ...data,
        id: `customer-${++sequence}`,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
      }
      customers.push(row)
      return row
    },
    async findCustomer({ workspaceId, customerId }) {
      calls.push('findCustomer')
      return (
        customers.find(
          (customer) =>
            customer.id === customerId &&
            customer.workspaceId === workspaceId &&
            customer.archivedAt === null,
        ) ?? null
      )
    },
    async listCustomers({ workspaceId, search }) {
      calls.push('listCustomers')
      const query = search?.toLowerCase()
      return customers
        .filter(
          (customer) =>
            customer.workspaceId === workspaceId &&
            customer.archivedAt === null &&
            (!query ||
              [
                customer.displayName,
                customer.companyName,
                customer.contactName,
                customer.email,
                customer.phone,
              ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase()
                .includes(query)),
        )
        .sort(
          (first, second) =>
            first.displayName.localeCompare(second.displayName) ||
            first.id.localeCompare(second.id),
        )
    },
    async updateCustomer({ workspaceId, customerId, data }) {
      calls.push('updateCustomer')
      const index = customers.findIndex(
        (customer) =>
          customer.id === customerId &&
          customer.workspaceId === workspaceId &&
          customer.archivedAt === null,
      )
      if (index < 0) return null
      customers[index] = { ...customers[index], ...data, updatedAt: NOW }
      return customers[index]
    },
    async archiveCustomer({ workspaceId, customerId, archivedAt }) {
      calls.push('archiveCustomer')
      const customer = customers.find(
        (candidate) =>
          candidate.id === customerId &&
          candidate.workspaceId === workspaceId &&
          candidate.archivedAt === null,
      )
      if (!customer) return null
      customer.archivedAt = archivedAt
      customer.updatedAt = NOW
      return customer
    },
  }

  return { store, customers, calls }
}

describe('durable Customer service', () => {
  let memory: ReturnType<typeof createMemoryStore>
  let service: ReturnType<typeof createCustomerService>
  const actor = {
    workspaceId: 'ws-service',
    userProfileId: 'profile-manager',
  }

  beforeEach(() => {
    memory = createMemoryStore()
    service = createCustomerService(memory.store, { now: () => NOW })
  })

  it('creates individual and business Customers with optional contact fields', async () => {
    const individual = await service.createCustomer(actor, {
      displayName: '  John Smith  ',
    })
    const business = await service.createCustomer(actor, {
      displayName: 'ABC Property Management',
      companyName: 'ABC Property Management',
      contactName: 'John Smith',
      email: 'john@example.com',
      phone: '555-0100',
      serviceAddressLine1: '123 Main St',
      serviceAddressCity: 'Charlotte',
      serviceAddressRegion: 'NC',
      serviceAddressPostalCode: '28202',
      assignedMemberId: 'member-service',
    })

    expect(individual).toMatchObject({
      displayName: 'John Smith',
      companyName: null,
      email: null,
      phone: null,
      assignedMemberId: null,
      createdByUserId: 'profile-manager',
    })
    expect(business).toMatchObject({
      companyName: 'ABC Property Management',
      contactName: 'John Smith',
      assignedMemberId: 'member-service',
    })
  })

  it('permits duplicate email and phone values', async () => {
    await service.createCustomer(actor, {
      displayName: 'Rivera Household',
      email: 'shared@example.com',
      phone: '555-0199',
    })
    await service.createCustomer(actor, {
      displayName: 'Rivera Rental',
      email: 'shared@example.com',
      phone: '555-0199',
    })

    expect(memory.customers).toHaveLength(2)
  })

  it('rejects empty names, malformed email, forbidden fields, and unknown fields', async () => {
    await expect(
      service.createCustomer(actor, { displayName: '   ' }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    await expect(
      service.createCustomer(actor, {
        displayName: 'Bad Email',
        email: 'not-an-email',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })

    const customer = await service.createCustomer(actor, {
      displayName: 'Valid Customer',
    })
    for (const payload of [
      { workspaceId: 'ws-direct' },
      { createdByUserId: 'attacker' },
      { archivedAt: NOW.toISOString() },
      { unexpected: true },
    ]) {
      await expect(
        service.updateCustomer(actor, customer.id, payload),
      ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    }
  })

  it('rejects cross-workspace assignment on create and update', async () => {
    await expect(
      service.createCustomer(actor, {
        displayName: 'Wrong assignment',
        assignedMemberId: 'member-direct',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })

    const customer = await service.createCustomer(actor, {
      displayName: 'Unassigned',
    })
    await expect(
      service.updateCustomer(actor, customer.id, {
        assignedMemberId: 'member-direct',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('supports assignment, unassignment, search, and workspace isolation', async () => {
    const customer = await service.createCustomer(actor, {
      displayName: 'Greenway HOA',
      contactName: 'Avery Green',
    })
    const assigned = await service.updateCustomer(actor, customer.id, {
      assignedMemberId: 'member-service',
      notes: 'Commercial entrance service.',
    })
    expect(assigned.assignedMemberId).toBe('member-service')
    const unassigned = await service.updateCustomer(actor, customer.id, {
      assignedMemberId: null,
    })
    expect(unassigned.assignedMemberId).toBeNull()
    const foreignActor = {
      workspaceId: 'ws-service-b',
      userProfileId: 'profile-service-b',
    }
    expect(await service.getCustomer('ws-service-b', customer.id)).toBeNull()
    await expect(
      service.updateCustomer(foreignActor, customer.id, {
        displayName: 'Foreign edit',
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
    expect(await service.getCustomer('ws-service', customer.id)).not.toBeNull()
    expect(
      await service.listCustomers('ws-service', { search: 'avery' }),
    ).toHaveLength(1)
  })

  it.each([
    WorkspaceBusinessModel.DIRECT_SALES,
    WorkspaceBusinessModel.CONSULTATIVE_SALES,
    WorkspaceBusinessModel.PRODUCT_COMMERCE,
  ])('rejects unsupported workspace model %s', async (businessModel) => {
    const workspaceId =
      businessModel === WorkspaceBusinessModel.DIRECT_SALES
        ? 'ws-direct'
        : businessModel === WorkspaceBusinessModel.CONSULTATIVE_SALES
          ? 'ws-consultative'
          : 'ws-commerce'
    await expect(service.listCustomers(workspaceId)).rejects.toMatchObject({
      status: 403,
      code: 'UNAVAILABLE',
    })
  })

  it('archives without erasing data and makes repeated archive deterministic', async () => {
    const customer = await service.createCustomer(actor, {
      displayName: 'Archive Me',
      email: 'archive@example.com',
      notes: 'Keep this history.',
      assignedMemberId: 'member-service',
    })
    const archived = await service.archiveCustomer(actor, customer.id)

    expect(archived).toMatchObject({
      email: 'archive@example.com',
      notes: 'Keep this history.',
      assignedMemberId: 'member-service',
      archivedAt: NOW,
    })
    expect(await service.getCustomer('ws-service', customer.id)).toBeNull()
    expect(await service.listCustomers('ws-service')).toEqual([])
    await expect(
      service.updateCustomer(actor, customer.id, { displayName: 'Nope' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
    await expect(
      service.archiveCustomer(actor, customer.id),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('does not call Jobs, Revenue, Scheduling, or Automation boundaries', async () => {
    await service.createCustomer(actor, { displayName: 'Isolated Customer' })
    await service.archiveCustomer(actor, 'customer-1')
    expect(memory.calls).not.toContain('createJob')
    expect(memory.calls).not.toContain('createRevenueTransaction')
    expect(memory.calls).not.toContain('createSchedulingEvent')
    expect(memory.calls).not.toContain('dispatchAutomation')
  })
})
