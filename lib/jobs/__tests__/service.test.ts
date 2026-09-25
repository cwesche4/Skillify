import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  JobStatus,
  OperationsPriority,
  WorkItemKind,
  WorkItemStatus,
} from '@/lib/prisma/enums'
import {
  createOperationsService,
  OperationsServiceError,
  type JobsStore,
} from '@/lib/jobs/service'
import type {
  CreateJobData,
  CreateWorkItemData,
  JobRecord,
  UpdateJobData,
  UpdateWorkItemData,
  WorkItemRecord,
} from '@/lib/jobs/types'

const NOW = new Date('2026-09-22T16:00:00.000Z')

function createMemoryStore() {
  let jobSequence = 0
  let workItemSequence = 0
  const jobs: JobRecord[] = []
  const workItems: WorkItemRecord[] = []
  const customers = [
    {
      id: 'customer-a',
      workspaceId: 'ws-a',
      displayName: 'ABC Landscaping',
      archivedAt: null as Date | null,
    },
    {
      id: 'customer-b',
      workspaceId: 'ws-a',
      displayName: 'Jones Residence',
      archivedAt: null as Date | null,
    },
    {
      id: 'customer-foreign',
      workspaceId: 'ws-b',
      displayName: 'Foreign Customer',
      archivedAt: null as Date | null,
    },
    {
      id: 'customer-archived',
      workspaceId: 'ws-a',
      displayName: 'Archived Customer',
      archivedAt: NOW,
    },
    {
      id: 'customer-legacy-model',
      workspaceId: 'ws-legacy',
      displayName: 'Legacy Model Customer',
      archivedAt: null as Date | null,
    },
  ]
  const durableCustomerWorkspaces = new Set(['ws-a', 'ws-b'])
  const members = new Set([
    'ws-a:member-a',
    'ws-a:member-other',
    'ws-b:member-b',
  ])
  const calls: string[] = []

  const store: JobsStore = {
    async getWorkspaceBusinessModel(workspaceId) {
      calls.push('getWorkspaceBusinessModel')
      return durableCustomerWorkspaces.has(workspaceId)
        ? 'SIMPLE_SERVICE_BUSINESS'
        : 'DIRECT_SALES'
    },
    async isWorkspaceMember({ workspaceId, memberId }) {
      calls.push('isWorkspaceMember')
      return members.has(`${workspaceId}:${memberId}`)
    },
    async findActiveCustomer({ workspaceId, customerId }) {
      calls.push('findActiveCustomer')
      const customer = customers.find(
        (candidate) =>
          durableCustomerWorkspaces.has(workspaceId) &&
          candidate.id === customerId &&
          candidate.workspaceId === workspaceId &&
          candidate.archivedAt === null,
      )
      return customer
        ? { id: customer.id, displayName: customer.displayName }
        : null
    },
    async createJob(data: CreateJobData) {
      calls.push('createJob')
      const customer = data.customerId
        ? customers.find(
            (candidate) =>
              durableCustomerWorkspaces.has(data.workspaceId) &&
              candidate.id === data.customerId &&
              candidate.workspaceId === data.workspaceId &&
              candidate.archivedAt === null,
          )
        : null
      if (data.customerId && !customer) {
        throw new OperationsServiceError(
          'Choose an active Customer from this workspace.',
          400,
          'VALIDATION_ERROR',
        )
      }
      const row: JobRecord = {
        ...data,
        customerDisplayName: customer?.displayName ?? data.customerDisplayName,
        id: `job-${++jobSequence}`,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
      }
      jobs.push(row)
      return row
    },
    async findJob({ workspaceId, jobId }) {
      calls.push('findJob')
      return (
        jobs.find(
          (job) =>
            job.id === jobId &&
            job.workspaceId === workspaceId &&
            job.archivedAt === null,
        ) ?? null
      )
    },
    async listJobs({ workspaceId, customerId }) {
      calls.push('listJobs')
      return jobs.filter(
        (job) =>
          job.workspaceId === workspaceId &&
          job.archivedAt === null &&
          (customerId === undefined || job.customerId === customerId),
      )
    },
    async updateJob({ workspaceId, jobId, expectedStatus, data }) {
      calls.push('updateJob')
      const index = jobs.findIndex(
        (job) =>
          job.id === jobId &&
          job.workspaceId === workspaceId &&
          job.archivedAt === null &&
          (expectedStatus === undefined || job.status === expectedStatus),
      )
      if (index < 0) return null
      const customer = data.customerId
        ? customers.find(
            (candidate) =>
              durableCustomerWorkspaces.has(workspaceId) &&
              candidate.id === data.customerId &&
              candidate.workspaceId === workspaceId &&
              candidate.archivedAt === null,
          )
        : null
      if (data.customerId && !customer) {
        throw new OperationsServiceError(
          'Choose an active Customer from this workspace.',
          400,
          'VALIDATION_ERROR',
        )
      }
      jobs[index] = {
        ...jobs[index],
        ...data,
        ...(customer ? { customerDisplayName: customer.displayName } : {}),
        updatedAt: NOW,
      }
      return { job: jobs[index], completionEventId: null }
    },
    async archiveJobWithWorkItems({ workspaceId, jobId, archivedAt }) {
      calls.push('archiveJobWithWorkItems')
      const job = jobs.find(
        (candidate) =>
          candidate.id === jobId &&
          candidate.workspaceId === workspaceId &&
          candidate.archivedAt === null,
      )
      if (!job) throw new Error('Scoped archive failed')
      job.archivedAt = archivedAt
      workItems.forEach((workItem) => {
        if (
          workItem.workspaceId === workspaceId &&
          workItem.jobId === jobId &&
          workItem.kind === WorkItemKind.JOB_STEP &&
          !workItem.archivedAt
        ) {
          workItem.archivedAt = archivedAt
        }
      })
      return job
    },
    async createWorkItem(data: CreateWorkItemData) {
      calls.push('createWorkItem')
      const row: WorkItemRecord = {
        ...data,
        id: `work-item-${++workItemSequence}`,
        createdAt: NOW,
        updatedAt: NOW,
        archivedAt: null,
      }
      workItems.push(row)
      return row
    },
    async findWorkItem({ workspaceId, workItemId }) {
      calls.push('findWorkItem')
      return (
        workItems.find(
          (workItem) =>
            workItem.id === workItemId &&
            workItem.workspaceId === workspaceId &&
            workItem.archivedAt === null &&
            (workItem.kind === WorkItemKind.TODO ||
              jobs.some(
                (job) =>
                  job.id === workItem.jobId &&
                  job.workspaceId === workspaceId &&
                  job.archivedAt === null,
              )),
        ) ?? null
      )
    },
    async listWorkItems({ workspaceId, jobId, kind }) {
      calls.push('listWorkItems')
      return workItems.filter(
        (workItem) =>
          workItem.workspaceId === workspaceId &&
          workItem.archivedAt === null &&
          (jobId === undefined || workItem.jobId === jobId) &&
          (kind === undefined || workItem.kind === kind),
      )
    },
    async updateWorkItem({
      workspaceId,
      workItemId,
      kind,
      jobId,
      expectedStatus,
      data,
    }) {
      calls.push('updateWorkItem')
      if (
        kind === WorkItemKind.JOB_STEP &&
        !jobs.some(
          (job) =>
            job.id === jobId &&
            job.workspaceId === workspaceId &&
            job.archivedAt === null,
        )
      ) {
        return null
      }
      const index = workItems.findIndex(
        (workItem) =>
          workItem.id === workItemId &&
          workItem.workspaceId === workspaceId &&
          workItem.archivedAt === null &&
          (expectedStatus === undefined || workItem.status === expectedStatus),
      )
      if (index < 0) return null
      workItems[index] = { ...workItems[index], ...data, updatedAt: NOW }
      return workItems[index]
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
      calls.push('executeAssignedWorkItem')
      if (
        kind === WorkItemKind.JOB_STEP &&
        !jobs.some(
          (job) =>
            job.id === jobId &&
            job.workspaceId === workspaceId &&
            job.archivedAt === null,
        )
      ) {
        return null
      }
      const index = workItems.findIndex(
        (workItem) =>
          workItem.id === workItemId &&
          workItem.workspaceId === workspaceId &&
          workItem.assigneeMemberId === assigneeMemberId &&
          workItem.status === expectedStatus &&
          workItem.archivedAt === null,
      )
      if (index < 0) return null
      workItems[index] = { ...workItems[index], ...data, updatedAt: NOW }
      return workItems[index]
    },
  }

  return { store, jobs, workItems, customers, calls }
}

describe('durable Jobs and Work Items service', () => {
  let memory: ReturnType<typeof createMemoryStore>
  let service: ReturnType<typeof createOperationsService>

  beforeEach(() => {
    memory = createMemoryStore()
    service = createOperationsService(memory.store, { now: () => NOW })
  })

  const actorA = { workspaceId: 'ws-a', userProfileId: 'user-a' }
  const actorB = { workspaceId: 'ws-b', userProfileId: 'user-b' }
  const memberActorA = {
    ...actorA,
    workspaceMemberId: 'member-a',
  }

  it('creates a workspace-scoped Job with a valid member assignment only', async () => {
    const job = await service.createJob(actorA, {
      title: 'Spring cleanup',
      assigneeMemberId: 'member-a',
      valueCents: 25_000,
      scheduledStartAt: '2026-09-23T13:00:00.000Z',
      scheduledEndAt: '2026-09-23T15:00:00.000Z',
    })

    expect(job).toMatchObject({
      workspaceId: 'ws-a',
      title: 'Spring cleanup',
      status: JobStatus.OPEN,
      priority: OperationsPriority.NORMAL,
      assigneeMemberId: 'member-a',
      createdByUserId: 'user-a',
    })
    expect(memory.calls).toEqual([
      'getWorkspaceBusinessModel',
      'isWorkspaceMember',
      'createJob',
    ])
    expect(memory.calls).not.toContain('createAutomation')
    expect(memory.calls).not.toContain('createRevenueTransaction')
  })

  it('rejects a cross-workspace assignee', async () => {
    await expect(
      service.createJob(actorA, {
        title: 'Wrong assignee',
        assigneeMemberId: 'member-b',
      }),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    })
  })

  it('creates a Job with an active Customer and derives the snapshot server-side', async () => {
    const job = await service.createJob(actorA, {
      title: 'Customer lawn service',
      customerId: 'customer-a',
      customerDisplayName: 'Forged Customer Name',
    })

    expect(job).toMatchObject({
      customerId: 'customer-a',
      customerDisplayName: 'ABC Landscaping',
    })
  })

  it('allows an unlinked Job and rejects foreign or archived Customers', async () => {
    const unlinked = await service.createJob(actorA, {
      title: 'Unlinked Job',
      customerDisplayName: 'Forged durable snapshot',
    })
    expect(unlinked.customerId).toBeNull()
    expect(unlinked.customerDisplayName).toBeNull()

    for (const customerId of ['customer-foreign', 'customer-archived']) {
      await expect(
        service.createJob(actorA, { title: 'Invalid link', customerId }),
      ).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
      })
    }
  })

  it('rejects Customers outside the durable Simple Service workspace model', async () => {
    await expect(
      service.createJob(
        { workspaceId: 'ws-legacy', userProfileId: 'user-a' },
        { title: 'Unsupported link', customerId: 'customer-legacy-model' },
      ),
    ).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    })
  })

  it('captures a new snapshot on reassignment and preserves it when unlinked', async () => {
    const job = await service.createJob(actorA, {
      title: 'Reassigned Job',
      customerId: 'customer-a',
    })
    const reassigned = await service.updateJob(actorA, job.id, {
      customerId: 'customer-b',
      customerDisplayName: 'Forged reassignment',
    })
    expect(reassigned).toMatchObject({
      customerId: 'customer-b',
      customerDisplayName: 'Jones Residence',
    })

    const unlinked = await service.updateJob(actorA, job.id, {
      customerId: null,
      customerDisplayName: null,
    })
    expect(unlinked).toMatchObject({
      customerId: null,
      customerDisplayName: 'Jones Residence',
    })

    const rewriteAttempt = await service.updateJob(actorA, job.id, {
      customerDisplayName: 'Forged after unlink',
    })
    expect(rewriteAttempt.customerDisplayName).toBe('Jones Residence')
  })

  it('preserves free-text customer context for legacy workspace models', async () => {
    const legacyActor = {
      workspaceId: 'ws-legacy',
      userProfileId: 'user-a',
    }
    const job = await service.createJob(legacyActor, {
      title: 'Legacy Job',
      customerDisplayName: 'Legacy customer name',
    })
    expect(job.customerDisplayName).toBe('Legacy customer name')

    const updated = await service.updateJob(legacyActor, job.id, {
      customerDisplayName: 'Updated legacy customer name',
    })
    expect(updated.customerDisplayName).toBe('Updated legacy customer name')
  })

  it('keeps the historical Job snapshot when the Customer is renamed or archived', async () => {
    const job = await service.createJob(actorA, {
      title: 'Historical Job',
      customerId: 'customer-a',
    })
    const customer = memory.customers.find(
      (candidate) => candidate.id === 'customer-a',
    )!
    customer.displayName = 'ABC Property Services'
    customer.archivedAt = NOW

    expect(await service.getJob('ws-a', job.id)).toMatchObject({
      customerId: 'customer-a',
      customerDisplayName: 'ABC Landscaping',
      archivedAt: null,
    })
  })

  it('does not refresh a historical snapshot when the same Customer id is resubmitted', async () => {
    const job = await service.createJob(actorA, {
      title: 'Stable snapshot Job',
      customerId: 'customer-a',
    })
    const customer = memory.customers.find(
      (candidate) => candidate.id === 'customer-a',
    )!
    customer.displayName = 'Renamed after Job creation'

    const updated = await service.updateJob(actorA, job.id, {
      customerId: 'customer-a',
      customerDisplayName: 'Forged snapshot',
      notes: 'Keep the original context.',
    })

    expect(updated).toMatchObject({
      customerId: 'customer-a',
      customerDisplayName: 'ABC Landscaping',
      notes: 'Keep the original context.',
    })
  })

  it('filters Jobs by durable Customer inside the requested workspace', async () => {
    const linked = await service.createJob(actorA, {
      title: 'Linked Job',
      customerId: 'customer-a',
    })
    await service.createJob(actorA, { title: 'Unlinked Job' })

    expect(
      await service.listJobs('ws-a', { customerId: 'customer-a' }),
    ).toEqual([linked])
    expect(
      await service.listJobs('ws-b', { customerId: 'customer-a' }),
    ).toEqual([])
  })

  it('rechecks Customer activity at persistence time', async () => {
    const baseCreate = memory.store.createJob
    const racingStore: JobsStore = {
      ...memory.store,
      async createJob(data) {
        const customer = memory.customers.find(
          (candidate) => candidate.id === data.customerId,
        )
        if (customer) customer.archivedAt = NOW
        return baseCreate(data)
      },
    }
    const racingService = createOperationsService(racingStore, {
      now: () => NOW,
    })

    await expect(
      racingService.createJob(actorA, {
        title: 'Archive race',
        customerId: 'customer-a',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    expect(memory.jobs).toHaveLength(0)
  })

  it('scopes Job reads, lists, and mutations by workspace', async () => {
    const job = await service.createJob(actorA, { title: 'Scoped Job' })

    expect(await service.getJob('ws-b', job.id)).toBeNull()
    expect(await service.listJobs('ws-b')).toEqual([])
    await expect(
      service.updateJob(actorB, job.id, { title: 'Cross-workspace edit' }),
    ).rejects.toBeInstanceOf(OperationsServiceError)
    expect(job.title).toBe('Scoped Job')
  })

  it('sets completion time and clears it on the defined Job reopen path', async () => {
    const job = await service.createJob(actorA, { title: 'Lifecycle Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Independent step',
    })
    const completed = await service.updateJob(actorA, job.id, {
      status: JobStatus.COMPLETED,
    })
    expect(completed.completedAt).toEqual(NOW)
    expect((await service.getWorkItem('ws-a', step.id))?.status).toBe(
      WorkItemStatus.OPEN,
    )

    const unchanged = await service.updateJob(actorA, job.id, {
      status: JobStatus.COMPLETED,
    })
    expect(unchanged.completedAt).toEqual(NOW)

    const reopened = await service.updateJob(actorA, job.id, {
      status: JobStatus.IN_PROGRESS,
    })
    expect(reopened.completedAt).toBeNull()
  })

  it('starts best-effort processing only after a completion event commits', async () => {
    const job = await service.createJob(actorA, { title: 'Processed Job' })
    const updateJob = memory.store.updateJob.bind(memory.store)
    memory.store.updateJob = vi.fn(async (input) => {
      const result = await updateJob(input)
      return result
        ? { ...result, completionEventId: 'job-completed-event-a' }
        : null
    })
    const processCommittedEvent = vi.fn(async () => undefined)
    service = createOperationsService(memory.store, {
      now: () => NOW,
      processCommittedEvent,
    })

    await service.updateJob(actorA, job.id, { status: JobStatus.COMPLETED })

    await vi.waitFor(() =>
      expect(processCommittedEvent).toHaveBeenCalledWith(
        'job-completed-event-a',
      ),
    )
  })

  it('rejects invalid lifecycle transitions and schedule windows', async () => {
    const job = await service.createJob(actorA, {
      title: 'Transition Job',
      status: JobStatus.CANCELED,
    })
    await expect(
      service.updateJob(actorA, job.id, { status: JobStatus.COMPLETED }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      service.createJob(actorA, {
        title: 'Bad schedule',
        scheduledStartAt: '2026-09-23T15:00:00.000Z',
        scheduledEndAt: '2026-09-23T13:00:00.000Z',
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      service.createJob(actorA, {
        title: 'Out-of-range value',
        valueCents: 2_147_483_648,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('rejects stale management status transitions instead of applying an outdated decision', async () => {
    const job = await service.createJob(actorA, { title: 'Racing Job' })
    const todo = await service.createTodo(actorA, { title: 'Racing To-Do' })
    const updateJob = memory.store.updateJob
    const updateWorkItem = memory.store.updateWorkItem
    const racingStore: JobsStore = {
      ...memory.store,
      async updateJob(input) {
        const persisted = memory.jobs.find((item) => item.id === job.id)
        if (persisted) persisted.status = JobStatus.CANCELED
        return updateJob(input)
      },
      async updateWorkItem(input) {
        const persisted = memory.workItems.find((item) => item.id === todo.id)
        if (persisted) persisted.status = WorkItemStatus.IN_PROGRESS
        return updateWorkItem(input)
      },
    }
    const racingService = createOperationsService(racingStore, {
      now: () => NOW,
    })

    await expect(
      racingService.updateJob(actorA, job.id, {
        status: JobStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
    await expect(
      racingService.updateWorkItem(actorA, todo.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
    expect(memory.jobs.find((item) => item.id === job.id)).toMatchObject({
      status: JobStatus.CANCELED,
      completedAt: null,
    })
    expect(memory.workItems.find((item) => item.id === todo.id)).toMatchObject({
      status: WorkItemStatus.IN_PROGRESS,
      completedAt: null,
    })
  })

  it('enforces explicit JOB_STEP and TODO parent invariants', async () => {
    await expect(
      service.createWorkItem(actorA, {
        kind: WorkItemKind.JOB_STEP,
        title: 'Missing parent',
      }),
    ).rejects.toMatchObject({ status: 400 })
    await expect(
      service.createWorkItem(actorA, {
        kind: WorkItemKind.TODO,
        jobId: 'job-1',
        title: 'Invalid parent',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('creates a Job Step only beneath a Job in the same workspace', async () => {
    const job = await service.createJob(actorA, { title: 'Parent Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Load equipment',
    })
    expect(step).toMatchObject({
      workspaceId: 'ws-a',
      kind: WorkItemKind.JOB_STEP,
      jobId: job.id,
    })

    await expect(
      service.createJobStep(actorB, job.id, { title: 'Cross-workspace step' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('creates a standalone To-Do without a Job parent', async () => {
    const todo = await service.createTodo(actorA, {
      title: 'Order mulch',
      assigneeMemberId: 'member-a',
    })
    expect(todo).toMatchObject({
      kind: WorkItemKind.TODO,
      jobId: null,
      status: WorkItemStatus.OPEN,
    })
  })

  it('scopes Work Item reads and mutations and rejects foreign assignees', async () => {
    const todo = await service.createTodo(actorA, { title: 'Scoped To-Do' })

    expect(await service.getWorkItem('ws-b', todo.id)).toBeNull()
    await expect(
      service.updateWorkItem(actorB, todo.id, { title: 'Foreign edit' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
    await expect(
      service.updateWorkItem(actorA, todo.id, {
        assigneeMemberId: 'member-b',
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
  })

  it('sets and clears Work Item completion time without completing its Job', async () => {
    const job = await service.createJob(actorA, { title: 'Independent Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Only step',
    })
    const completed = await service.updateWorkItem(actorA, step.id, {
      status: WorkItemStatus.COMPLETED,
    })
    expect(completed.completedAt).toEqual(NOW)
    expect((await service.getJob('ws-a', job.id))?.status).toBe(JobStatus.OPEN)

    const repeated = await service.updateWorkItem(actorA, step.id, {
      status: WorkItemStatus.COMPLETED,
    })
    expect(repeated.completedAt).toEqual(NOW)

    const reopened = await service.updateWorkItem(actorA, step.id, {
      status: WorkItemStatus.OPEN,
    })
    expect(reopened.completedAt).toBeNull()
  })

  it('uses the canonical canceled Work Item reopen path', async () => {
    const todo = await service.createTodo(actorA, {
      title: 'Canceled To-Do',
      status: WorkItemStatus.CANCELED,
    })

    await expect(
      service.updateWorkItem(actorA, todo.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })
    const reopened = await service.updateWorkItem(actorA, todo.id, {
      status: WorkItemStatus.OPEN,
    })
    expect(reopened).toMatchObject({
      status: WorkItemStatus.OPEN,
      completedAt: null,
    })
  })

  it('lets a member execute an assigned To-Do through canonical status transitions', async () => {
    const todo = await service.createTodo(actorA, {
      title: 'Assigned To-Do',
      assigneeMemberId: 'member-a',
    })

    const started = await service.executeAssignedWorkItem(
      memberActorA,
      todo.id,
      { status: WorkItemStatus.IN_PROGRESS, notes: 'Started on site.' },
    )
    expect(started).toMatchObject({
      status: WorkItemStatus.IN_PROGRESS,
      notes: 'Started on site.',
      completedAt: null,
    })

    const noted = await service.executeAssignedWorkItem(memberActorA, todo.id, {
      notes: 'Waiting for the final walkthrough.',
    })
    expect(noted).toMatchObject({
      status: WorkItemStatus.IN_PROGRESS,
      notes: 'Waiting for the final walkthrough.',
    })

    const completed = await service.executeAssignedWorkItem(
      memberActorA,
      todo.id,
      { status: WorkItemStatus.COMPLETED },
    )
    expect(completed.completedAt).toEqual(NOW)

    const reopened = await service.executeAssignedWorkItem(
      memberActorA,
      todo.id,
      { status: WorkItemStatus.OPEN },
    )
    expect(reopened.completedAt).toBeNull()
    expect(memory.calls).not.toContain('updateWorkItem')
  })

  it('lets a member execute an assigned Job Step without mutating its Job', async () => {
    const job = await service.createJob(actorA, { title: 'Member Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Assigned step',
      assigneeMemberId: 'member-a',
    })

    const updated = await service.executeAssignedWorkItem(
      memberActorA,
      step.id,
      { status: WorkItemStatus.COMPLETED, notes: 'Finished safely.' },
    )

    expect(updated).toMatchObject({
      kind: WorkItemKind.JOB_STEP,
      status: WorkItemStatus.COMPLETED,
      notes: 'Finished safely.',
    })
    expect((await service.getJob('ws-a', job.id))?.status).toBe(JobStatus.OPEN)
    expect(memory.calls).not.toContain('updateJob')
  })

  it('rejects member execution of another member, unassigned, or cross-workspace work', async () => {
    const assignedElsewhere = await service.createTodo(actorA, {
      title: 'Someone else',
      assigneeMemberId: 'member-other',
    })
    const unassigned = await service.createTodo(actorA, {
      title: 'Unassigned',
    })
    const job = await service.createJob(actorA, { title: 'Other crew Job' })
    const assignedStep = await service.createJobStep(actorA, job.id, {
      title: 'Other crew step',
      assigneeMemberId: 'member-other',
    })

    for (const workItemId of [
      assignedElsewhere.id,
      assignedStep.id,
      unassigned.id,
    ]) {
      await expect(
        service.executeAssignedWorkItem(memberActorA, workItemId, {
          status: WorkItemStatus.COMPLETED,
        }),
      ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    }
    await expect(
      service.executeAssignedWorkItem(memberActorA, unassigned.id, {
        assigneeMemberId: 'member-a',
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(await service.getWorkItem('ws-a', unassigned.id)).toMatchObject({
      assigneeMemberId: null,
      status: WorkItemStatus.OPEN,
    })

    const workspaceBItem = await service.createTodo(actorB, {
      title: 'Workspace B',
      assigneeMemberId: 'member-b',
    })
    await expect(
      service.executeAssignedWorkItem(memberActorA, workspaceBItem.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it.each([
    ['title', 'Renamed'],
    ['description', 'Changed'],
    ['priority', OperationsPriority.HIGH],
    ['dueAt', '2026-09-24T16:00:00.000Z'],
    ['assigneeMemberId', 'member-a'],
    ['kind', WorkItemKind.JOB_STEP],
    ['jobId', 'job-1'],
  ])('rejects member execution field %s', async (field, value) => {
    const todo = await service.createTodo(actorA, {
      title: 'Immutable member work',
      assigneeMemberId: 'member-a',
    })

    await expect(
      service.executeAssignedWorkItem(memberActorA, todo.id, {
        status: WorkItemStatus.COMPLETED,
        [field]: value,
      }),
    ).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR' })

    expect((await service.getWorkItem('ws-a', todo.id))?.status).toBe(
      WorkItemStatus.OPEN,
    )
  })

  it('fails closed when assignment changes between the read and atomic member update', async () => {
    const todo = await service.createTodo(actorA, {
      title: 'Reassigned during update',
      assigneeMemberId: 'member-a',
    })
    const executeAssignedWorkItem = memory.store.executeAssignedWorkItem
    const racingStore: JobsStore = {
      ...memory.store,
      async executeAssignedWorkItem(input) {
        const persisted = memory.workItems.find((item) => item.id === todo.id)
        if (persisted) persisted.assigneeMemberId = null
        return executeAssignedWorkItem(input)
      },
    }
    const racingService = createOperationsService(racingStore, {
      now: () => NOW,
    })

    await expect(
      racingService.executeAssignedWorkItem(memberActorA, todo.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect((await service.getWorkItem('ws-a', todo.id))?.status).toBe(
      WorkItemStatus.OPEN,
    )
  })

  it('fails closed when status changes before a Member execution update persists', async () => {
    const todo = await service.createTodo(actorA, {
      title: 'Status changed during update',
      assigneeMemberId: 'member-a',
    })
    const executeAssignedWorkItem = memory.store.executeAssignedWorkItem
    const racingStore: JobsStore = {
      ...memory.store,
      async executeAssignedWorkItem(input) {
        const persisted = memory.workItems.find((item) => item.id === todo.id)
        if (persisted) persisted.status = WorkItemStatus.IN_PROGRESS
        return executeAssignedWorkItem(input)
      },
    }
    const racingService = createOperationsService(racingStore, {
      now: () => NOW,
    })

    await expect(
      racingService.executeAssignedWorkItem(memberActorA, todo.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(memory.workItems.find((item) => item.id === todo.id)).toMatchObject({
      status: WorkItemStatus.IN_PROGRESS,
      completedAt: null,
    })
  })

  it('rejects Member execution of an archived Work Item', async () => {
    const todo = await service.createTodo(actorA, {
      title: 'Archived assignment',
      assigneeMemberId: 'member-a',
    })
    await service.archiveWorkItem(actorA, todo.id)

    await expect(
      service.executeAssignedWorkItem(memberActorA, todo.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('fails closed if a parent Job is archived before member execution persists', async () => {
    const job = await service.createJob(actorA, { title: 'Archiving Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Assigned archived step',
      assigneeMemberId: 'member-a',
    })
    const executeAssignedWorkItem = memory.store.executeAssignedWorkItem
    const racingStore: JobsStore = {
      ...memory.store,
      async executeAssignedWorkItem(input) {
        const persistedJob = memory.jobs.find((row) => row.id === job.id)
        if (persistedJob) persistedJob.archivedAt = NOW
        return executeAssignedWorkItem(input)
      },
    }
    const racingService = createOperationsService(racingStore, {
      now: () => NOW,
    })

    await expect(
      racingService.executeAssignedWorkItem(memberActorA, step.id, {
        status: WorkItemStatus.COMPLETED,
      }),
    ).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    expect(memory.workItems.find((row) => row.id === step.id)).toMatchObject({
      status: WorkItemStatus.OPEN,
      completedAt: null,
    })
  })

  it('fails closed if a parent Job is archived before a management edit persists', async () => {
    const job = await service.createJob(actorA, { title: 'Managed race Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Managed race step',
    })
    const updateWorkItem = memory.store.updateWorkItem
    const racingStore: JobsStore = {
      ...memory.store,
      async updateWorkItem(input) {
        const persistedJob = memory.jobs.find((row) => row.id === job.id)
        if (persistedJob) persistedJob.archivedAt = NOW
        return updateWorkItem(input)
      },
    }
    const racingService = createOperationsService(racingStore, {
      now: () => NOW,
    })

    await expect(
      racingService.updateWorkItem(actorA, step.id, {
        status: WorkItemStatus.IN_PROGRESS,
      }),
    ).rejects.toMatchObject({ status: 409, code: 'CONFLICT' })
    expect(memory.workItems.find((row) => row.id === step.id)).toMatchObject({
      status: WorkItemStatus.OPEN,
      completedAt: null,
    })
  })

  it('allows a Job Step mutation to win before normal Job archival proceeds', async () => {
    const job = await service.createJob(actorA, { title: 'Serial archive Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Serial archive step',
      assigneeMemberId: 'member-a',
    })

    await service.executeAssignedWorkItem(memberActorA, step.id, {
      status: WorkItemStatus.IN_PROGRESS,
      notes: 'Persisted before archive.',
    })
    await service.archiveJob(actorA, job.id)

    expect(memory.workItems.find((row) => row.id === step.id)).toMatchObject({
      status: WorkItemStatus.IN_PROGRESS,
      notes: 'Persisted before archive.',
      archivedAt: NOW,
    })
    expect(memory.jobs.find((row) => row.id === job.id)?.archivedAt).toEqual(
      NOW,
    )
  })

  it('rejects arbitrary mutation fields and immutable semantic identity', async () => {
    const job = await service.createJob(actorA, { title: 'Safe updates' })
    await expect(
      service.updateJob(actorA, job.id, {
        workspaceId: 'ws-b',
        archivedAt: NOW,
      }),
    ).rejects.toMatchObject({ status: 400 })

    const todo = await service.createTodo(actorA, { title: 'Safe To-Do' })
    await expect(
      service.updateWorkItem(actorA, todo.id, {
        kind: WorkItemKind.JOB_STEP,
        jobId: job.id,
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('archives a Job and its steps without erasing operational history', async () => {
    const job = await service.createJob(actorA, { title: 'Archived Job' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Historical step',
    })

    await service.archiveJob(actorA, job.id)

    expect(await service.getJob('ws-a', job.id)).toBeNull()
    expect(memory.jobs.find((row) => row.id === job.id)?.archivedAt).toEqual(
      NOW,
    )
    expect(
      memory.workItems.find((row) => row.id === step.id)?.archivedAt,
    ).toEqual(NOW)
    await expect(
      service.createJobStep(actorA, job.id, { title: 'Late step' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
    await expect(service.archiveJob(actorA, job.id)).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    })
  })

  it('soft-archives standalone To-Dos and individual Job Steps and rejects repeat archival', async () => {
    const job = await service.createJob(actorA, { title: 'Active parent' })
    const step = await service.createJobStep(actorA, job.id, {
      title: 'Archived step',
    })
    const todo = await service.createTodo(actorA, { title: 'Archived To-Do' })

    await service.archiveWorkItem(actorA, step.id)
    await service.archiveWorkItem(actorA, todo.id)

    expect(await service.getWorkItem('ws-a', step.id)).toBeNull()
    expect(await service.getWorkItem('ws-a', todo.id)).toBeNull()
    expect(
      memory.workItems.find((row) => row.id === step.id)?.archivedAt,
    ).toEqual(NOW)
    expect(
      memory.workItems.find((row) => row.id === todo.id)?.archivedAt,
    ).toEqual(NOW)
    await expect(
      service.archiveWorkItem(actorA, todo.id),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })
})
