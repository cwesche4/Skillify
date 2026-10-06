import { z } from 'zod'

import {
  OperationsPriority,
  RecurringServiceStatus,
  WorkspaceBusinessModel,
} from '@/lib/prisma/enums'
import type { SchedulingMutationActor } from '@/lib/scheduling/services/schedulingService'
import type {
  CreateRecurringServiceData,
  RecurringServiceLifecycleAction,
  RecurringServiceRecord,
  UpdateRecurringServiceData,
} from '@/lib/recurring-services/types'
import {
  createRecurringServiceSchema,
  updateRecurringServiceSchema,
} from '@/lib/recurring-services/validation'

export class RecurringServiceServiceError extends Error {
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
    this.name = 'RecurringServiceServiceError'
  }
}

export type RecurringServiceActor = {
  workspaceId: string
  userProfileId: string
  workspaceMemberId: string
}

export type RecurringServiceStore = {
  getWorkspaceBusinessModel(workspaceId: string): Promise<string | null>
  findActiveCustomer(input: {
    workspaceId: string
    customerId: string
  }): Promise<{ id: string } | null>
  findRecurrenceSeries(input: {
    workspaceId: string
    recurrenceSeriesId: string
  }): Promise<{
    id: string
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELED'
    eventTypeKey: string
    assignments: Array<{
      assignmentType: 'MEMBER' | 'TEAM'
      workspaceMemberId: string | null
      teamId: string | null
    }>
  } | null>
  findByRecurrenceSeries(input: {
    workspaceId: string
    recurrenceSeriesId: string
  }): Promise<RecurringServiceRecord | null>
  createRecurringService(
    data: CreateRecurringServiceData,
  ): Promise<RecurringServiceRecord>
  findRecurringService(input: {
    workspaceId: string
    recurringServiceId: string
  }): Promise<RecurringServiceRecord | null>
  listRecurringServices(workspaceId: string): Promise<RecurringServiceRecord[]>
  updateRecurringService(input: {
    workspaceId: string
    recurringServiceId: string
    data: UpdateRecurringServiceData
  }): Promise<RecurringServiceRecord | null>
}

type LifecycleDependencies = {
  changeSeriesStatus: (input: {
    actor: SchedulingMutationActor
    seriesId: string
    action: 'pause' | 'resume' | 'cancel'
    expectedVersion?: number
    idempotencyKey?: string
  }) => Promise<void>
}

async function changeSeriesStatusThroughScheduling(
  input: Parameters<LifecycleDependencies['changeSeriesStatus']>[0],
) {
  const { changeSchedulingRecurrenceSeriesStatus } =
    await import('@/lib/scheduling/services/schedulingService')
  return changeSchedulingRecurrenceSeriesStatus(input)
}

function validationError(error: z.ZodError) {
  return new RecurringServiceServiceError(
    'The Recurring Service request is invalid.',
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

function notFound() {
  return new RecurringServiceServiceError(
    'Recurring Service not found.',
    404,
    'NOT_FOUND',
  )
}

async function assertEligible(
  store: RecurringServiceStore,
  workspaceId: string,
) {
  const businessModel = await store.getWorkspaceBusinessModel(workspaceId)
  if (businessModel === WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS) return
  throw new RecurringServiceServiceError(
    'Recurring Services are not available for this workspace model.',
    403,
    'UNAVAILABLE',
  )
}

function orderedSteps(
  steps: Array<{ title: string; description?: string | null }>,
) {
  return steps.map((step, sortOrder) => ({
    title: step.title,
    description: step.description ?? null,
    sortOrder,
  }))
}

function schedulingAction(action: RecurringServiceLifecycleAction) {
  if (action === 'pause') return 'pause' as const
  if (action === 'resume') return 'resume' as const
  return 'cancel' as const
}

function targetStatus(action: RecurringServiceLifecycleAction) {
  if (action === 'pause') return RecurringServiceStatus.PAUSED
  if (action === 'resume') return RecurringServiceStatus.ACTIVE
  return RecurringServiceStatus.ENDED
}

function assertLifecycleTransition(
  current: RecurringServiceRecord['status'],
  action: RecurringServiceLifecycleAction,
) {
  const target = targetStatus(action)
  if (current === target) return
  const allowed =
    (current === RecurringServiceStatus.ACTIVE &&
      (target === RecurringServiceStatus.PAUSED ||
        target === RecurringServiceStatus.ENDED)) ||
    (current === RecurringServiceStatus.PAUSED &&
      (target === RecurringServiceStatus.ACTIVE ||
        target === RecurringServiceStatus.ENDED))
  if (!allowed) {
    throw new RecurringServiceServiceError(
      `Recurring Service cannot change from ${current} to ${target}.`,
      409,
      'CONFLICT',
    )
  }
}

export function createRecurringServiceService(
  store: RecurringServiceStore,
  dependencies: LifecycleDependencies = {
    changeSeriesStatus: changeSeriesStatusThroughScheduling,
  },
) {
  return {
    async listRecurringServices(workspaceId: string) {
      await assertEligible(store, workspaceId)
      return store.listRecurringServices(workspaceId)
    },

    async getRecurringService(workspaceId: string, recurringServiceId: string) {
      await assertEligible(store, workspaceId)
      return store.findRecurringService({ workspaceId, recurringServiceId })
    },

    async createRecurringService(
      actor: RecurringServiceActor,
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const input = parse(createRecurringServiceSchema, rawInput)
      const customer = await store.findActiveCustomer({
        workspaceId: actor.workspaceId,
        customerId: input.customerId,
      })
      if (!customer) {
        throw new RecurringServiceServiceError(
          'Choose an active Customer from this workspace.',
          400,
          'VALIDATION_ERROR',
          { customerId: ['Choose an active Customer from this workspace.'] },
        )
      }
      const series = await store.findRecurrenceSeries({
        workspaceId: actor.workspaceId,
        recurrenceSeriesId: input.recurrenceSeriesId,
      })
      if (!series || series.eventTypeKey !== 'recurringServiceVisit') {
        throw new RecurringServiceServiceError(
          'Choose a recurring service schedule from this workspace.',
          400,
          'VALIDATION_ERROR',
          {
            recurrenceSeriesId: [
              'Choose a recurring service schedule from this workspace.',
            ],
          },
        )
      }
      if (
        series.assignments.length === 0 ||
        series.assignments.some(
          (assignment) =>
            assignment.assignmentType !== 'MEMBER' ||
            !assignment.workspaceMemberId ||
            assignment.teamId !== null,
        )
      ) {
        throw new RecurringServiceServiceError(
          'Recurring Services support member assignments only during controlled launch.',
          400,
          'VALIDATION_ERROR',
          {
            recurrenceSeriesId: [
              'Choose a recurring schedule assigned to at least one workspace member and no teams.',
            ],
          },
        )
      }
      if (series.status === 'COMPLETED' || series.status === 'CANCELED') {
        throw new RecurringServiceServiceError(
          'An ended Scheduling series cannot back a new Recurring Service.',
          409,
          'CONFLICT',
          {
            recurrenceSeriesId: [
              'Choose an active or paused recurring schedule.',
            ],
          },
        )
      }
      if (
        await store.findByRecurrenceSeries({
          workspaceId: actor.workspaceId,
          recurrenceSeriesId: series.id,
        })
      ) {
        throw new RecurringServiceServiceError(
          'This recurring schedule already belongs to a Recurring Service.',
          409,
          'CONFLICT',
          {
            recurrenceSeriesId: [
              'Choose a recurring schedule that is not already in use.',
            ],
          },
        )
      }
      return store.createRecurringService({
        workspaceId: actor.workspaceId,
        customerId: customer.id,
        recurrenceSeriesId: series.id,
        name: input.name,
        description: input.description ?? null,
        serviceInstructions: input.serviceInstructions ?? null,
        pricePerVisitCents: input.pricePerVisitCents,
        currency: input.currency ?? 'USD',
        defaultJobPriority:
          input.defaultJobPriority ?? OperationsPriority.NORMAL,
        status:
          series.status === 'PAUSED'
            ? RecurringServiceStatus.PAUSED
            : RecurringServiceStatus.ACTIVE,
        createdByUserId: actor.userProfileId,
        stepTemplates: orderedSteps(input.defaultSteps ?? []),
      })
    },

    async updateRecurringService(
      actor: RecurringServiceActor,
      recurringServiceId: string,
      rawInput: unknown,
    ) {
      await assertEligible(store, actor.workspaceId)
      const existing = await store.findRecurringService({
        workspaceId: actor.workspaceId,
        recurringServiceId,
      })
      if (!existing) throw notFound()
      const input = parse(updateRecurringServiceSchema, rawInput)
      const updated = await store.updateRecurringService({
        workspaceId: actor.workspaceId,
        recurringServiceId,
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.description !== undefined
            ? { description: input.description ?? null }
            : {}),
          ...(input.serviceInstructions !== undefined
            ? { serviceInstructions: input.serviceInstructions ?? null }
            : {}),
          ...(input.pricePerVisitCents !== undefined
            ? { pricePerVisitCents: input.pricePerVisitCents }
            : {}),
          ...(input.currency !== undefined ? { currency: input.currency } : {}),
          ...(input.defaultJobPriority !== undefined
            ? { defaultJobPriority: input.defaultJobPriority }
            : {}),
          ...(input.defaultSteps !== undefined
            ? { stepTemplates: orderedSteps(input.defaultSteps) }
            : {}),
        },
      })
      if (!updated) throw notFound()
      return updated
    },

    async changeLifecycle({
      actor,
      recurringServiceId,
      action,
      expectedVersion,
      idempotencyKey,
    }: {
      actor: RecurringServiceActor
      recurringServiceId: string
      action: RecurringServiceLifecycleAction
      expectedVersion?: number
      idempotencyKey?: string
    }) {
      await assertEligible(store, actor.workspaceId)
      const existing = await store.findRecurringService({
        workspaceId: actor.workspaceId,
        recurringServiceId,
      })
      if (!existing) throw notFound()
      assertLifecycleTransition(existing.status, action)
      if (existing.status === targetStatus(action)) return existing

      await dependencies.changeSeriesStatus({
        actor: {
          workspaceId: actor.workspaceId,
          actorUserId: actor.userProfileId,
          workspaceMemberId: actor.workspaceMemberId,
          canManageScheduling: true,
        },
        seriesId: existing.recurrenceSeriesId,
        action: schedulingAction(action),
        expectedVersion,
        idempotencyKey,
      })
      const updated = await store.findRecurringService({
        workspaceId: actor.workspaceId,
        recurringServiceId,
      })
      if (!updated || updated.status !== targetStatus(action)) {
        throw new RecurringServiceServiceError(
          'The recurring schedule changed, but its Recurring Service lifecycle did not reconcile.',
          409,
          'CONFLICT',
        )
      }
      return updated
    },
  }
}
