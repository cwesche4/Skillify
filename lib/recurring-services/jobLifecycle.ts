import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  JobCancellationReason,
  JobStatus,
  type JobCancellationReason as JobCancellationReasonValue,
  type JobUnableToCompleteReason,
} from '@/lib/prisma/enums'
import type { JobRecord } from '@/lib/jobs/types'
import {
  reportUnableToCompleteSchema,
  rescheduleUnableRecurringJobSchema,
  skipRecurringJobSchema,
} from '@/lib/jobs/validation'
import { OperationsServiceError } from '@/lib/jobs/service'
import {
  canWorkspaceMemberExecuteJob,
  jobExecutionEligibilityWhere,
  lockAndValidateRecurringJobExecution,
} from '@/lib/jobs/jobExecutionAuthorization'

export const RECURRING_JOB_COMPLETION_SYNC_TOPIC =
  'scheduling.recurring_job.completed' as const

const LIFECYCLE_RECONCILIATION_LIMIT = 500
const NONTERMINAL_JOB_STATUSES = [
  'OPEN',
  'SCHEDULED',
  'IN_PROGRESS',
  'WAITING_ON_CLIENT',
  'UNABLE_TO_COMPLETE',
] as const

type LifecycleActor = {
  workspaceId: string
  userProfileId: string
  workspaceMemberId: string
  canManage: boolean
}

type CancellationContext = {
  reason: JobCancellationReasonValue
  note: string | null
}

function parseCancellationContext(value: unknown): CancellationContext | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (
    typeof record.reason !== 'string' ||
    !Object.values(JobCancellationReason).includes(
      record.reason as JobCancellationReasonValue,
    )
  ) {
    return null
  }
  return {
    reason: record.reason as JobCancellationReasonValue,
    note: typeof record.note === 'string' ? record.note : null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

function lifecycleNotFound() {
  return new OperationsServiceError(
    'Recurring Job not found.',
    404,
    'NOT_FOUND',
  )
}

function lifecycleConflict(message: string) {
  return new OperationsServiceError(message, 409, 'CONFLICT')
}

async function runSchedulingMutation(action: () => Promise<unknown>) {
  try {
    return await action()
  } catch (error) {
    if (error instanceof Error && error.name === 'SchedulingServiceError') {
      const status = (error as Error & { status?: number }).status
      if (status === 403) {
        throw new OperationsServiceError(error.message, 403, 'FORBIDDEN')
      }
      if (status === 404) {
        throw new OperationsServiceError(error.message, 404, 'NOT_FOUND')
      }
      if (status === 409) {
        throw new OperationsServiceError(error.message, 409, 'CONFLICT')
      }
      if (status === 400) {
        throw new OperationsServiceError(error.message, 400, 'VALIDATION_ERROR')
      }
    }
    if (error instanceof Error && error.name === 'SchedulingRepositoryError') {
      const code = (error as Error & { code?: string }).code
      throw new OperationsServiceError(
        error.message,
        code === 'not_found' ? 404 : code?.includes('conflict') ? 409 : 400,
        code === 'not_found'
          ? 'NOT_FOUND'
          : code?.includes('conflict')
            ? 'CONFLICT'
            : 'VALIDATION_ERROR',
      )
    }
    throw error
  }
}

export type RecurringJobLifecycleStore = {
  findJob(input: {
    workspaceId: string
    jobId: string
  }): Promise<JobRecord | null>
  markUnableToComplete(input: {
    workspaceId: string
    jobId: string
    expectedStatus: 'SCHEDULED' | 'IN_PROGRESS'
    reporterMemberId: string
    reason: JobUnableToCompleteReason
    note: string | null
    executorMemberId?: string
    occurredAt: Date
  }): Promise<JobRecord | null>
  canExecuteJob(input: {
    workspaceId: string
    jobId: string
    workspaceMemberId: string
  }): Promise<boolean>
  synchronizeOccurrence(input: {
    workspaceId: string
    occurrenceId: string
    cancellation: CancellationContext
    now: Date
  }): Promise<'updated' | 'protected' | 'missing' | 'unchanged'>
  synchronizeSeries(input: {
    workspaceId: string
    seriesId: string
    cancellation: CancellationContext
    now: Date
  }): Promise<number>
  synchronizeEndedService(input: {
    workspaceId: string
    seriesId: string
    now: Date
  }): Promise<number>
  completeOccurrenceFromJob(input: {
    workspaceId: string
    jobId: string
    completedAt: Date
    actorUserId: string
    sourceOutboxEventId: string
  }): Promise<'completed' | 'already-completed' | 'stale' | 'manual'>
}

export const prismaRecurringJobLifecycleStore: RecurringJobLifecycleStore = {
  findJob({ workspaceId, jobId }) {
    return prisma.job.findFirst({
      where: { id: jobId, workspaceId, archivedAt: null },
    })
  },

  markUnableToComplete({
    workspaceId,
    jobId,
    expectedStatus,
    reporterMemberId,
    reason,
    note,
    executorMemberId,
    occurredAt,
  }) {
    return prisma.$transaction(async (tx) => {
      if (
        executorMemberId &&
        !(await lockAndValidateRecurringJobExecution({
          tx,
          workspaceId,
          jobId,
          workspaceMemberId: executorMemberId,
        }))
      ) {
        return null
      }
      if (!executorMemberId) {
        const reference = await tx.job.findFirst({
          where: { id: jobId, workspaceId, archivedAt: null },
          select: { schedulingEventId: true },
        })
        if (!reference?.schedulingEventId) return null
        const lockedEvents = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${reference.schedulingEventId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        if (lockedEvents.length !== 1) return null
        const event = await tx.schedulingEvent.findFirst({
          where: {
            id: reference.schedulingEventId,
            workspaceId,
            deletedAt: null,
            status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
            occurrenceState: { in: ['GENERATED', 'OVERRIDDEN'] },
          },
          select: { id: true },
        })
        if (!event) return null
      }
      const updated = await tx.job.updateMany({
        where: {
          ...(executorMemberId
            ? jobExecutionEligibilityWhere({
                workspaceId,
                jobId,
                workspaceMemberId: executorMemberId,
              })
            : { id: jobId, workspaceId, archivedAt: null }),
          recurringServiceId: { not: null },
          schedulingEventId: { not: null },
          status: expectedStatus,
        },
        data: {
          status: 'UNABLE_TO_COMPLETE',
          unableToCompleteReason: reason,
          unableToCompleteNote: note,
          unableToCompleteAt: occurredAt,
          unableToCompleteReportedByMemberId: reporterMemberId,
        },
      })
      if (updated.count !== 1) return null
      return tx.job.findFirst({ where: { id: jobId, workspaceId } })
    })
  },

  canExecuteJob({ workspaceId, jobId, workspaceMemberId }) {
    return canWorkspaceMemberExecuteJob({
      workspaceId,
      jobId,
      workspaceMemberId,
    })
  },

  synchronizeOccurrence({ workspaceId, occurrenceId, cancellation, now }) {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.job.findFirst({
        where: {
          workspaceId,
          schedulingEventId: occurrenceId,
          archivedAt: null,
        },
        select: { id: true },
      })
      if (!reference) return 'missing' as const
      const lockedEvents = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${occurrenceId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      if (lockedEvents.length !== 1) return 'missing' as const
      const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Job" WHERE "id" = ${reference.id} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      if (lockedJobs.length !== 1) return 'missing' as const
      const [job, event] = await Promise.all([
        tx.job.findFirst({
          where: { id: reference.id, workspaceId },
          include: { assignments: true },
        }),
        tx.schedulingEvent.findFirst({
          where: { id: occurrenceId, workspaceId },
          include: { assignments: true },
        }),
      ])
      if (!job || !event || job.schedulingEventId !== occurrenceId) {
        return 'missing' as const
      }
      if (job.status === 'COMPLETED' || job.status === 'CANCELED') {
        return 'protected' as const
      }
      const occurrenceCanceled =
        event.status === 'CANCELED' ||
        event.deletedAt !== null ||
        event.occurrenceState === 'CANCELED' ||
        event.occurrenceState === 'DELETED' ||
        event.occurrenceState === 'SUPERSEDED'
      if (occurrenceCanceled) {
        await tx.job.update({
          where: { id: job.id },
          data: {
            status: 'CANCELED',
            cancellationReason: cancellation.reason,
            cancellationNote: cancellation.note,
            canceledAt: event.canceledAt ?? now,
          },
        })
        return 'updated' as const
      }
      if (event.status === 'COMPLETED') return 'protected' as const

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
      const teamIds = Array.from(
        new Set(
          event.assignments.flatMap((assignment) =>
            assignment.assignmentType === 'TEAM' &&
            assignment.teamId &&
            !assignment.workspaceMemberId
              ? [assignment.teamId]
              : [],
          ),
        ),
      )
      if (memberIds.length + teamIds.length !== event.assignments.length) {
        throw new Error(
          'Scheduling occurrence contains an invalid assignment target.',
        )
      }
      const [members, teams] = await Promise.all([
        tx.workspaceMember.findMany({
          where: { workspaceId, id: { in: memberIds } },
          select: { id: true },
        }),
        tx.workspaceTeam.findMany({
          where: { workspaceId, id: { in: teamIds } },
          select: { id: true, name: true },
        }),
      ])
      if (
        members.length !== memberIds.length ||
        teams.length !== teamIds.length
      ) {
        throw new Error(
          'Scheduling occurrence assignment is outside the active workspace.',
        )
      }
      const teamNameById = new Map(teams.map((team) => [team.id, team.name]))
      const nextAssignments = event.assignments
        .map((assignment) => ({
          assignmentType: assignment.assignmentType,
          workspaceMemberId: assignment.workspaceMemberId,
          teamId: assignment.teamId,
          roleLabel: assignment.roleLabel,
          displaySnapshot:
            assignment.displaySnapshot ??
            (assignment.teamId
              ? (teamNameById.get(assignment.teamId) ?? null)
              : null),
        }))
        .sort((left, right) =>
          `${left.assignmentType}:${left.workspaceMemberId ?? left.teamId}`.localeCompare(
            `${right.assignmentType}:${right.workspaceMemberId ?? right.teamId}`,
          ),
        )
      const currentAssignments = job.assignments
        .map((assignment) => ({
          assignmentType: assignment.assignmentType,
          workspaceMemberId: assignment.workspaceMemberId,
          teamId: assignment.teamId,
          roleLabel: assignment.roleLabel,
          displaySnapshot: assignment.displaySnapshot,
        }))
        .sort((left, right) =>
          `${left.assignmentType}:${left.workspaceMemberId ?? left.teamId}`.localeCompare(
            `${right.assignmentType}:${right.workspaceMemberId ?? right.teamId}`,
          ),
        )
      const assignmentsChanged =
        JSON.stringify(currentAssignments) !== JSON.stringify(nextAssignments)
      const scheduleChanged =
        job.scheduledStartAt?.getTime() !== event.startsAtUtc.getTime() ||
        job.scheduledEndAt?.getTime() !== event.endsAtUtc.getTime()
      const nextServiceLocationSnapshot =
        event.locationAddress ??
        event.locationLabel ??
        job.serviceLocationSnapshot
      const locationChanged =
        job.serviceLocationSnapshot !== nextServiceLocationSnapshot
      if (!scheduleChanged && !assignmentsChanged && !locationChanged) {
        return 'unchanged' as const
      }
      if (assignmentsChanged) {
        await tx.jobAssignment.deleteMany({
          where: { workspaceId, jobId: job.id },
        })
        if (nextAssignments.length) {
          await tx.jobAssignment.createMany({
            data: nextAssignments.map((assignment) => ({
              workspaceId,
              jobId: job.id,
              ...assignment,
            })),
            skipDuplicates: true,
          })
        }
      }
      const mirroredAssigneeMemberId =
        nextAssignments.length === 1 &&
        nextAssignments[0].assignmentType === 'MEMBER'
          ? nextAssignments[0].workspaceMemberId
          : null
      await tx.job.update({
        where: { id: job.id },
        data: {
          ...(scheduleChanged
            ? {
                scheduledStartAt: event.startsAtUtc,
                scheduledEndAt: event.endsAtUtc,
              }
            : {}),
          ...(assignmentsChanged
            ? { assigneeMemberId: mirroredAssigneeMemberId }
            : {}),
          ...(locationChanged
            ? { serviceLocationSnapshot: nextServiceLocationSnapshot }
            : {}),
          ...(job.status === 'UNABLE_TO_COMPLETE'
            ? scheduleChanged
              ? { status: 'SCHEDULED' }
              : {}
            : {}),
        },
      })
      return 'updated' as const
    })
  },

  async synchronizeSeries({ workspaceId, seriesId, cancellation, now }) {
    const rows = await prisma.job.findMany({
      where: {
        workspaceId,
        schedulingEvent: { is: { recurrenceSeriesId: seriesId } },
        archivedAt: null,
        status: { in: [...NONTERMINAL_JOB_STATUSES] },
      },
      orderBy: [{ scheduledStartAt: 'asc' }, { id: 'asc' }],
      take: LIFECYCLE_RECONCILIATION_LIMIT,
      select: { schedulingEventId: true },
    })
    let updated = 0
    for (const row of rows) {
      if (!row.schedulingEventId) continue
      const outcome = await this.synchronizeOccurrence({
        workspaceId,
        occurrenceId: row.schedulingEventId,
        cancellation,
        now,
      })
      if (outcome === 'updated') updated += 1
    }
    return updated
  },

  async synchronizeEndedService({ workspaceId, seriesId, now }) {
    const service = await prisma.recurringService.findFirst({
      where: { workspaceId, recurrenceSeriesId: seriesId, status: 'ENDED' },
      select: { id: true, endedAt: true },
    })
    if (!service?.endedAt) return 0
    const result = await prisma.job.updateMany({
      where: {
        workspaceId,
        recurringServiceId: service.id,
        archivedAt: null,
        status: { in: [...NONTERMINAL_JOB_STATUSES] },
        scheduledStartAt: { gte: service.endedAt },
      },
      data: {
        status: 'CANCELED',
        cancellationReason: 'SERVICE_ENDED',
        cancellationNote: null,
        canceledAt: service.endedAt ?? now,
      },
    })
    return result.count
  },

  completeOccurrenceFromJob({
    workspaceId,
    jobId,
    completedAt,
    actorUserId,
    sourceOutboxEventId,
  }) {
    return prisma.$transaction(async (tx) => {
      const reference = await tx.job.findFirst({
        where: { id: jobId, workspaceId },
        select: { status: true, completedAt: true, schedulingEventId: true },
      })
      if (
        !reference ||
        reference.status !== 'COMPLETED' ||
        reference.completedAt?.getTime() !== completedAt.getTime()
      ) {
        return 'stale' as const
      }
      if (!reference.schedulingEventId) return 'manual' as const
      const lockedEvents = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${reference.schedulingEventId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      if (lockedEvents.length !== 1) return 'stale' as const
      const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Job" WHERE "id" = ${jobId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
      )
      if (lockedJobs.length !== 1) return 'stale' as const
      const job = await tx.job.findFirst({
        where: { id: jobId, workspaceId },
        select: { status: true, completedAt: true, schedulingEventId: true },
      })
      if (
        !job ||
        job.status !== 'COMPLETED' ||
        job.completedAt?.getTime() !== completedAt.getTime() ||
        job.schedulingEventId !== reference.schedulingEventId
      ) {
        return 'stale' as const
      }
      const event = await tx.schedulingEvent.findFirst({
        where: { id: reference.schedulingEventId, workspaceId },
      })
      if (!event) return 'stale' as const
      if (event.status === 'COMPLETED' && event.completedAt) {
        return 'already-completed' as const
      }
      if (
        event.deletedAt ||
        event.status === 'CANCELED' ||
        event.status === 'MISSED' ||
        event.occurrenceState === 'CANCELED' ||
        event.occurrenceState === 'DELETED' ||
        event.occurrenceState === 'SUPERSEDED'
      ) {
        return 'stale' as const
      }
      await tx.schedulingEvent.update({
        where: { id: event.id },
        data: {
          status: 'COMPLETED',
          occurrenceState: event.recurrenceSeriesId ? 'COMPLETED' : undefined,
          completedAt,
          canceledAt: null,
          deletedAt: null,
          updatedByUserId: actorUserId,
        },
      })
      await tx.schedulingEventActivity.create({
        data: {
          workspaceId,
          eventId: event.id,
          actorId: actorUserId,
          action: 'completed_from_recurring_job',
          source: 'Skillify',
          summary: 'Occurrence completed from its recurring Job.',
          metadata: { jobId, previousStatus: event.status },
        },
      })
      await tx.domainOutboxEvent.create({
        data: {
          workspaceId,
          topic: 'scheduling.event.completed',
          aggregateType: 'SchedulingEvent',
          aggregateId: event.id,
          deduplicationKey: `scheduling:job-completion-sync:${sourceOutboxEventId}`,
          payload: {
            eventId: event.id,
            from: event.status.toLowerCase(),
            to: 'completed',
            sourceJobId: jobId,
          },
        },
      })
      return 'completed' as const
    })
  },
}

export async function reconcileRecurringJobLifecycleForSchedulingOutbox(
  input: {
    outboxEventId: string
    workspaceId: string
    topic: string
    aggregateId: string
    payload: unknown
    now?: Date
  },
  store: RecurringJobLifecycleStore = prismaRecurringJobLifecycleStore,
) {
  const now = input.now ?? new Date()
  const payload = asRecord(input.payload)
  if (input.topic === RECURRING_JOB_COMPLETION_SYNC_TOPIC) {
    const jobId = typeof payload.jobId === 'string' ? payload.jobId : null
    const completedAtValue =
      typeof payload.completedAt === 'string' ? payload.completedAt : null
    const actorUserId =
      typeof payload.actorUserId === 'string' ? payload.actorUserId : null
    const completedAt = completedAtValue ? new Date(completedAtValue) : null
    if (
      !jobId ||
      !actorUserId ||
      !completedAt ||
      Number.isNaN(completedAt.getTime())
    ) {
      throw new Error(
        'Recurring Job completion synchronization payload is invalid.',
      )
    }
    return store.completeOccurrenceFromJob({
      workspaceId: input.workspaceId,
      jobId,
      completedAt,
      actorUserId,
      sourceOutboxEventId: input.outboxEventId,
    })
  }

  const endTopics = new Set([
    'scheduling.recurrence_series.canceled',
    'scheduling.recurrence.series_deleted',
  ])
  if (endTopics.has(input.topic)) {
    const seriesId =
      typeof payload.seriesId === 'string' ? payload.seriesId : null
    if (!seriesId) return 'ignored' as const
    return store.synchronizeEndedService({
      workspaceId: input.workspaceId,
      seriesId,
      now,
    })
  }

  const seriesTopics = new Set([
    'scheduling.recurrence.following_canceled',
    'scheduling.recurrence.following_deleted',
    'scheduling.recurrence.series_updated',
    'scheduling.recurrence.series_split',
  ])
  if (seriesTopics.has(input.topic)) {
    const seriesIds = ['seriesId', 'originalSeriesId', 'newSeriesId']
      .map((key) => payload[key])
      .filter((value): value is string => typeof value === 'string')
    let updated = 0
    for (const seriesId of new Set(seriesIds)) {
      updated += await store.synchronizeSeries({
        workspaceId: input.workspaceId,
        seriesId,
        cancellation: {
          reason: JobCancellationReason.SCHEDULE_CANCELED,
          note: null,
        },
        now,
      })
    }
    return updated
  }

  const occurrenceTopics = new Set([
    'scheduling.event.updated',
    'scheduling.event.status_changed',
    'scheduling.event.canceled',
    'scheduling.event.completed',
    'scheduling.event.deleted',
    'scheduling.recurrence.occurrence_canceled',
    'scheduling.recurrence.occurrence_deleted',
  ])
  if (!occurrenceTopics.has(input.topic)) return 'ignored' as const
  const scheduleChange = asRecord(payload.scheduleChange)
  const occurrenceId = [
    payload.occurrenceId,
    payload.eventId,
    scheduleChange.eventId,
    input.aggregateId,
  ].find(
    (value): value is string => typeof value === 'string' && value.length > 0,
  )
  if (!occurrenceId) return 'ignored' as const
  return store.synchronizeOccurrence({
    workspaceId: input.workspaceId,
    occurrenceId,
    cancellation: parseCancellationContext(payload.jobCancellation) ?? {
      reason: JobCancellationReason.SCHEDULE_CANCELED,
      note: null,
    },
    now,
  })
}

export function createRecurringJobLifecycleService(
  store: RecurringJobLifecycleStore,
  dependencies: {
    cancelOccurrence(input: {
      actor: {
        workspaceId: string
        actorUserId: string
        workspaceMemberId: string
        canManageScheduling: true
      }
      eventId: string
      status: 'canceled'
      scope: 'thisOccurrence'
      expectedVersion?: number
      idempotencyKey?: string
      jobCancellation: CancellationContext
    }): Promise<unknown>
    rescheduleOccurrence(input: {
      actor: {
        workspaceId: string
        actorUserId: string
        workspaceMemberId: string
        canManageScheduling: true
      }
      eventId: string
      input: { startsAt: string; endsAt: string }
      scope: 'thisOccurrence'
      expectedVersion?: number
      idempotencyKey?: string
    }): Promise<unknown>
  },
  options: { now?: () => Date } = {},
) {
  const now = options.now ?? (() => new Date())
  const requireRecurringJob = async (actor: LifecycleActor, jobId: string) => {
    const job = await store.findJob({ workspaceId: actor.workspaceId, jobId })
    if (!job?.recurringServiceId || !job.schedulingEventId) {
      throw lifecycleNotFound()
    }
    return job as JobRecord & {
      recurringServiceId: string
      schedulingEventId: string
    }
  }
  const schedulingActor = (actor: LifecycleActor) => ({
    workspaceId: actor.workspaceId,
    actorUserId: actor.userProfileId,
    workspaceMemberId: actor.workspaceMemberId,
    canManageScheduling: true as const,
  })

  return {
    async reportUnableToComplete(
      actor: LifecycleActor,
      jobId: string,
      rawInput: unknown,
    ) {
      const parsed = reportUnableToCompleteSchema.safeParse(rawInput)
      if (!parsed.success) {
        throw new OperationsServiceError(
          'Unable to Complete details are invalid.',
          400,
          'VALIDATION_ERROR',
          parsed.error.flatten().fieldErrors,
        )
      }
      const job = await requireRecurringJob(actor, jobId)
      if (
        job.status !== JobStatus.SCHEDULED &&
        job.status !== JobStatus.IN_PROGRESS
      ) {
        throw lifecycleConflict(
          'Only a scheduled or in-progress recurring Job can be marked unable to complete.',
        )
      }
      if (
        !actor.canManage &&
        !(await store.canExecuteJob({
          workspaceId: actor.workspaceId,
          jobId,
          workspaceMemberId: actor.workspaceMemberId,
        }))
      ) {
        throw new OperationsServiceError(
          'You can only report Unable to Complete for a recurring Job assigned to you or your active team.',
          403,
          'FORBIDDEN',
        )
      }
      const updated = await store.markUnableToComplete({
        workspaceId: actor.workspaceId,
        jobId,
        expectedStatus: job.status,
        reporterMemberId: actor.workspaceMemberId,
        reason: parsed.data.reason,
        note: parsed.data.note ?? null,
        executorMemberId: actor.canManage ? undefined : actor.workspaceMemberId,
        occurredAt: now(),
      })
      if (!updated)
        throw lifecycleConflict('The Job changed before the report was saved.')
      return updated
    },

    async skipVisit(actor: LifecycleActor, jobId: string, rawInput: unknown) {
      if (!actor.canManage) {
        throw new OperationsServiceError('Forbidden', 403, 'FORBIDDEN')
      }
      const parsed = skipRecurringJobSchema.safeParse(rawInput)
      if (!parsed.success) {
        throw new OperationsServiceError(
          'Skip Visit details are invalid.',
          400,
          'VALIDATION_ERROR',
          parsed.error.flatten().fieldErrors,
        )
      }
      const job = await requireRecurringJob(actor, jobId)
      if (
        job.status === JobStatus.COMPLETED ||
        job.status === JobStatus.CANCELED
      ) {
        throw lifecycleConflict('This recurring Job is already finalized.')
      }
      const cancellation = {
        reason: parsed.data.reason,
        note: parsed.data.note ?? null,
      }
      const occurrenceId = job.schedulingEventId
      await runSchedulingMutation(() =>
        dependencies.cancelOccurrence({
          actor: schedulingActor(actor),
          eventId: occurrenceId,
          status: 'canceled',
          scope: 'thisOccurrence',
          expectedVersion: parsed.data.expectedVersion,
          idempotencyKey: parsed.data.idempotencyKey,
          jobCancellation: cancellation,
        }),
      )
      await store.synchronizeOccurrence({
        workspaceId: actor.workspaceId,
        occurrenceId,
        cancellation,
        now: now(),
      })
      return requireRecurringJob(actor, jobId)
    },

    async rescheduleUnable(
      actor: LifecycleActor,
      jobId: string,
      rawInput: unknown,
    ) {
      if (!actor.canManage) {
        throw new OperationsServiceError('Forbidden', 403, 'FORBIDDEN')
      }
      const parsed = rescheduleUnableRecurringJobSchema.safeParse(rawInput)
      if (!parsed.success) {
        throw new OperationsServiceError(
          'Reschedule details are invalid.',
          400,
          'VALIDATION_ERROR',
          parsed.error.flatten().fieldErrors,
        )
      }
      const job = await requireRecurringJob(actor, jobId)
      if (job.status !== JobStatus.UNABLE_TO_COMPLETE) {
        throw lifecycleConflict(
          'Only an unable recurring Job can be rescheduled here.',
        )
      }
      if (
        job.scheduledStartAt?.toISOString() === parsed.data.startsAt &&
        job.scheduledEndAt?.toISOString() === parsed.data.endsAt
      ) {
        throw lifecycleConflict(
          'Choose a different occurrence time to reschedule this Job.',
        )
      }
      const occurrenceId = job.schedulingEventId
      await runSchedulingMutation(() =>
        dependencies.rescheduleOccurrence({
          actor: schedulingActor(actor),
          eventId: occurrenceId,
          input: { startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt },
          scope: 'thisOccurrence',
          expectedVersion: parsed.data.expectedVersion,
          idempotencyKey: parsed.data.idempotencyKey,
        }),
      )
      await store.synchronizeOccurrence({
        workspaceId: actor.workspaceId,
        occurrenceId,
        cancellation: {
          reason: JobCancellationReason.SCHEDULE_CANCELED,
          note: null,
        },
        now: now(),
      })
      return requireRecurringJob(actor, jobId)
    },
  }
}

async function cancelOccurrenceThroughScheduling(
  input: Parameters<
    Parameters<typeof createRecurringJobLifecycleService>[1]['cancelOccurrence']
  >[0],
) {
  const { changeSchedulingEventStatus } =
    await import('@/lib/scheduling/services/schedulingService')
  return changeSchedulingEventStatus(input)
}

async function rescheduleOccurrenceThroughScheduling(
  input: Parameters<
    Parameters<
      typeof createRecurringJobLifecycleService
    >[1]['rescheduleOccurrence']
  >[0],
) {
  const { updateSchedulingEvent } =
    await import('@/lib/scheduling/services/schedulingService')
  return updateSchedulingEvent(input)
}

export const recurringJobLifecycleService = createRecurringJobLifecycleService(
  prismaRecurringJobLifecycleStore,
  {
    cancelOccurrence: cancelOccurrenceThroughScheduling,
    rescheduleOccurrence: rescheduleOccurrenceThroughScheduling,
  },
)
