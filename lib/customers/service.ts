import { z } from 'zod'

import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import type {
  CreateCustomerData,
  CustomerRecord,
  UpdateCustomerData,
} from '@/lib/customers/types'
import {
  createCustomerSchema,
  customerListQuerySchema,
  updateCustomerSchema,
} from '@/lib/customers/validation'

export class CustomerServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly code:
      | 'VALIDATION_ERROR'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'UNAVAILABLE'
      | 'CONFLICT',
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'CustomerServiceError'
  }
}

export type CustomerStore = {
  getWorkspaceBusinessModel(workspaceId: string): Promise<string | null>
  isWorkspaceMember(input: {
    workspaceId: string
    memberId: string
  }): Promise<boolean>
  createCustomer(data: CreateCustomerData): Promise<CustomerRecord>
  findCustomer(input: {
    workspaceId: string
    customerId: string
  }): Promise<CustomerRecord | null>
  listCustomers(input: {
    workspaceId: string
    search?: string
  }): Promise<CustomerRecord[]>
  updateCustomer(input: {
    workspaceId: string
    customerId: string
    data: UpdateCustomerData
  }): Promise<CustomerRecord | null>
  archiveCustomer(input: {
    workspaceId: string
    customerId: string
    archivedAt: Date
  }): Promise<CustomerRecord | null | { blockedByActiveRecurringService: true }>
}

export type CustomerActor = {
  workspaceId: string
  userProfileId: string
}

function validationError(error: z.ZodError) {
  return new CustomerServiceError(
    'The Customer request is invalid.',
    400,
    'VALIDATION_ERROR',
    error.flatten().fieldErrors,
  )
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input)
  if (!result.success) throw validationError(result.error)
  return result.data
}

function customerNotFound() {
  return new CustomerServiceError('Customer not found.', 404, 'NOT_FOUND')
}

async function assertEligible(store: CustomerStore, workspaceId: string) {
  const businessModel = await store.getWorkspaceBusinessModel(workspaceId)
  if (businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) return
  throw new CustomerServiceError(
    'Durable Customers are not available for this workspace model.',
    403,
    'UNAVAILABLE',
  )
}

async function assertAssignee(
  store: CustomerStore,
  workspaceId: string,
  assignedMemberId: string | null | undefined,
) {
  if (!assignedMemberId) return
  if (
    await store.isWorkspaceMember({
      workspaceId,
      memberId: assignedMemberId,
    })
  ) {
    return
  }
  throw new CustomerServiceError(
    'Assigned member is not a member of this workspace.',
    400,
    'VALIDATION_ERROR',
    { assignedMemberId: ['Choose a member of this workspace.'] },
  )
}

export function createCustomerService(
  store: CustomerStore,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date())

  return {
    async listCustomers(workspaceId: string, rawQuery: unknown = {}) {
      await assertEligible(store, workspaceId)
      const query = parse(customerListQuerySchema, rawQuery)
      return store.listCustomers({
        workspaceId,
        search: query.search || undefined,
      })
    },

    async getCustomer(workspaceId: string, customerId: string) {
      await assertEligible(store, workspaceId)
      return store.findCustomer({ workspaceId, customerId })
    },

    async createCustomer(actor: CustomerActor, rawInput: unknown) {
      await assertEligible(store, actor.workspaceId)
      const input = parse(createCustomerSchema, rawInput)
      await assertAssignee(store, actor.workspaceId, input.assignedMemberId)
      return store.createCustomer({
        workspaceId: actor.workspaceId,
        displayName: input.displayName,
        companyName: input.companyName ?? null,
        contactName: input.contactName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        serviceAddressLine1: input.serviceAddressLine1 ?? null,
        serviceAddressLine2: input.serviceAddressLine2 ?? null,
        serviceAddressCity: input.serviceAddressCity ?? null,
        serviceAddressRegion: input.serviceAddressRegion ?? null,
        serviceAddressPostalCode: input.serviceAddressPostalCode ?? null,
        serviceAddressCountry: input.serviceAddressCountry ?? null,
        notes: input.notes ?? null,
        assignedMemberId: input.assignedMemberId ?? null,
        createdByUserId: actor.userProfileId,
      })
    },

    async updateCustomer(
      actor: CustomerActor,
      customerId: string,
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const existing = await store.findCustomer({
        workspaceId: actor.workspaceId,
        customerId,
      })
      if (!existing) throw customerNotFound()
      const input = parse(updateCustomerSchema, rawInput)
      await assertAssignee(store, actor.workspaceId, input.assignedMemberId)
      const updated = await store.updateCustomer({
        workspaceId: actor.workspaceId,
        customerId,
        data: input,
      })
      if (!updated) throw customerNotFound()
      return updated
    },

    async archiveCustomer(actor: CustomerActor, customerId: string) {
      await assertEligible(store, actor.workspaceId)
      const archived = await store.archiveCustomer({
        workspaceId: actor.workspaceId,
        customerId,
        archivedAt: now(),
      })
      if (!archived) throw customerNotFound()
      if ('blockedByActiveRecurringService' in archived) {
        throw new CustomerServiceError(
          'End this Customer’s active Recurring Services before archiving the Customer.',
          409,
          'CONFLICT',
        )
      }
      return archived
    },
  }
}
