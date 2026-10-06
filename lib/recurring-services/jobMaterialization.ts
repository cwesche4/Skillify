import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import { customerOperationalSnapshots } from '@/lib/jobs/operationalContext'

export const RECURRING_SERVICE_MATERIALIZATION_TOPIC =
  'scheduling.recurrence.materialized' as const

const RECONCILIATION_LIMIT = 500
const ELIGIBLE_EVENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'IN_PROGRESS',
] as const
const ELIGIBLE_OCCURRENCE_STATES = ['GENERATED', 'OVERRIDDEN'] as const

export type RecurringJobMaterializationResult =
  | { outcome: 'created'; jobId: string }
  | { outcome: 'existing'; jobId: string }
  | {
      outcome: 'ineligible'
      reason:
        | 'EVENT_NOT_FOUND'
        | 'NOT_RECURRING_SERVICE_OCCURRENCE'
        | 'SERVICE_NOT_FOUND'
        | 'SERVICE_ENDED'
        | 'CUSTOMER_ARCHIVED'
    }

export type RecurringJobMaterializationStore = {
  listOccurrenceIds(input: {
    workspaceId: string
    seriesId: string
    limit: number
  }): Promise<string[]>
  ensureJobForOccurrence(input: {
    workspaceId: string
    occurrenceId: string
  }): Promise<RecurringJobMaterializationResult>
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function distinctOccurrenceIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(
    new Set(
      value.filter(
        (candidate): candidate is string =>
          typeof candidate === 'string' && candidate.length > 0,
      ),
    ),
  )
}

export async function reconcileRecurringServiceJobsForSchedulingOutbox(
  input: {
    workspaceId: string
    topic: string
    payload: unknown
  },
  store: RecurringJobMaterializationStore = prismaRecurringJobMaterializationStore,
) {
  if (input.topic !== RECURRING_SERVICE_MATERIALIZATION_TOPIC) {
    return { examined: 0, created: 0, existing: 0, ineligible: 0 }
  }

  const payload = asRecord(input.payload)
  let occurrenceIds = distinctOccurrenceIds(payload.materializedOccurrenceIds)
  if (occurrenceIds.length > RECONCILIATION_LIMIT) {
    throw new Error(
      'Scheduling materialization payload exceeds its safe bound.',
    )
  }

  if (payload.recurringServiceReconciliation === true) {
    const seriesId =
      typeof payload.seriesId === 'string' ? payload.seriesId : null
    if (!seriesId) {
      throw new Error('Recurring Service reconciliation is missing a series.')
    }
    occurrenceIds = await store.listOccurrenceIds({
      workspaceId: input.workspaceId,
      seriesId,
      limit: RECONCILIATION_LIMIT,
    })
  }

  const result = {
    examined: occurrenceIds.length,
    created: 0,
    existing: 0,
    ineligible: 0,
  }
  for (const occurrenceId of occurrenceIds) {
    const item = await store.ensureJobForOccurrence({
      workspaceId: input.workspaceId,
      occurrenceId,
    })
    result[item.outcome] += 1
  }
  return result
}

export const prismaRecurringJobMaterializationStore: RecurringJobMaterializationStore =
  {
    async listOccurrenceIds({ workspaceId, seriesId, limit }) {
      const rows = await prisma.schedulingEvent.findMany({
        where: {
          workspaceId,
          recurrenceSeriesId: seriesId,
          eventTypeKey: 'recurringServiceVisit',
          occurrenceOriginalAt: { not: null },
          occurrenceState: { in: [...ELIGIBLE_OCCURRENCE_STATES] },
          status: { in: [...ELIGIBLE_EVENT_STATUSES] },
          deletedAt: null,
        },
        orderBy: [{ startsAtUtc: 'asc' }, { id: 'asc' }],
        take: limit,
        select: { id: true },
      })
      return rows.map((row) => row.id)
    },

    async ensureJobForOccurrence({ workspaceId, occurrenceId }) {
      try {
        return await prisma.$transaction(async (tx) => {
          const source = await tx.schedulingEvent.findFirst({
            where: { id: occurrenceId, workspaceId },
            select: { recurrenceSeriesId: true },
          })
          if (!source) {
            return { outcome: 'ineligible', reason: 'EVENT_NOT_FOUND' } as const
          }
          if (!source.recurrenceSeriesId) {
            return {
              outcome: 'ineligible',
              reason: 'NOT_RECURRING_SERVICE_OCCURRENCE',
            } as const
          }
          const serviceReference = await tx.recurringService.findFirst({
            where: {
              workspaceId,
              recurrenceSeriesId: source.recurrenceSeriesId,
            },
            select: { id: true },
          })
          if (!serviceReference) {
            return {
              outcome: 'ineligible',
              reason: 'SERVICE_NOT_FOUND',
            } as const
          }

          // Match Scheduling's service-before-occurrence mutation order to
          // avoid lock inversion with series split/cancel transactions.
          const lockedServices = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "RecurringService" WHERE "id" = ${serviceReference.id} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
          )
          if (lockedServices.length !== 1) {
            return {
              outcome: 'ineligible',
              reason: 'SERVICE_NOT_FOUND',
            } as const
          }
          const lockedEvents = await tx.$queryRaw<Array<{ id: string }>>(
            Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${occurrenceId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
          )
          if (lockedEvents.length !== 1) {
            return { outcome: 'ineligible', reason: 'EVENT_NOT_FOUND' } as const
          }

          const existing = await tx.job.findFirst({
            where: { workspaceId, schedulingEventId: occurrenceId },
            select: { id: true },
          })
          if (existing)
            return { outcome: 'existing', jobId: existing.id } as const

          const event = await tx.schedulingEvent.findFirst({
            where: { id: occurrenceId, workspaceId },
            include: {
              assignments: true,
              recurrenceSeries: {
                select: { workspaceId: true, status: true },
              },
            },
          })
          if (
            !event ||
            event.eventTypeKey !== 'recurringServiceVisit' ||
            !event.recurrenceSeriesId ||
            !event.recurrenceSeries ||
            event.recurrenceSeries.workspaceId !== workspaceId ||
            (event.recurrenceSeries.status !== 'ACTIVE' &&
              event.recurrenceSeries.status !== 'PAUSED') ||
            !event.occurrenceOriginalAt ||
            !ELIGIBLE_OCCURRENCE_STATES.includes(
              event.occurrenceState as (typeof ELIGIBLE_OCCURRENCE_STATES)[number],
            ) ||
            !ELIGIBLE_EVENT_STATUSES.includes(
              event.status as (typeof ELIGIBLE_EVENT_STATUSES)[number],
            ) ||
            event.deletedAt
          ) {
            return {
              outcome: 'ineligible',
              reason: 'NOT_RECURRING_SERVICE_OCCURRENCE',
            } as const
          }

          const service = await tx.recurringService.findFirst({
            where: {
              id: serviceReference.id,
              workspaceId,
              recurrenceSeriesId: event.recurrenceSeriesId,
            },
            include: {
              customer: {
                select: {
                  id: true,
                  displayName: true,
                  contactName: true,
                  email: true,
                  phone: true,
                  serviceAddressLine1: true,
                  serviceAddressLine2: true,
                  serviceAddressCity: true,
                  serviceAddressRegion: true,
                  serviceAddressPostalCode: true,
                  serviceAddressCountry: true,
                  archivedAt: true,
                },
              },
              stepTemplates: {
                orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
              },
            },
          })
          if (!service) {
            return {
              outcome: 'ineligible',
              reason: 'SERVICE_NOT_FOUND',
            } as const
          }
          if (service.status === 'ENDED') {
            return { outcome: 'ineligible', reason: 'SERVICE_ENDED' } as const
          }
          if (service.customer.archivedAt) {
            return {
              outcome: 'ineligible',
              reason: 'CUSTOMER_ARCHIVED',
            } as const
          }

          if (
            event.assignments.length === 0 ||
            event.assignments.some(
              (assignment) =>
                assignment.assignmentType !== 'MEMBER' ||
                !assignment.workspaceMemberId ||
                assignment.teamId !== null,
            )
          ) {
            throw new Error(
              'RECURRING_SERVICE_MEMBER_ASSIGNMENT_REQUIRED: controlled-launch materialization blocks empty or TEAM assignments.',
            )
          }

          const memberIds = Array.from(
            new Set(
              event.assignments.flatMap((assignment) =>
                assignment.assignmentType === 'MEMBER' &&
                assignment.workspaceMemberId &&
                !assignment.teamId
                  ? [assignment.workspaceMemberId]
                  : [],
              ),
            ),
          )
          if (memberIds.length !== event.assignments.length) {
            throw new Error(
              'Scheduling occurrence contains an invalid assignment target.',
            )
          }
          const members = await tx.workspaceMember.findMany({
            where: { workspaceId, id: { in: memberIds } },
            select: { id: true },
          })
          if (members.length !== memberIds.length) {
            throw new Error(
              'Scheduling occurrence assignment is outside the active workspace.',
            )
          }
          const jobAssignments = event.assignments.map((assignment) => ({
            assignmentType: assignment.assignmentType,
            workspaceMemberId: assignment.workspaceMemberId,
            teamId: assignment.teamId,
            roleLabel: assignment.roleLabel ?? null,
            displaySnapshot: assignment.displaySnapshot ?? null,
          }))
          const assigneeMemberId =
            jobAssignments.length === 1 &&
            jobAssignments[0].assignmentType === 'MEMBER'
              ? jobAssignments[0].workspaceMemberId
              : null
          const operationalContext = customerOperationalSnapshots(
            service.customer,
          )

          const job = await tx.job.create({
            data: {
              workspaceId,
              recurringServiceId: service.id,
              schedulingEventId: event.id,
              title: service.name,
              description: service.description,
              notes: null,
              serviceInstructionsSnapshot: service.serviceInstructions,
              status:
                event.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'SCHEDULED',
              priority: service.defaultJobPriority,
              customerReferenceId: null,
              customerId: service.customerId,
              customerDisplayName: service.customer.displayName,
              serviceLocationSnapshot:
                event.locationAddress ??
                event.locationLabel ??
                operationalContext.serviceLocationSnapshot,
              customerContactNameSnapshot:
                operationalContext.customerContactNameSnapshot,
              customerPhoneSnapshot: operationalContext.customerPhoneSnapshot,
              customerEmailSnapshot: operationalContext.customerEmailSnapshot,
              valueCents: service.pricePerVisitCents,
              currency: service.currency,
              scheduledStartAt: event.startsAtUtc,
              scheduledEndAt: event.endsAtUtc,
              completedAt: null,
              assigneeMemberId,
              createdByUserId: service.createdByUserId,
              assignments: { create: jobAssignments },
              workItems: {
                create: service.stepTemplates.map((template) => ({
                  kind: 'JOB_STEP',
                  title: template.title,
                  description: template.description,
                  notes: null,
                  status: 'OPEN',
                  priority: service.defaultJobPriority,
                  dueAt: null,
                  completedAt: null,
                  sortOrder: template.sortOrder,
                  assigneeMemberId: null,
                  createdByUserId: service.createdByUserId,
                })),
              },
            },
            select: { id: true },
          })
          return { outcome: 'created', jobId: job.id } as const
        })
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          const existing = await prisma.job.findFirst({
            where: { workspaceId, schedulingEventId: occurrenceId },
            select: { id: true },
          })
          if (existing) {
            return { outcome: 'existing', jobId: existing.id } as const
          }
        }
        throw error
      }
    },
  }
