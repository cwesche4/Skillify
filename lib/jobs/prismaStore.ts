import { randomUUID } from 'crypto'

import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/db'
import {
  createNativeJobCompletedPayload,
  NATIVE_JOB_AGGREGATE_TYPE,
  NATIVE_JOB_COMPLETED_TOPIC,
} from '@/lib/domain-events/nativeJobEvents'
import { OperationsServiceError, type JobsStore } from '@/lib/jobs/service'
import { JobStatus, WorkspaceBusinessModel } from '@/lib/prisma/enums'
import {
  canWorkspaceMemberExecuteJob,
  jobExecutionEligibilityWhere,
  lockAndValidateRecurringJobExecution,
} from '@/lib/jobs/jobExecutionAuthorization'

export const prismaJobsStore: JobsStore = {
  async getWorkspaceBusinessModel(workspaceId) {
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { businessModel: true },
    })
    return workspace?.businessModel ?? null
  },

  async isWorkspaceMember({ workspaceId, memberId }) {
    const member = await prisma.workspaceMember.findFirst({
      where: { id: memberId, workspaceId },
      select: { id: true },
    })
    return Boolean(member)
  },

  canExecuteJob({ workspaceId, jobId, workspaceMemberId }) {
    return canWorkspaceMemberExecuteJob({
      workspaceId,
      jobId,
      workspaceMemberId,
    })
  },

  findActiveCustomer({ workspaceId, customerId }) {
    return prisma.customer.findFirst({
      where: {
        id: customerId,
        workspaceId,
        archivedAt: null,
        workspace: {
          businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
        },
      },
      select: { id: true, displayName: true },
    })
  },

  createJob(data) {
    if (!data.customerId) return prisma.job.create({ data })
    return prisma.$transaction(async (tx) => {
      const customers = await tx.$queryRaw<
        Array<{ id: string; displayName: string }>
      >`
        SELECT customer."id", customer."displayName"
        FROM "Customer" AS customer
        INNER JOIN "Workspace" AS workspace
          ON workspace."id" = customer."workspaceId"
        WHERE customer."id" = ${data.customerId}
          AND customer."workspaceId" = ${data.workspaceId}
          AND customer."archivedAt" IS NULL
          AND workspace."businessModel" = 'SIMPLE_SERVICE_BUSINESS'
        FOR UPDATE
      `
      const customer = customers[0]
      if (!customer) {
        throw new OperationsServiceError(
          'Choose an active Customer from this workspace.',
          400,
          'VALIDATION_ERROR',
          { customerId: ['Choose an active Customer from this workspace.'] },
        )
      }
      return tx.job.create({
        data: { ...data, customerDisplayName: customer.displayName },
      })
    })
  },

  findJob({ workspaceId, jobId }) {
    return prisma.job.findFirst({
      where: { id: jobId, workspaceId, archivedAt: null },
      include: { assignments: { orderBy: { createdAt: 'asc' } } },
    })
  },

  listJobs({ workspaceId, customerId }) {
    return prisma.job.findMany({
      where: { workspaceId, customerId, archivedAt: null },
      include: { assignments: { orderBy: { createdAt: 'asc' } } },
      orderBy: [{ scheduledStartAt: 'asc' }, { createdAt: 'desc' }],
    })
  },

  updateJob({
    workspaceId,
    jobId,
    actorUserId,
    executionMemberId,
    expectedStatus,
    data,
  }) {
    return prisma.$transaction(async (tx) => {
      if (
        executionMemberId &&
        !(await lockAndValidateRecurringJobExecution({
          tx,
          workspaceId,
          jobId,
          workspaceMemberId: executionMemberId,
        }))
      ) {
        return null
      }
      const recurringReference = await tx.job.findFirst({
        where: { id: jobId, workspaceId, archivedAt: null },
        select: { schedulingEventId: true },
      })
      if (recurringReference?.schedulingEventId) {
        // Recurrence mutations update the occurrence before their linked Job.
        // Use the same event-before-Job lock order so field/management writes
        // and cancel/skip serialize to one winner instead of both succeeding.
        const lockedEvents = await tx.$queryRaw<Array<{ id: string }>>(
          Prisma.sql`SELECT "id" FROM "SchedulingEvent" WHERE "id" = ${recurringReference.schedulingEventId} AND "workspaceId" = ${workspaceId} FOR UPDATE`,
        )
        if (lockedEvents.length !== 1) return null
        const event = await tx.schedulingEvent.findFirst({
          where: {
            id: recurringReference.schedulingEventId,
            workspaceId,
            deletedAt: null,
            status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
            occurrenceState: { in: ['GENERATED', 'OVERRIDDEN'] },
          },
          select: { id: true },
        })
        if (!event) return null
      }
      const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "Job" WHERE "id" = ${jobId} AND "workspaceId" = ${workspaceId} AND "archivedAt" IS NULL FOR UPDATE`,
      )
      if (lockedJobs.length !== 1) return null

      let safeData = data
      if (data.customerId) {
        const customers = await tx.$queryRaw<
          Array<{ id: string; displayName: string }>
        >`
          SELECT customer."id", customer."displayName"
          FROM "Customer" AS customer
          INNER JOIN "Workspace" AS workspace
            ON workspace."id" = customer."workspaceId"
          WHERE customer."id" = ${data.customerId}
            AND customer."workspaceId" = ${workspaceId}
            AND customer."archivedAt" IS NULL
            AND workspace."businessModel" = 'SIMPLE_SERVICE_BUSINESS'
          FOR UPDATE
        `
        const customer = customers[0]
        if (!customer) {
          throw new OperationsServiceError(
            'Choose an active Customer from this workspace.',
            400,
            'VALIDATION_ERROR',
            { customerId: ['Choose an active Customer from this workspace.'] },
          )
        }
        safeData = { ...data, customerDisplayName: customer.displayName }
      }
      const result = await tx.job.updateMany({
        where: {
          ...(executionMemberId
            ? jobExecutionEligibilityWhere({
                workspaceId,
                jobId,
                workspaceMemberId: executionMemberId,
              })
            : { id: jobId, workspaceId, archivedAt: null }),
          status: expectedStatus,
        },
        data: safeData,
      })
      if (result.count !== 1) return null
      const job = await tx.job.findFirst({
        where: { id: jobId, workspaceId },
        include: { assignments: { orderBy: { createdAt: 'asc' } } },
      })
      if (!job) return null

      const becameCompleted =
        expectedStatus !== undefined &&
        expectedStatus !== JobStatus.COMPLETED &&
        data.status === JobStatus.COMPLETED &&
        job.completedAt !== null
      if (!becameCompleted) return { job, completionEventId: null }
      const completedAt = job.completedAt
      if (!completedAt) return { job, completionEventId: null }

      const completionRevision = randomUUID()
      if (job.schedulingEventId) {
        await tx.domainOutboxEvent.create({
          data: {
            workspaceId,
            topic: 'scheduling.recurring_job.completed',
            aggregateType: 'Job',
            aggregateId: job.id,
            deduplicationKey: `scheduling:recurring-job-completed:${workspaceId}:${job.id}:${completionRevision}`,
            payload: {
              workspaceId,
              jobId: job.id,
              schedulingEventId: job.schedulingEventId,
              completedAt: completedAt.toISOString(),
              completionRevision,
              actorUserId: actorUserId ?? job.createdByUserId,
            },
          },
        })
      }
      const installation = await tx.simpleAutomationInstallation.findFirst({
        where: {
          workspaceId,
          definitionKey: 'job-completion-message',
          definitionVersion: 2,
          removedAt: null,
          automation: { status: 'ACTIVE' },
        },
        select: { id: true },
      })
      if (!installation) return { job, completionEventId: null }

      await tx.domainOutboxEvent.updateMany({
        where: {
          workspaceId,
          topic: NATIVE_JOB_COMPLETED_TOPIC,
          aggregateType: NATIVE_JOB_AGGREGATE_TYPE,
          aggregateId: job.id,
          status: { in: ['PENDING', 'FAILED'] },
        },
        data: {
          status: 'PROCESSED',
          processedAt: job.completedAt,
          processingOutcome: 'NO_OP_SUPERSEDED_BY_RECOMPLETION',
          nextAttemptAt: null,
        },
      })
      // A worker that already owns an older occurrence is fenced again by the
      // executor while holding the Job lock. Retain its lease so its processor
      // can reconcile the resulting terminal cancellation normally.
      await tx.domainOutboxEvent.updateMany({
        where: {
          workspaceId,
          topic: NATIVE_JOB_COMPLETED_TOPIC,
          aggregateType: NATIVE_JOB_AGGREGATE_TYPE,
          aggregateId: job.id,
          status: 'PROCESSING',
        },
        data: { processingOutcome: 'SUPERSEDED_BY_RECOMPLETION' },
      })
      const event = await tx.domainOutboxEvent.create({
        data: {
          workspaceId,
          topic: NATIVE_JOB_COMPLETED_TOPIC,
          aggregateType: NATIVE_JOB_AGGREGATE_TYPE,
          aggregateId: job.id,
          deduplicationKey: `native:job.completed:${workspaceId}:${job.id}:${completionRevision}`,
          payload: createNativeJobCompletedPayload({
            workspaceId,
            jobId: job.id,
            title: job.title,
            customerId: job.customerId,
            customerDisplayName: job.customerDisplayName,
            assignedMemberId: job.assigneeMemberId,
            completedAt,
            completionRevision,
            occurredAt: job.updatedAt,
          }),
          status: 'PENDING',
          availableAt: completedAt,
          nextAttemptAt: completedAt,
        },
        select: { id: true },
      })
      return { job, completionEventId: event.id }
    })
  },

  archiveJobWithWorkItems({ workspaceId, jobId, archivedAt }) {
    return prisma.$transaction(async (tx) => {
      const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Job"
        WHERE "id" = ${jobId}
          AND "workspaceId" = ${workspaceId}
          AND "archivedAt" IS NULL
        FOR UPDATE
      `
      if (lockedJobs.length !== 1) {
        throw new OperationsServiceError('Job not found.', 404, 'NOT_FOUND')
      }
      await tx.workItem.updateMany({
        where: {
          workspaceId,
          jobId,
          kind: 'JOB_STEP',
          archivedAt: null,
        },
        data: { archivedAt },
      })
      const result = await tx.job.updateMany({
        where: { id: jobId, workspaceId, archivedAt: null },
        data: { archivedAt },
      })
      if (result.count !== 1) {
        throw new Error('Scoped Job archive failed.')
      }
      const archived = await tx.job.findFirst({
        where: { id: jobId, workspaceId },
      })
      if (!archived) throw new Error('Archived Job could not be read.')
      return archived
    })
  },

  createWorkItem(data) {
    if (data.kind !== 'JOB_STEP') {
      return prisma.workItem.create({ data })
    }
    if (!data.jobId) {
      throw new OperationsServiceError(
        'A Job Step must belong to a Job.',
        400,
        'VALIDATION_ERROR',
      )
    }
    return prisma.$transaction(async (tx) => {
      // Serialize Job Step creation with Job archival. This closes the gap
      // between service validation and persistence without coupling to UI.
      const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "Job"
        WHERE "id" = ${data.jobId}
          AND "workspaceId" = ${data.workspaceId}
          AND "archivedAt" IS NULL
          AND ("schedulingEventId" IS NULL OR "status" NOT IN ('COMPLETED', 'CANCELED'))
        FOR UPDATE
      `
      if (lockedJobs.length !== 1) {
        throw new OperationsServiceError('Job not found.', 404, 'NOT_FOUND')
      }
      return tx.workItem.create({ data })
    })
  },

  findWorkItem({ workspaceId, workItemId }) {
    return prisma.workItem.findFirst({
      where: {
        id: workItemId,
        workspaceId,
        archivedAt: null,
        OR: [
          { kind: 'TODO' },
          { kind: 'JOB_STEP', job: { is: { archivedAt: null } } },
        ],
      },
    })
  },

  listWorkItems({ workspaceId, jobId, kind }) {
    return prisma.workItem.findMany({
      where: {
        workspaceId,
        jobId,
        kind,
        archivedAt: null,
        OR: [
          { kind: 'TODO' },
          { kind: 'JOB_STEP', job: { is: { archivedAt: null } } },
        ],
      },
      orderBy: [{ sortOrder: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
    })
  },

  updateWorkItem({
    workspaceId,
    workItemId,
    kind,
    jobId,
    expectedStatus,
    data,
  }) {
    return prisma.$transaction(async (tx) => {
      if (kind === 'JOB_STEP') {
        if (!jobId) return null
        const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Job"
          WHERE "id" = ${jobId}
            AND "workspaceId" = ${workspaceId}
            AND "archivedAt" IS NULL
            AND ("schedulingEventId" IS NULL OR "status" NOT IN ('COMPLETED', 'CANCELED'))
          FOR UPDATE
        `
        if (lockedJobs.length !== 1) return null
      }
      const result = await tx.workItem.updateMany({
        where: {
          id: workItemId,
          workspaceId,
          archivedAt: null,
          status: expectedStatus,
        },
        data,
      })
      if (result.count !== 1) return null
      return tx.workItem.findFirst({
        where: { id: workItemId, workspaceId },
      })
    })
  },

  async executeAssignedWorkItem({
    workspaceId,
    workItemId,
    kind,
    jobId,
    assigneeMemberId,
    expectedStatus,
    data,
  }) {
    return prisma.$transaction(async (tx) => {
      if (
        kind === 'JOB_STEP' &&
        jobId &&
        !(await lockAndValidateRecurringJobExecution({
          tx,
          workspaceId,
          jobId,
          workspaceMemberId: assigneeMemberId,
        }))
      ) {
        return null
      }
      const executionWhere: Prisma.WorkItemWhereInput =
        kind === 'JOB_STEP' && jobId
          ? {
              OR: [
                {
                  assigneeMemberId,
                  job: {
                    is: {
                      id: jobId,
                      workspaceId,
                      schedulingEventId: null,
                      archivedAt: null,
                    },
                  },
                },
                {
                  job: {
                    is: jobExecutionEligibilityWhere({
                      workspaceId,
                      jobId,
                      workspaceMemberId: assigneeMemberId,
                    }),
                  },
                },
              ],
            }
          : { assigneeMemberId }
      if (kind === 'JOB_STEP') {
        if (!jobId) return null
        const lockedJobs = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "Job"
          WHERE "id" = ${jobId}
            AND "workspaceId" = ${workspaceId}
            AND "archivedAt" IS NULL
            AND "status" NOT IN ('COMPLETED', 'CANCELED', 'UNABLE_TO_COMPLETE')
          FOR UPDATE
        `
        if (lockedJobs.length !== 1) return null
      }
      const result = await tx.workItem.updateMany({
        where: {
          id: workItemId,
          workspaceId,
          ...executionWhere,
          status: expectedStatus,
          archivedAt: null,
        },
        data,
      })
      if (result.count !== 1) return null
      return tx.workItem.findFirst({
        where: {
          id: workItemId,
          workspaceId,
          ...executionWhere,
          archivedAt: null,
        },
      })
    })
  },
}
