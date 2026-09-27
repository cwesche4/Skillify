import { z } from 'zod'

import {
  JobStatus,
  OperationsPriority,
  WorkspaceBusinessModel,
  WorkItemKind,
  WorkItemStatus,
  type JobStatus as JobStatusValue,
  type WorkItemStatus as WorkItemStatusValue,
} from '@/lib/prisma/enums'
import type {
  CreateJobData,
  CreateWorkItemData,
  JobRecord,
  UpdateJobData,
  UpdateJobResult,
  UpdateWorkItemData,
  WorkItemRecord,
} from '@/lib/jobs/types'
import {
  createJobSchema,
  createJobStepSchema,
  createTodoSchema,
  createWorkItemSchema,
  executeAssignedJobSchema,
  executeAssignedWorkItemSchema,
  jobListQuerySchema,
  updateJobSchema,
  updateWorkItemSchema,
} from '@/lib/jobs/validation'

export class OperationsServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 403 | 404 | 409,
    readonly code: 'VALIDATION_ERROR' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT',
    readonly fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message)
    this.name = 'OperationsServiceError'
  }
}

export type JobsStore = {
  getWorkspaceBusinessModel(workspaceId: string): Promise<string | null>
  isWorkspaceMember(input: {
    workspaceId: string
    memberId: string
  }): Promise<boolean>
  canExecuteJob(input: {
    workspaceId: string
    jobId: string
    workspaceMemberId: string
  }): Promise<boolean>
  findActiveCustomer(input: {
    workspaceId: string
    customerId: string
  }): Promise<{ id: string; displayName: string } | null>
  createJob(data: CreateJobData): Promise<JobRecord>
  findJob(input: {
    workspaceId: string
    jobId: string
  }): Promise<JobRecord | null>
  listJobs(input: {
    workspaceId: string
    customerId?: string
  }): Promise<JobRecord[]>
  updateJob(input: {
    workspaceId: string
    jobId: string
    actorUserId?: string
    executionMemberId?: string
    expectedStatus?: JobStatusValue
    data: UpdateJobData
  }): Promise<UpdateJobResult | null>
  archiveJobWithWorkItems(input: {
    workspaceId: string
    jobId: string
    archivedAt: Date
  }): Promise<JobRecord>
  createWorkItem(data: CreateWorkItemData): Promise<WorkItemRecord>
  findWorkItem(input: {
    workspaceId: string
    workItemId: string
  }): Promise<WorkItemRecord | null>
  listWorkItems(input: {
    workspaceId: string
    jobId?: string
    kind?: WorkItemKind
  }): Promise<WorkItemRecord[]>
  updateWorkItem(input: {
    workspaceId: string
    workItemId: string
    kind: WorkItemKind
    jobId: string | null
    expectedStatus?: WorkItemStatusValue
    data: UpdateWorkItemData
  }): Promise<WorkItemRecord | null>
  executeAssignedWorkItem(input: {
    workspaceId: string
    workItemId: string
    kind: WorkItemKind
    jobId: string | null
    assigneeMemberId: string
    expectedStatus: WorkItemStatusValue
    data: Pick<UpdateWorkItemData, 'status' | 'notes' | 'completedAt'>
  }): Promise<WorkItemRecord | null>
}

export type OperationsActor = {
  workspaceId: string
  userProfileId: string
}

export type MemberExecutionActor = OperationsActor & {
  workspaceMemberId: string
  canManage?: boolean
}

const JOB_TRANSITIONS: Record<JobStatusValue, readonly JobStatusValue[]> = {
  OPEN: [
    'SCHEDULED',
    'IN_PROGRESS',
    'WAITING_ON_CLIENT',
    'COMPLETED',
    'CANCELED',
  ],
  SCHEDULED: [
    'OPEN',
    'IN_PROGRESS',
    'WAITING_ON_CLIENT',
    'UNABLE_TO_COMPLETE',
    'COMPLETED',
    'CANCELED',
  ],
  IN_PROGRESS: [
    'OPEN',
    'SCHEDULED',
    'WAITING_ON_CLIENT',
    'UNABLE_TO_COMPLETE',
    'COMPLETED',
    'CANCELED',
  ],
  WAITING_ON_CLIENT: [
    'OPEN',
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELED',
  ],
  UNABLE_TO_COMPLETE: ['SCHEDULED', 'CANCELED'],
  COMPLETED: ['IN_PROGRESS'],
  CANCELED: ['OPEN'],
}

const WORK_ITEM_TRANSITIONS: Record<
  WorkItemStatusValue,
  readonly WorkItemStatusValue[]
> = {
  OPEN: ['IN_PROGRESS', 'COMPLETED', 'CANCELED'],
  IN_PROGRESS: ['OPEN', 'COMPLETED', 'CANCELED'],
  COMPLETED: ['OPEN'],
  CANCELED: ['OPEN'],
}

function validationError(error: z.ZodError) {
  return new OperationsServiceError(
    'The operations request is invalid.',
    400,
    'VALIDATION_ERROR',
    error.flatten().fieldErrors,
  )
}

function parse<T>(
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  input: unknown,
): T {
  const result = schema.safeParse(input)
  if (!result.success) throw validationError(result.error)
  return result.data
}

function notFound(recordType: 'Job' | 'Work Item') {
  return new OperationsServiceError(
    `${recordType} not found.`,
    404,
    'NOT_FOUND',
  )
}

function memberExecutionForbidden() {
  return new OperationsServiceError(
    'You can only update status or notes on work assigned to you.',
    403,
    'FORBIDDEN',
  )
}

function invalidCustomer() {
  return new OperationsServiceError(
    'Choose an active Customer from this workspace.',
    400,
    'VALIDATION_ERROR',
    { customerId: ['Choose an active Customer from this workspace.'] },
  )
}

function staleStatusConflict(recordType: 'Job' | 'Work Item') {
  return new OperationsServiceError(
    `${recordType} changed before this update was saved. Refresh and try again.`,
    409,
    'CONFLICT',
  )
}

function recurringJobHistoryConflict() {
  return new OperationsServiceError(
    'Finalized recurring Job history cannot be changed through generic Job actions.',
    409,
    'CONFLICT',
  )
}

function assertTransition<T extends string>(
  label: string,
  current: T,
  next: T,
  transitions: Record<T, readonly T[]>,
) {
  if (current === next || transitions[current].includes(next)) return
  throw new OperationsServiceError(
    `${label} status cannot change from ${current} to ${next}.`,
    400,
    'VALIDATION_ERROR',
  )
}

function assertSchedule(start: Date | null, end: Date | null) {
  if (start && end && end.getTime() <= start.getTime()) {
    throw new OperationsServiceError(
      'Scheduled end must be after scheduled start.',
      400,
      'VALIDATION_ERROR',
      { scheduledEndAt: ['Scheduled end must be after scheduled start.'] },
    )
  }
}

async function assertAssignee(
  store: JobsStore,
  workspaceId: string,
  assigneeMemberId: string | null | undefined,
) {
  if (!assigneeMemberId) return
  if (
    await store.isWorkspaceMember({ workspaceId, memberId: assigneeMemberId })
  ) {
    return
  }
  throw new OperationsServiceError(
    'Assignee is not a member of this workspace.',
    400,
    'VALIDATION_ERROR',
    { assigneeMemberId: ['Choose a member of this workspace.'] },
  )
}

async function resolveActiveCustomer(
  store: JobsStore,
  workspaceId: string,
  customerId: string,
) {
  const customer = await store.findActiveCustomer({ workspaceId, customerId })
  if (!customer) throw invalidCustomer()
  return customer
}

function completionTimestamp(
  currentStatus: string,
  nextStatus: string | undefined,
  completedStatus: string,
  now: () => Date,
) {
  if (!nextStatus || nextStatus === currentStatus) return undefined
  if (nextStatus === completedStatus) return now()
  if (currentStatus === completedStatus) return null
  return undefined
}

export function createOperationsService(
  store: JobsStore,
  options: {
    now?: () => Date
    processCommittedEvent?: (eventId: string) => Promise<unknown>
    onEventProcessingError?: (error: unknown) => void
  } = {},
) {
  const now = options.now ?? (() => new Date())
  const processCommittedCompletion = (completionEventId: string | null) => {
    if (!completionEventId || !options.processCommittedEvent) return
    // Execution is deliberately detached from the committed Job mutation.
    // The durable recovery drain owns eventual delivery if this attempt fails.
    void Promise.resolve()
      .then(() => options.processCommittedEvent!(completionEventId))
      .catch((error) => options.onEventProcessingError?.(error))
  }

  return {
    async createJob(actor: OperationsActor, rawInput: unknown) {
      const input = parse(createJobSchema, rawInput)
      const durableCustomersEnabled =
        (await store.getWorkspaceBusinessModel(actor.workspaceId)) ===
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
      await assertAssignee(store, actor.workspaceId, input.assigneeMemberId)
      const customer = input.customerId
        ? await resolveActiveCustomer(
            store,
            actor.workspaceId,
            input.customerId,
          )
        : null
      assertSchedule(
        input.scheduledStartAt ?? null,
        input.scheduledEndAt ?? null,
      )
      const status = input.status ?? JobStatus.OPEN
      if (status === JobStatus.UNABLE_TO_COMPLETE) {
        throw new OperationsServiceError(
          'Unable to Complete can only be reported for an existing assigned recurring Job.',
          400,
          'VALIDATION_ERROR',
        )
      }
      return store.createJob({
        workspaceId: actor.workspaceId,
        title: input.title,
        description: input.description ?? null,
        notes: input.notes ?? null,
        status,
        priority: input.priority ?? OperationsPriority.NORMAL,
        customerReferenceId: input.customerReferenceId ?? null,
        customerId: customer?.id ?? null,
        customerDisplayName:
          customer?.displayName ??
          (durableCustomersEnabled
            ? null
            : (input.customerDisplayName ?? null)),
        valueCents: input.valueCents ?? null,
        currency: input.currency ?? 'USD',
        scheduledStartAt: input.scheduledStartAt ?? null,
        scheduledEndAt: input.scheduledEndAt ?? null,
        recurringServiceId: null,
        schedulingEventId: null,
        serviceInstructionsSnapshot: null,
        completedAt: status === JobStatus.COMPLETED ? now() : null,
        assigneeMemberId: input.assigneeMemberId ?? null,
        createdByUserId: actor.userProfileId,
      })
    },

    getJob(workspaceId: string, jobId: string) {
      return store.findJob({ workspaceId, jobId })
    },

    listJobs(workspaceId: string, rawQuery: unknown = {}) {
      const query = parse(jobListQuerySchema, rawQuery)
      return store.listJobs({
        workspaceId,
        customerId: query.customerId ?? undefined,
      })
    },

    async updateJob(actor: OperationsActor, jobId: string, rawInput: unknown) {
      const existing = await store.findJob({
        workspaceId: actor.workspaceId,
        jobId,
      })
      if (!existing) throw notFound('Job')
      const input = parse(updateJobSchema, rawInput)

      if (input.status === JobStatus.UNABLE_TO_COMPLETE) {
        throw new OperationsServiceError(
          'Use the Unable to Complete action so its reason and reporter are recorded.',
          400,
          'VALIDATION_ERROR',
        )
      }
      if (existing.schedulingEventId) {
        if (
          Object.prototype.hasOwnProperty.call(input, 'scheduledStartAt') ||
          Object.prototype.hasOwnProperty.call(input, 'scheduledEndAt')
        ) {
          throw new OperationsServiceError(
            'Reschedule this recurring Job through its Scheduling occurrence.',
            409,
            'CONFLICT',
          )
        }
        if (Object.prototype.hasOwnProperty.call(input, 'assigneeMemberId')) {
          throw new OperationsServiceError(
            'Change recurring Job assignments through the linked Scheduling occurrence.',
            409,
            'CONFLICT',
          )
        }
        if (Object.prototype.hasOwnProperty.call(input, 'customerId')) {
          throw new OperationsServiceError(
            'A recurring Job keeps the Customer from its Recurring Service snapshot.',
            409,
            'CONFLICT',
          )
        }
        if (input.status === JobStatus.CANCELED) {
          throw new OperationsServiceError(
            'Cancel or skip this recurring Job through its Scheduling occurrence.',
            409,
            'CONFLICT',
          )
        }
        if (
          (existing.status === JobStatus.COMPLETED ||
            existing.status === JobStatus.CANCELED) &&
          input.status !== existing.status
        ) {
          throw new OperationsServiceError(
            'Finalized recurring Job history cannot be reopened through the generic Job API.',
            409,
            'CONFLICT',
          )
        }
        if (
          existing.status === JobStatus.UNABLE_TO_COMPLETE &&
          input.status !== undefined
        ) {
          throw new OperationsServiceError(
            'Resolve an unable recurring Job with Reschedule or Skip Visit.',
            409,
            'CONFLICT',
          )
        }
      }
      const durableCustomersEnabled =
        (await store.getWorkspaceBusinessModel(actor.workspaceId)) ===
        WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS
      await assertAssignee(store, actor.workspaceId, input.assigneeMemberId)

      const customerChangeRequested = Object.prototype.hasOwnProperty.call(
        input,
        'customerId',
      )
      const customerChanged =
        customerChangeRequested && input.customerId !== existing.customerId
      const customer =
        customerChanged && input.customerId
          ? await resolveActiveCustomer(
              store,
              actor.workspaceId,
              input.customerId,
            )
          : null

      if (input.status) {
        assertTransition('Job', existing.status, input.status, JOB_TRANSITIONS)
      }
      const scheduledStartAt =
        input.scheduledStartAt === undefined
          ? existing.scheduledStartAt
          : input.scheduledStartAt
      const scheduledEndAt =
        input.scheduledEndAt === undefined
          ? existing.scheduledEndAt
          : input.scheduledEndAt
      assertSchedule(scheduledStartAt, scheduledEndAt)
      const completedAt = completionTimestamp(
        existing.status,
        input.status,
        JobStatus.COMPLETED,
        now,
      )

      const data: UpdateJobData = { ...input }
      if (customerChanged) {
        // Reassignment captures a fresh authoritative snapshot. Unlinking
        // intentionally preserves the existing historical snapshot.
        if (customer) data.customerDisplayName = customer.displayName
        else delete data.customerDisplayName
      } else if (existing.customerId || durableCustomersEnabled) {
        // A linked Job's snapshot cannot be rewritten through the generic
        // display-name field while its durable association is unchanged. In
        // Simple Service this also preserves the last snapshot after unlink;
        // legacy workspace models retain their free-text customer context.
        delete data.customerId
        delete data.customerDisplayName
      }

      const updated = await store.updateJob({
        workspaceId: actor.workspaceId,
        jobId,
        actorUserId: actor.userProfileId,
        expectedStatus: input.status ? existing.status : undefined,
        data: {
          ...data,
          ...(completedAt === undefined ? {} : { completedAt }),
        },
      })
      if (!updated) {
        if (input.status) throw staleStatusConflict('Job')
        throw notFound('Job')
      }
      processCommittedCompletion(updated.completionEventId)
      return updated.job
    },

    async executeAssignedJob(
      actor: MemberExecutionActor,
      jobId: string,
      rawInput: unknown,
    ) {
      const existing = await store.findJob({
        workspaceId: actor.workspaceId,
        jobId,
      })
      if (!existing) throw notFound('Job')
      if (
        existing.status === JobStatus.COMPLETED ||
        existing.status === JobStatus.CANCELED ||
        existing.status === JobStatus.UNABLE_TO_COMPLETE
      ) {
        throw new OperationsServiceError(
          'This Job cannot be changed through field execution.',
          409,
          'CONFLICT',
        )
      }
      const input = parse(executeAssignedJobSchema, rawInput)
      const executionMemberId = actor.canManage
        ? undefined
        : actor.workspaceMemberId
      if (
        executionMemberId &&
        !(await store.canExecuteJob({
          workspaceId: actor.workspaceId,
          jobId,
          workspaceMemberId: executionMemberId,
        }))
      ) {
        throw memberExecutionForbidden()
      }
      if (input.status) {
        assertTransition('Job', existing.status, input.status, JOB_TRANSITIONS)
      }
      const completedAt = completionTimestamp(
        existing.status,
        input.status,
        JobStatus.COMPLETED,
        now,
      )
      const updated = await store.updateJob({
        workspaceId: actor.workspaceId,
        jobId,
        actorUserId: actor.userProfileId,
        executionMemberId,
        expectedStatus: existing.status,
        data: {
          ...input,
          ...(completedAt === undefined ? {} : { completedAt }),
        },
      })
      if (!updated) {
        if (
          executionMemberId &&
          !(await store.canExecuteJob({
            workspaceId: actor.workspaceId,
            jobId,
            workspaceMemberId: executionMemberId,
          }))
        ) {
          throw memberExecutionForbidden()
        }
        throw staleStatusConflict('Job')
      }
      processCommittedCompletion(updated.completionEventId)
      return updated.job
    },

    async archiveJob(actor: OperationsActor, jobId: string) {
      const existing = await store.findJob({
        workspaceId: actor.workspaceId,
        jobId,
      })
      if (!existing) throw notFound('Job')
      if (existing.schedulingEventId) {
        throw new OperationsServiceError(
          'Recurring Job history cannot be archived independently. Skip the visit or end the Recurring Service instead.',
          409,
          'CONFLICT',
        )
      }
      return store.archiveJobWithWorkItems({
        workspaceId: actor.workspaceId,
        jobId,
        archivedAt: now(),
      })
    },

    async createWorkItem(actor: OperationsActor, rawInput: unknown) {
      const input = parse(createWorkItemSchema, rawInput)
      await assertAssignee(store, actor.workspaceId, input.assigneeMemberId)

      if (input.kind === WorkItemKind.JOB_STEP) {
        const job = await store.findJob({
          workspaceId: actor.workspaceId,
          jobId: input.jobId as string,
        })
        if (!job) throw notFound('Job')
        if (
          job.schedulingEventId &&
          (job.status === JobStatus.COMPLETED ||
            job.status === JobStatus.CANCELED)
        ) {
          throw recurringJobHistoryConflict()
        }
      }

      const status = input.status ?? WorkItemStatus.OPEN
      return store.createWorkItem({
        workspaceId: actor.workspaceId,
        kind: input.kind,
        jobId: input.jobId ?? null,
        title: input.title,
        description: input.description ?? null,
        notes: input.notes ?? null,
        status,
        priority: input.priority ?? OperationsPriority.NORMAL,
        dueAt: input.dueAt ?? null,
        completedAt: status === WorkItemStatus.COMPLETED ? now() : null,
        sortOrder: null,
        assigneeMemberId: input.assigneeMemberId ?? null,
        createdByUserId: actor.userProfileId,
      })
    },

    async createJobStep(
      actor: OperationsActor,
      jobId: string,
      rawInput: unknown,
    ) {
      const input = parse(createJobStepSchema, rawInput)
      return this.createWorkItem(actor, {
        ...input,
        kind: WorkItemKind.JOB_STEP,
        jobId,
      })
    },

    async createTodo(actor: OperationsActor, rawInput: unknown) {
      const input = parse(createTodoSchema, rawInput)
      return this.createWorkItem(actor, {
        ...input,
        kind: WorkItemKind.TODO,
        jobId: null,
      })
    },

    getWorkItem(workspaceId: string, workItemId: string) {
      return store.findWorkItem({ workspaceId, workItemId })
    },

    listWorkItems(input: {
      workspaceId: string
      jobId?: string
      kind?: WorkItemKind
    }) {
      return store.listWorkItems(input)
    },

    async updateWorkItem(
      actor: OperationsActor,
      workItemId: string,
      rawInput: unknown,
    ) {
      const existing = await store.findWorkItem({
        workspaceId: actor.workspaceId,
        workItemId,
      })
      if (!existing) throw notFound('Work Item')
      if (existing.kind === WorkItemKind.JOB_STEP && existing.jobId) {
        const parent = await store.findJob({
          workspaceId: actor.workspaceId,
          jobId: existing.jobId,
        })
        if (!parent) throw notFound('Job')
        if (
          parent.schedulingEventId &&
          (parent.status === JobStatus.COMPLETED ||
            parent.status === JobStatus.CANCELED)
        ) {
          throw recurringJobHistoryConflict()
        }
      }
      const input = parse(updateWorkItemSchema, rawInput)
      await assertAssignee(store, actor.workspaceId, input.assigneeMemberId)
      if (input.status) {
        assertTransition(
          'Work Item',
          existing.status,
          input.status,
          WORK_ITEM_TRANSITIONS,
        )
      }
      const completedAt = completionTimestamp(
        existing.status,
        input.status,
        WorkItemStatus.COMPLETED,
        now,
      )
      const updated = await store.updateWorkItem({
        workspaceId: actor.workspaceId,
        workItemId,
        kind: existing.kind,
        jobId: existing.jobId,
        expectedStatus: input.status ? existing.status : undefined,
        data: {
          ...input,
          ...(completedAt === undefined ? {} : { completedAt }),
        },
      })
      if (!updated) {
        if (input.status) throw staleStatusConflict('Work Item')
        throw notFound('Work Item')
      }
      return updated
    },

    async executeAssignedWorkItem(
      actor: MemberExecutionActor,
      workItemId: string,
      rawInput: unknown,
    ) {
      const existing = await store.findWorkItem({
        workspaceId: actor.workspaceId,
        workItemId,
      })
      if (!existing) throw notFound('Work Item')
      if (existing.kind === WorkItemKind.JOB_STEP && existing.jobId) {
        const parent = await store.findJob({
          workspaceId: actor.workspaceId,
          jobId: existing.jobId,
        })
        if (!parent) throw notFound('Job')
        if (
          parent.status === JobStatus.COMPLETED ||
          parent.status === JobStatus.CANCELED ||
          parent.status === JobStatus.UNABLE_TO_COMPLETE
        ) {
          throw new OperationsServiceError(
            'Job Steps cannot be executed while their parent Job is finalized or awaiting management resolution.',
            409,
            'CONFLICT',
          )
        }
      }
      const canExecuteParentJob =
        existing.kind === WorkItemKind.JOB_STEP && existing.jobId
          ? await store.canExecuteJob({
              workspaceId: actor.workspaceId,
              jobId: existing.jobId,
              workspaceMemberId: actor.workspaceMemberId,
            })
          : false
      if (
        existing.assigneeMemberId !== actor.workspaceMemberId &&
        !canExecuteParentJob
      ) {
        throw memberExecutionForbidden()
      }

      const input = parse(executeAssignedWorkItemSchema, rawInput)
      if (input.status) {
        assertTransition(
          'Work Item',
          existing.status,
          input.status,
          WORK_ITEM_TRANSITIONS,
        )
      }
      const completedAt = completionTimestamp(
        existing.status,
        input.status,
        WorkItemStatus.COMPLETED,
        now,
      )
      const updated = await store.executeAssignedWorkItem({
        workspaceId: actor.workspaceId,
        workItemId,
        kind: existing.kind,
        jobId: existing.jobId,
        assigneeMemberId: actor.workspaceMemberId,
        expectedStatus: existing.status,
        data: {
          ...input,
          ...(completedAt === undefined ? {} : { completedAt }),
        },
      })
      if (!updated) throw memberExecutionForbidden()
      return updated
    },

    async archiveWorkItem(actor: OperationsActor, workItemId: string) {
      const existing = await store.findWorkItem({
        workspaceId: actor.workspaceId,
        workItemId,
      })
      if (!existing) throw notFound('Work Item')
      if (existing.kind === WorkItemKind.JOB_STEP && existing.jobId) {
        const parent = await store.findJob({
          workspaceId: actor.workspaceId,
          jobId: existing.jobId,
        })
        if (!parent) throw notFound('Job')
        if (
          parent.schedulingEventId &&
          (parent.status === JobStatus.COMPLETED ||
            parent.status === JobStatus.CANCELED)
        ) {
          throw recurringJobHistoryConflict()
        }
      }
      const archived = await store.updateWorkItem({
        workspaceId: actor.workspaceId,
        workItemId,
        kind: existing.kind,
        jobId: existing.jobId,
        data: { archivedAt: now() },
      })
      if (!archived) throw notFound('Work Item')
      return archived
    },
  }
}

export type OperationsService = ReturnType<typeof createOperationsService>
