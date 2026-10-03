import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { prisma } from '@/lib/db'
import {
  estimateOperationalizationSchema,
  type EstimateOperationalizationInput,
} from '@/lib/estimates/operationalizationValidation'
import { hashEstimateOperationalizationRequest } from '@/lib/estimates/operationalizationHash'
import { EstimateServiceError } from '@/lib/estimates/service'
import { createJobInTransaction } from '@/lib/jobs/prismaStore'
import { formatCustomerServiceLocation } from '@/lib/jobs/operationalContext'
import { OperationsServiceError } from '@/lib/jobs/service'
import type { JobAssignmentTarget } from '@/lib/jobs/types'
import {
  JobStatus,
  RecurringServiceStatus,
  WorkItemKind,
} from '@/lib/prisma/enums'
import { createRecurringServiceInTransaction } from '@/lib/recurring-services/prismaStore'
import { RecurringServiceServiceError } from '@/lib/recurring-services/service'
import {
  createSchedulingEventInTransaction,
  resolveSchedulingAssignmentsInTransaction,
  SchedulingRepositoryError,
} from '@/lib/scheduling/repository'
import {
  prepareSchedulingEventForTransactionalCreate,
  SchedulingServiceError,
  type SchedulingMutationActor,
} from '@/lib/scheduling/services/schedulingService'

type OperationalizationActor = SchedulingMutationActor & {
  userProfileId: string
}

type ActiveCustomer = {
  id: string
  displayName: string
  contactName: string | null
  email: string | null
  phone: string | null
  serviceAddressLine1: string | null
  serviceAddressLine2: string | null
  serviceAddressCity: string | null
  serviceAddressRegion: string | null
  serviceAddressPostalCode: string | null
  serviceAddressCountry: string | null
  updatedAt: Date
  archivedAt: Date | null
}

const operationalizationInclude = {
  items: {
    orderBy: { createdAt: 'asc' as const },
    select: {
      estimateLineItemId: true,
      targetKind: true,
      jobId: true,
      jobStepId: true,
      recurringServiceId: true,
    },
  },
} satisfies Prisma.EstimateOperationalizationInclude

type OperationalizationRecord = Prisma.EstimateOperationalizationGetPayload<{
  include: typeof operationalizationInclude
}>

export type EstimateOperationalizationResult = {
  operationalizationId: string
  estimateId: string
  referenceNumber: string
  customerId: string
  jobId: string | null
  recurringServiceIds: string[]
  mappings: Array<{
    estimateLineItemId: string
    targetKind: 'JOB' | 'RECURRING_SERVICE'
    jobId: string | null
    jobStepId: string | null
    recurringServiceId: string | null
  }>
  operationalizedAt: string
  replayed: boolean
}

function invalidRequest(error: z.ZodError) {
  return new EstimateServiceError(
    'Review the operational handoff details.',
    400,
    'VALIDATION_ERROR',
    error.flatten().fieldErrors,
  )
}

function present(
  operationalization: OperationalizationRecord,
  replayed: boolean,
): EstimateOperationalizationResult {
  const jobId =
    operationalization.items.find((item) => item.targetKind === 'JOB')?.jobId ??
    null
  return {
    operationalizationId: operationalization.id,
    estimateId: operationalization.estimateId,
    referenceNumber: operationalization.referenceNumber,
    customerId: operationalization.customerId,
    jobId,
    recurringServiceIds: [
      ...new Set(
        operationalization.items.flatMap((item) =>
          item.recurringServiceId ? [item.recurringServiceId] : [],
        ),
      ),
    ],
    mappings: operationalization.items.map((item) => ({
      estimateLineItemId: item.estimateLineItemId,
      targetKind: item.targetKind,
      jobId: item.jobId,
      jobStepId: item.jobStepId,
      recurringServiceId: item.recurringServiceId,
    })),
    operationalizedAt: operationalization.operationalizedAt.toISOString(),
    replayed,
  }
}

function assertLineCoverage(
  input: EstimateOperationalizationInput,
  lines: Array<{
    id: string
    billingBasis: 'ONE_TIME' | 'PER_VISIT'
  }>,
) {
  const requested = [
    ...(input.oneTime?.lineItems.map((line) => ({
      id: line.estimateLineItemId,
      basis: 'ONE_TIME' as const,
    })) ?? []),
    ...input.recurring.map((line) => ({
      id: line.estimateLineItemId,
      basis: 'PER_VISIT' as const,
    })),
  ]
  const duplicates = requested.filter(
    (entry, index) =>
      requested.findIndex((other) => other.id === entry.id) !== index,
  )
  const lineById = new Map(lines.map((line) => [line.id, line]))
  const missing = lines.filter(
    (line) => !requested.some((entry) => entry.id === line.id),
  )
  const invalid = requested.filter(
    (entry) =>
      !lineById.has(entry.id) ||
      lineById.get(entry.id)?.billingBasis !== entry.basis,
  )
  if (duplicates.length || missing.length || invalid.length) {
    throw new EstimateServiceError(
      'Every accepted Estimate line must be configured exactly once in the matching work section.',
      400,
      'VALIDATION_ERROR',
      {
        lineItems: [
          'Remove duplicate or foreign lines and configure every accepted line exactly once.',
        ],
      },
    )
  }
  const hasOneTime = lines.some((line) => line.billingBasis === 'ONE_TIME')
  if (hasOneTime !== Boolean(input.oneTime)) {
    throw new EstimateServiceError(
      hasOneTime
        ? 'Configure the one-time Job before creating work.'
        : 'This Estimate has no one-time scope.',
      400,
      'VALIDATION_ERROR',
    )
  }
}

function resolveCustomer(estimate: {
  customer: ActiveCustomer | null
  lead: { convertedCustomer: ActiveCustomer | null } | null
}) {
  const customer = estimate.customer ?? estimate.lead?.convertedCustomer ?? null
  if (!customer) {
    throw new EstimateServiceError(
      'Convert Lead to Customer first.',
      409,
      'CUSTOMER_REQUIRED',
    )
  }
  if (customer.archivedAt) {
    throw new EstimateServiceError(
      'The linked Customer is archived. Restore or choose an active Customer before creating work.',
      409,
      'CUSTOMER_REQUIRED',
    )
  }
  return customer
}

function assertEligibleEstimate(
  estimate: {
    status: string
    archivedAt: Date | null
    version: number
  },
  expectedVersion: number,
) {
  if (estimate.version !== expectedVersion) {
    throw new EstimateServiceError(
      'This Estimate changed. Refresh before creating work.',
      409,
      'STALE_ESTIMATE',
    )
  }
  if (estimate.status !== 'ACCEPTED' || estimate.archivedAt) {
    throw new EstimateServiceError(
      'Only an unarchived accepted Estimate can create operational work.',
      409,
      'CONFLICT',
    )
  }
}

function customerLocation(customer: ActiveCustomer) {
  return formatCustomerServiceLocation(customer)
}

function locationForSchedule(
  schedule: EstimateOperationalizationInput['recurring'][number]['schedule'],
  customer: ActiveCustomer,
) {
  if (schedule.locationType === 'customerLocation') {
    const address = customerLocation(customer)
    if (!address) {
      throw new EstimateServiceError(
        'Add a service address to the Customer or choose another location.',
        400,
        'VALIDATION_ERROR',
        { recurring: ['Customer service location is missing.'] },
      )
    }
    return {
      locationType: 'customerLocation' as const,
      location: address,
      locationLabel: customer.displayName,
      locationAddress: address,
    }
  }
  if (schedule.locationType === 'physicalAddress') {
    return {
      locationType: 'physicalAddress' as const,
      location: schedule.locationAddress ?? undefined,
      locationLabel: schedule.locationLabel ?? undefined,
      locationAddress: schedule.locationAddress ?? undefined,
    }
  }
  return {
    locationType: 'toBeDetermined' as const,
    location: undefined,
    locationLabel: undefined,
    locationAddress: undefined,
  }
}

async function findExisting(input: {
  workspaceId: string
  estimateId: string
  referenceNumber?: string
  idempotencyKey: string
}) {
  return prisma.estimateOperationalization.findFirst({
    where: {
      workspaceId: input.workspaceId,
      OR: [
        { estimateId: input.estimateId },
        ...(input.referenceNumber
          ? [{ referenceNumber: input.referenceNumber }]
          : []),
        { idempotencyKey: input.idempotencyKey },
      ],
    },
    include: operationalizationInclude,
  })
}

function replayOrConflict(
  existing: OperationalizationRecord,
  estimateId: string,
  requestHash: string,
) {
  if (
    existing.estimateId === estimateId &&
    existing.requestHash === requestHash
  ) {
    return present(existing, true)
  }
  throw new EstimateServiceError(
    'This Estimate family has already created operational work with different configuration.',
    409,
    'ALREADY_OPERATIONALIZED',
  )
}

const estimateContextInclude = {
  lineItems: {
    orderBy: [{ sortOrder: 'asc' as const }, { id: 'asc' as const }],
  },
  customer: true,
  lead: { include: { convertedCustomer: true } },
  operationalization: { include: operationalizationInclude },
} satisfies Prisma.EstimateInclude

type EstimateContext = Prisma.EstimateGetPayload<{
  include: typeof estimateContextInclude
}>

function findContext(workspaceId: string, estimateId: string) {
  return prisma.estimate.findFirst({
    where: { id: estimateId, workspaceId },
    include: estimateContextInclude,
  })
}

function translateDomainError(error: unknown): never {
  if (error instanceof EstimateServiceError) throw error
  if (
    error instanceof OperationsServiceError ||
    error instanceof RecurringServiceServiceError ||
    error instanceof SchedulingServiceError ||
    error instanceof SchedulingRepositoryError
  ) {
    const repositoryConflict =
      error instanceof SchedulingRepositoryError &&
      [
        'conflict',
        'version_conflict',
        'idempotency_conflict',
        'mutation_busy',
        'retry_exhausted',
      ].includes(error.code)
    const repositoryForbidden =
      error instanceof SchedulingRepositoryError && error.code === 'forbidden'
    const status =
      'status' in error
        ? error.status
        : repositoryForbidden
          ? 403
          : repositoryConflict
            ? 409
            : 400
    throw new EstimateServiceError(
      error.message,
      status === 409 ? 409 : status === 403 ? 403 : 400,
      status === 403
        ? 'FORBIDDEN'
        : status === 409
          ? 'CONFLICT'
          : 'VALIDATION_ERROR',
      'fieldErrors' in error
        ? (error.fieldErrors as Record<string, string[] | undefined>)
        : undefined,
    )
  }
  throw error
}

export async function operationalizeAcceptedEstimate({
  actor,
  estimateId,
  rawInput,
}: {
  actor: OperationalizationActor
  estimateId: string
  rawInput: unknown
}): Promise<EstimateOperationalizationResult> {
  const parsed = estimateOperationalizationSchema.safeParse(rawInput)
  if (!parsed.success) throw invalidRequest(parsed.error)
  const input = parsed.data
  const requestHash = hashEstimateOperationalizationRequest(input)
  const preflight = await findContext(actor.workspaceId, estimateId)
  if (!preflight) {
    throw new EstimateServiceError('Estimate not found.', 404, 'NOT_FOUND')
  }
  const existing =
    preflight.operationalization ??
    (await findExisting({
      workspaceId: actor.workspaceId,
      estimateId,
      referenceNumber: preflight.referenceNumber,
      idempotencyKey: input.idempotencyKey,
    }))
  if (existing) return replayOrConflict(existing, estimateId, requestHash)
  assertEligibleEstimate(preflight, input.expectedVersion)
  assertLineCoverage(input, preflight.lineItems)
  const customer = resolveCustomer(preflight)
  const lineById = new Map(preflight.lineItems.map((line) => [line.id, line]))
  let preparedSchedules
  try {
    preparedSchedules = await Promise.all(
      input.recurring.map(async (entry) => {
        const line = lineById.get(entry.estimateLineItemId)!
        const schedule = await prepareSchedulingEventForTransactionalCreate({
          actor,
          input: {
            title: line.title,
            description: line.description,
            type: 'recurringServiceVisit',
            status: 'scheduled',
            startsAt: entry.schedule.startsAt,
            endsAt: entry.schedule.endsAt,
            timezone: entry.schedule.timezone,
            recurrenceRule: entry.schedule.recurrenceRule,
            assignedMemberIds: entry.schedule.assignments.flatMap(
              (assignment) =>
                assignment.assignmentType === 'MEMBER'
                  ? [assignment.workspaceMemberId]
                  : [],
            ),
            assignments: entry.schedule.assignments,
            linkedRecord: {
              recordType: 'customer',
              recordId: customer.id,
              label: customer.displayName,
            },
            ...locationForSchedule(entry.schedule, customer),
          },
        })
        return { estimateLineItemId: entry.estimateLineItemId, schedule }
      }),
    )
  } catch (error) {
    translateDomainError(error)
  }
  const preparedByLineId = new Map(
    preparedSchedules.map((entry) => [
      entry.estimateLineItemId,
      entry.schedule,
    ]),
  )

  try {
    return await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`
          SELECT "id"
          FROM "Estimate"
          WHERE "workspaceId" = ${actor.workspaceId}
            AND "referenceNumber" = ${preflight.referenceNumber}
          ORDER BY "revisionNumber", "id"
          FOR UPDATE
        `
        const locked = (await tx.estimate.findFirst({
          where: { id: estimateId, workspaceId: actor.workspaceId },
          include: estimateContextInclude,
        })) as EstimateContext | null
        if (!locked) {
          throw new EstimateServiceError(
            'Estimate not found.',
            404,
            'NOT_FOUND',
          )
        }
        if (locked.operationalization) {
          return replayOrConflict(
            locked.operationalization,
            estimateId,
            requestHash,
          )
        }
        assertEligibleEstimate(locked, input.expectedVersion)
        assertLineCoverage(input, locked.lineItems)
        const lockedCustomer = resolveCustomer(locked)
        if (
          lockedCustomer.id !== customer.id ||
          lockedCustomer.updatedAt.getTime() !== customer.updatedAt.getTime()
        ) {
          throw new EstimateServiceError(
            'Customer details changed. Review the current Customer information and try again.',
            409,
            'CONFLICT',
          )
        }
        const schedulingAssignments =
          await resolveSchedulingAssignmentsInTransaction({
            tx,
            workspaceId: actor.workspaceId,
            inputs: preparedSchedules.map((entry) => entry.schedule),
          })
        const claim = await tx.estimateOperationalization.create({
          data: {
            workspaceId: actor.workspaceId,
            estimateId,
            referenceNumber: locked.referenceNumber,
            acceptedEstimateVersion: locked.version,
            customerId: lockedCustomer.id,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            operationalizedByUserId: actor.userProfileId,
          },
        })
        const mappings: Prisma.EstimateOperationalizationItemCreateManyInput[] =
          []
        if (input.oneTime) {
          const assignments = input.oneTime.assignments as JobAssignmentTarget[]
          const selectedSteps = input.oneTime.lineItems
            .filter((entry) => entry.createJobStep)
            .map((entry) => {
              const line = locked.lineItems.find(
                (candidate) => candidate.id === entry.estimateLineItemId,
              )!
              return {
                lineId: line.id,
                title: entry.stepTitle ?? line.title,
                description:
                  entry.stepDescription === undefined
                    ? line.description
                    : entry.stepDescription,
                sortOrder: line.sortOrder,
              }
            })
          const oneTime = await createJobInTransaction({
            tx,
            data: {
              workspaceId: actor.workspaceId,
              title: input.oneTime.title ?? locked.title,
              description: locked.scopeDescription,
              notes: input.oneTime.notes ?? null,
              status: input.oneTime.scheduledStartAt
                ? JobStatus.SCHEDULED
                : JobStatus.OPEN,
              priority: input.oneTime.priority,
              customerReferenceId: null,
              customerId: lockedCustomer.id,
              customerDisplayName: lockedCustomer.displayName,
              serviceLocationSnapshot: customerLocation(lockedCustomer),
              customerContactNameSnapshot: lockedCustomer.contactName,
              customerPhoneSnapshot: lockedCustomer.phone,
              customerEmailSnapshot: lockedCustomer.email,
              valueCents: locked.oneTimeSubtotalCents,
              currency: locked.currency,
              scheduledStartAt: input.oneTime.scheduledStartAt
                ? new Date(input.oneTime.scheduledStartAt)
                : null,
              scheduledEndAt: input.oneTime.scheduledEndAt
                ? new Date(input.oneTime.scheduledEndAt)
                : null,
              recurringServiceId: null,
              schedulingEventId: null,
              serviceInstructionsSnapshot: null,
              completedAt: null,
              assigneeMemberId:
                assignments.length === 1 &&
                assignments[0].assignmentType === 'MEMBER'
                  ? assignments[0].workspaceMemberId
                  : null,
              createdByUserId: actor.userProfileId,
            },
            assignments,
            steps: selectedSteps.map(({ lineId: _lineId, ...step }) => step),
          })
          const stepBySortOrder = new Map(
            oneTime.workItems
              .filter((item) => item.kind === WorkItemKind.JOB_STEP)
              .map((item) => [item.sortOrder, item.id]),
          )
          for (const entry of input.oneTime.lineItems) {
            const line = locked.lineItems.find(
              (candidate) => candidate.id === entry.estimateLineItemId,
            )!
            mappings.push({
              workspaceId: actor.workspaceId,
              operationalizationId: claim.id,
              estimateId,
              estimateLineItemId: line.id,
              targetKind: 'JOB',
              jobId: oneTime.id,
              jobStepId: entry.createJobStep
                ? (stepBySortOrder.get(line.sortOrder) ?? null)
                : null,
              recurringServiceId: null,
            })
          }
        }
        for (const entry of [...input.recurring].sort((a, b) => {
          const aOrder = locked.lineItems.find(
            (line) => line.id === a.estimateLineItemId,
          )!.sortOrder
          const bOrder = locked.lineItems.find(
            (line) => line.id === b.estimateLineItemId,
          )!.sortOrder
          return aOrder - bOrder
        })) {
          const line = locked.lineItems.find(
            (candidate) => candidate.id === entry.estimateLineItemId,
          )!
          const schedule = preparedByLineId.get(line.id)!
          const event = await createSchedulingEventInTransaction({
            tx,
            workspaceId: actor.workspaceId,
            actorUserId: actor.userProfileId,
            input: schedule,
            assignmentResolution: schedulingAssignments,
          })
          if (!event.recurrenceSeriesId) {
            throw new EstimateServiceError(
              'The recurring schedule was not created correctly.',
              409,
              'CONFLICT',
            )
          }
          const service = await createRecurringServiceInTransaction({
            tx,
            data: {
              workspaceId: actor.workspaceId,
              customerId: lockedCustomer.id,
              recurrenceSeriesId: event.recurrenceSeriesId,
              name: line.title,
              description: line.description,
              serviceInstructions: entry.serviceInstructions ?? null,
              pricePerVisitCents: line.amountCents,
              currency: locked.currency,
              defaultJobPriority: entry.priority,
              status: RecurringServiceStatus.ACTIVE,
              createdByUserId: actor.userProfileId,
              stepTemplates: entry.stepTemplates.map((template, sortOrder) => ({
                title: template.title,
                description: template.description ?? null,
                sortOrder,
              })),
            },
          })
          mappings.push({
            workspaceId: actor.workspaceId,
            operationalizationId: claim.id,
            estimateId,
            estimateLineItemId: line.id,
            targetKind: 'RECURRING_SERVICE',
            jobId: null,
            jobStepId: null,
            recurringServiceId: service.id,
          })
        }
        await tx.estimateOperationalizationItem.createMany({ data: mappings })
        const completed = await tx.estimateOperationalization.findUniqueOrThrow(
          {
            where: { id: claim.id },
            include: operationalizationInclude,
          },
        )
        return present(completed, false)
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60_000,
      },
    )
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === 'P2002' || error.code === 'P2034')
    ) {
      const winner = await findExisting({
        workspaceId: actor.workspaceId,
        estimateId,
        referenceNumber: preflight.referenceNumber,
        idempotencyKey: input.idempotencyKey,
      })
      if (winner) return replayOrConflict(winner, estimateId, requestHash)
      throw new EstimateServiceError(
        'Another work-creation request won the concurrency race. Refresh and try again.',
        409,
        'CONFLICT',
      )
    }
    translateDomainError(error)
  }
}
