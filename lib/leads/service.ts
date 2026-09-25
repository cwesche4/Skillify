import { z } from 'zod'

import { LeadStage, WorkspaceBusinessModel } from '@/lib/prisma/enums'
import type {
  CreateLeadData,
  CreateLeadResult,
  LeadConversionResult,
  LeadRecord,
  UpdateLeadResult,
  UpdateLeadData,
} from '@/lib/leads/types'
import {
  convertLeadSchema,
  createLeadSchema,
  leadListQuerySchema,
  updateLeadSchema,
} from '@/lib/leads/validation'

export class LeadServiceError extends Error {
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
    this.name = 'LeadServiceError'
  }
}

export type LeadsStore = {
  getWorkspaceBusinessModel(workspaceId: string): Promise<string | null>
  isWorkspaceMember(input: {
    workspaceId: string
    memberId: string
  }): Promise<boolean>
  createLead(data: CreateLeadData): Promise<CreateLeadResult>
  findLead(input: {
    workspaceId: string
    leadId: string
  }): Promise<LeadRecord | null>
  listLeads(input: {
    workspaceId: string
    search?: string
    stage?: LeadStage
  }): Promise<LeadRecord[]>
  updateLead(input: {
    workspaceId: string
    leadId: string
    expectedStage?: LeadStage
    data: UpdateLeadData
  }): Promise<UpdateLeadResult | null>
  archiveLead(input: {
    workspaceId: string
    leadId: string
    archivedAt: Date
  }): Promise<LeadRecord | null>
  convertLead(input: {
    workspaceId: string
    leadId: string
    converterUserProfileId: string
    confirmDuplicate: boolean
    convertedAt: Date
  }): Promise<LeadConversionResult | { status: 'NOT_FOUND' | 'UNAVAILABLE' }>
}

export type LeadActor = { workspaceId: string; userProfileId: string }

function parse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown,
): T {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new LeadServiceError(
      'The Lead request is invalid.',
      400,
      'VALIDATION_ERROR',
      result.error.flatten().fieldErrors,
    )
  }
  return result.data
}

function notFound() {
  return new LeadServiceError('Lead not found.', 404, 'NOT_FOUND')
}

async function assertEligible(store: LeadsStore, workspaceId: string) {
  const model = await store.getWorkspaceBusinessModel(workspaceId)
  if (model === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) return
  throw new LeadServiceError(
    'Durable Leads are not available for this workspace model.',
    403,
    'UNAVAILABLE',
  )
}

async function assertAssignee(
  store: LeadsStore,
  workspaceId: string,
  assignedMemberId: string | null | undefined,
) {
  if (!assignedMemberId) return
  if (
    await store.isWorkspaceMember({ workspaceId, memberId: assignedMemberId })
  )
    return
  throw new LeadServiceError(
    'Assigned member is not a member of this workspace.',
    400,
    'VALIDATION_ERROR',
    { assignedMemberId: ['Choose a member of this workspace.'] },
  )
}

export function createLeadService(
  store: LeadsStore,
  options: {
    now?: () => Date
    processCommittedEvent?: (eventId: string) => Promise<unknown>
    onEventProcessingError?: (error: unknown) => void
  } = {},
) {
  const now = options.now ?? (() => new Date())

  return {
    async listLeads(workspaceId: string, rawQuery: unknown = {}) {
      await assertEligible(store, workspaceId)
      const query = parse(leadListQuerySchema, rawQuery)
      return store.listLeads({
        workspaceId,
        search: query.search || undefined,
        stage: query.stage,
      })
    },

    async getLead(workspaceId: string, leadId: string) {
      await assertEligible(store, workspaceId)
      return store.findLead({ workspaceId, leadId })
    },

    async createLead(actor: LeadActor, rawInput: unknown) {
      await assertEligible(store, actor.workspaceId)
      const input = parse(createLeadSchema, rawInput)
      await assertAssignee(store, actor.workspaceId, input.assignedMemberId)
      const created = await store.createLead({
        workspaceId: actor.workspaceId,
        displayName: input.displayName,
        companyName: input.companyName ?? null,
        email: input.email ?? null,
        phone: input.phone ?? null,
        stage: input.stage ?? LeadStage.NEW,
        source: input.source ?? null,
        estimatedValueCents: input.estimatedValueCents ?? null,
        currency: input.currency ?? 'USD',
        nextStep: input.nextStep ?? null,
        followUpAt: input.followUpAt ?? null,
        assignedMemberId: input.assignedMemberId ?? null,
        notes: input.notes ?? null,
        createdByUserId: actor.userProfileId,
      })
      if (options.processCommittedEvent) {
        // Delivery is deliberately post-commit and detached from the user
        // request. The durable event is recoverable by the bounded worker if
        // this best-effort immediate attempt never runs or fails.
        void Promise.resolve()
          .then(() => options.processCommittedEvent!(created.eventId))
          .catch((error) => options.onEventProcessingError?.(error))
        if (created.followUpEventId) {
          void Promise.resolve()
            .then(() =>
              options.processCommittedEvent!(created.followUpEventId!),
            )
            .catch((error) => options.onEventProcessingError?.(error))
        }
      }
      return created.lead
    },

    async updateLead(actor: LeadActor, leadId: string, rawInput: unknown) {
      await assertEligible(store, actor.workspaceId)
      const existing = await store.findLead({
        workspaceId: actor.workspaceId,
        leadId,
      })
      if (!existing) throw notFound()
      const input = parse(updateLeadSchema, rawInput)
      if (
        existing.convertedCustomerId &&
        input.stage !== undefined &&
        input.stage !== LeadStage.WON
      ) {
        throw new LeadServiceError(
          'A converted Lead must remain Won.',
          409,
          'CONFLICT',
        )
      }
      await assertAssignee(store, actor.workspaceId, input.assignedMemberId)
      const stageSupplied = input.stage !== undefined
      const updated = await store.updateLead({
        workspaceId: actor.workspaceId,
        leadId,
        expectedStage: stageSupplied ? existing.stage : undefined,
        data: input,
      })
      if (!updated) {
        if (stageSupplied) {
          throw new LeadServiceError(
            'Lead stage changed before this update was saved. Refresh and try again.',
            409,
            'CONFLICT',
          )
        }
        throw notFound()
      }
      if (updated.followUpEventId && options.processCommittedEvent) {
        void Promise.resolve()
          .then(() => options.processCommittedEvent!(updated.followUpEventId!))
          .catch((error) => options.onEventProcessingError?.(error))
      }
      return updated.lead
    },

    async archiveLead(actor: LeadActor, leadId: string) {
      await assertEligible(store, actor.workspaceId)
      const archived = await store.archiveLead({
        workspaceId: actor.workspaceId,
        leadId,
        archivedAt: now(),
      })
      if (!archived) throw notFound()
      return archived
    },

    async convertLeadToCustomer(
      actor: LeadActor,
      leadId: string,
      rawInput: unknown,
    ) {
      const input = parse(convertLeadSchema, rawInput)
      const result = await store.convertLead({
        workspaceId: actor.workspaceId,
        leadId,
        converterUserProfileId: actor.userProfileId,
        confirmDuplicate: input.confirmDuplicate,
        convertedAt: now(),
      })
      if (result.status === 'NOT_FOUND') throw notFound()
      if (result.status === 'UNAVAILABLE') {
        throw new LeadServiceError(
          'Durable Lead conversion is not available for this workspace model.',
          403,
          'UNAVAILABLE',
        )
      }
      return result
    },
  }
}
