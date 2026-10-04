import { z } from 'zod'

import type {
  EstimateActor,
  EstimateDetailResult,
  EstimateListResult,
  EstimateRecord,
} from '@/lib/estimates/types'
import {
  createEstimateSchema,
  estimateLifecycleSchema,
  estimateListQuerySchema,
  MAX_ESTIMATE_AMOUNT_CENTS,
  updateEstimateSchema,
} from '@/lib/estimates/validation'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'
import { getWorkspaceDateKey } from '@/lib/scheduling/schedulingDateTime'

export class EstimateServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly code:
      | 'VALIDATION_ERROR'
      | 'FORBIDDEN'
      | 'NOT_FOUND'
      | 'UNAVAILABLE'
      | 'CONFLICT'
      | 'CUSTOMER_REQUIRED'
      | 'STALE_ESTIMATE'
      | 'ALREADY_OPERATIONALIZED',
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'EstimateServiceError'
  }
}

type CreateInput = z.output<typeof createEstimateSchema>
type UpdateInput = z.output<typeof updateEstimateSchema>

export type EstimateMutationResult =
  | { status: 'OK'; estimate: EstimateRecord }
  | { status: 'NOT_FOUND' }
  | { status: 'STALE' }
  | { status: 'IMMUTABLE' }
  | { status: 'INVALID_STATE'; message: string }
  | { status: 'EXPIRED' }

export type EstimateStore = {
  getWorkspaceBusinessModel(workspaceId: string): Promise<string | null>
  getWorkspaceTimezone(workspaceId: string): Promise<string>
  createEstimate(input: {
    actor: EstimateActor
    data: CreateInput
  }): Promise<EstimateRecord>
  listEstimates(input: {
    workspaceId: string
    view: z.infer<typeof estimateListQuerySchema>['view']
    cursor?: string
    pageSize: number
    leadId?: string
    customerId?: string
    workspaceDateKey: string
    now: Date
  }): Promise<Omit<EstimateListResult, 'workspaceDateKey'>>
  getEstimateDetail(input: {
    workspaceId: string
    estimateId: string
  }): Promise<Omit<EstimateDetailResult, 'workspaceDateKey'> | null>
  updateDraft(input: {
    actor: EstimateActor
    estimateId: string
    data: UpdateInput
  }): Promise<EstimateMutationResult>
  transition(input: {
    actor: EstimateActor
    estimateId: string
    action: 'present' | 'accept' | 'decline' | 'void'
    expectedVersion: number
    workspaceDateKey: string
    now: Date
  }): Promise<EstimateMutationResult>
  createRevision(input: {
    actor: EstimateActor
    estimateId: string
    expectedVersion: number
  }): Promise<EstimateMutationResult>
  archiveEstimate(input: {
    actor: EstimateActor
    estimateId: string
    expectedVersion: number
    archivedAt: Date
  }): Promise<EstimateMutationResult>
}

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw new EstimateServiceError(
      'The Estimate request is invalid.',
      400,
      'VALIDATION_ERROR',
      result.error.flatten().fieldErrors,
    )
  }
  return result.data
}

function notFound() {
  return new EstimateServiceError('Estimate not found.', 404, 'NOT_FOUND')
}

function mutationResult(result: EstimateMutationResult) {
  if (result.status === 'OK') return result.estimate
  if (result.status === 'NOT_FOUND') throw notFound()
  if (result.status === 'STALE') {
    throw new EstimateServiceError(
      'This Estimate changed before your action was saved. Refresh and try again.',
      409,
      'CONFLICT',
    )
  }
  if (result.status === 'IMMUTABLE') {
    throw new EstimateServiceError(
      'Presented Estimate revisions are immutable. Create a new revision to make changes.',
      409,
      'CONFLICT',
    )
  }
  if (result.status === 'EXPIRED') {
    throw new EstimateServiceError(
      'This Estimate has expired. Create and present a new revision before recording acceptance.',
      409,
      'CONFLICT',
    )
  }
  throw new EstimateServiceError(result.message, 409, 'CONFLICT')
}

function assertTotals(input: { lineItems?: CreateInput['lineItems'] }) {
  if (!input.lineItems) return
  let oneTime = 0
  let perVisit = 0
  for (const item of input.lineItems) {
    if (item.billingBasis === 'ONE_TIME') oneTime += item.amountCents
    else perVisit += item.amountCents
  }
  if (
    oneTime > MAX_ESTIMATE_AMOUNT_CENTS ||
    perVisit > MAX_ESTIMATE_AMOUNT_CENTS
  ) {
    throw new EstimateServiceError(
      'Estimate totals exceed the supported amount.',
      400,
      'VALIDATION_ERROR',
      { lineItems: ['Each subtotal must be $1,000,000 or less.'] },
    )
  }
}

async function assertEligible(store: EstimateStore, workspaceId: string) {
  const businessModel = await store.getWorkspaceBusinessModel(workspaceId)
  if (businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) return
  throw new EstimateServiceError(
    'Durable Estimates are not available for this workspace model.',
    403,
    'UNAVAILABLE',
  )
}

async function workspaceDate(
  store: EstimateStore,
  workspaceId: string,
  now: Date,
) {
  return getWorkspaceDateKey(now, await store.getWorkspaceTimezone(workspaceId))
}

export function createEstimateService(
  store: EstimateStore,
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date())
  return {
    async createEstimate(actor: EstimateActor, rawInput: unknown) {
      await assertEligible(store, actor.workspaceId)
      const data = parse(createEstimateSchema, rawInput)
      assertTotals(data)
      return store.createEstimate({ actor, data })
    },

    async listEstimates(workspaceId: string, rawQuery: unknown = {}) {
      await assertEligible(store, workspaceId)
      const query = parse(estimateListQuerySchema, rawQuery)
      const workspaceDateKey = await workspaceDate(store, workspaceId, now())
      const result = await store.listEstimates({
        workspaceId,
        ...query,
        workspaceDateKey,
        now: now(),
      })
      return { ...result, workspaceDateKey }
    },

    async getEstimate(workspaceId: string, estimateId: string) {
      await assertEligible(store, workspaceId)
      const result = await store.getEstimateDetail({ workspaceId, estimateId })
      if (!result) throw notFound()
      return {
        ...result,
        workspaceDateKey: await workspaceDate(store, workspaceId, now()),
      }
    },

    async updateEstimate(
      actor: EstimateActor,
      estimateId: string,
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const data = parse(updateEstimateSchema, rawInput)
      assertTotals(data)
      return mutationResult(
        await store.updateDraft({ actor, estimateId, data }),
      )
    },

    async transitionEstimate(
      actor: EstimateActor,
      estimateId: string,
      action: 'present' | 'accept' | 'decline' | 'void',
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const { expectedVersion } = parse(estimateLifecycleSchema, rawInput)
      const instant = now()
      return mutationResult(
        await store.transition({
          actor,
          estimateId,
          action,
          expectedVersion,
          workspaceDateKey: await workspaceDate(
            store,
            actor.workspaceId,
            instant,
          ),
          now: instant,
        }),
      )
    },

    async createRevision(
      actor: EstimateActor,
      estimateId: string,
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const { expectedVersion } = parse(estimateLifecycleSchema, rawInput)
      return mutationResult(
        await store.createRevision({ actor, estimateId, expectedVersion }),
      )
    },

    async archiveEstimate(
      actor: EstimateActor,
      estimateId: string,
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const { expectedVersion } = parse(estimateLifecycleSchema, rawInput)
      return mutationResult(
        await store.archiveEstimate({
          actor,
          estimateId,
          expectedVersion,
          archivedAt: now(),
        }),
      )
    },
  }
}
