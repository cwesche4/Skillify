import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceAccess: vi.fn(),
  createJob: vi.fn(),
  getJob: vi.fn(),
  listJobs: vi.fn(),
  updateJob: vi.fn(),
  archiveJob: vi.fn(),
  createJobStep: vi.fn(),
  createTodo: vi.fn(),
  getWorkItem: vi.fn(),
  listWorkItems: vi.fn(),
  updateWorkItem: vi.fn(),
  executeAssignedWorkItem: vi.fn(),
  archiveWorkItem: vi.fn(),
  listWorkspaceMemberExecutableJobIds: vi.fn(),
  canWorkspaceMemberExecuteJob: vi.fn(),
  sourceFindMany: vi.fn(),
}))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeWorkspaceAccess: mocks.authorizeWorkspaceAccess,
}))

vi.mock('@/lib/jobs/defaultService', () => ({
  operationsService: {
    createJob: mocks.createJob,
    getJob: mocks.getJob,
    listJobs: mocks.listJobs,
    updateJob: mocks.updateJob,
    archiveJob: mocks.archiveJob,
    createJobStep: mocks.createJobStep,
    createTodo: mocks.createTodo,
    getWorkItem: mocks.getWorkItem,
    listWorkItems: mocks.listWorkItems,
    updateWorkItem: mocks.updateWorkItem,
    executeAssignedWorkItem: mocks.executeAssignedWorkItem,
    archiveWorkItem: mocks.archiveWorkItem,
  },
}))

vi.mock('@/lib/jobs/jobExecutionAuthorization', () => ({
  listWorkspaceMemberExecutableJobIds:
    mocks.listWorkspaceMemberExecutableJobIds,
  canWorkspaceMemberExecuteJob: mocks.canWorkspaceMemberExecuteJob,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    estimateOperationalizationItem: { findMany: mocks.sourceFindMany },
  },
}))

import {
  GET as listJobsRoute,
  POST as createJobRoute,
} from '@/app/api/workspaces/[workspaceId]/jobs/route'
import {
  DELETE as deleteJobRoute,
  GET as getJobRoute,
  PATCH as updateJobRoute,
} from '@/app/api/workspaces/[workspaceId]/jobs/[jobId]/route'
import {
  GET as listJobStepsRoute,
  POST as createJobStepRoute,
} from '@/app/api/workspaces/[workspaceId]/jobs/[jobId]/work-items/route'
import { POST as createTodoRoute } from '@/app/api/workspaces/[workspaceId]/work-items/route'
import {
  DELETE as deleteWorkItemRoute,
  GET as getWorkItemRoute,
  PATCH as updateWorkItemRoute,
} from '@/app/api/workspaces/[workspaceId]/work-items/[workItemId]/route'
import { OperationsServiceError } from '@/lib/jobs/service'

const managerAuthorization = {
  allowed: true as const,
  userId: 'clerk-user',
  userProfileId: 'profile-user',
  role: 'MANAGER',
  workspaceId: 'ws-a',
  workspaceMemberId: 'member-manager',
}

const memberAuthorization = {
  allowed: true as const,
  userId: 'clerk-member',
  userProfileId: 'profile-member',
  role: 'MEMBER',
  workspaceId: 'ws-a',
  workspaceMemberId: 'member-a',
}

describe('Jobs and Work Items API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorizeWorkspaceAccess.mockResolvedValue(managerAuthorization)
    mocks.listWorkspaceMemberExecutableJobIds.mockResolvedValue(new Set())
    mocks.canWorkspaceMemberExecuteJob.mockResolvedValue(false)
    mocks.sourceFindMany.mockResolvedValue([])
  })

  it('creates a Job with server-authoritative workspace and actor context', async () => {
    mocks.createJob.mockResolvedValue({ id: 'job-1', workspaceId: 'ws-a' })
    const response = await createJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Mow front lawn' }),
      }),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(response.status).toBe(201)
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      access: 'manage',
    })
    expect(mocks.createJob).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-user' },
      { title: 'Mow front lawn' },
    )
  })

  it('passes a durable Customer filter through the workspace-scoped Jobs list', async () => {
    mocks.listJobs.mockResolvedValue([])
    const response = await listJobsRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/jobs?customerId=customer-a',
      ),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(response.status).toBe(200)
    expect(mocks.listJobs).toHaveBeenCalledWith('ws-a', {
      customerId: 'customer-a',
    })
  })

  it('returns Job-scoped field context only for a server-authorized Member', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue(memberAuthorization)
    mocks.listJobs.mockResolvedValue([
      {
        id: 'job-assigned',
        serviceLocationSnapshot: '10 Main Street',
        customerContactNameSnapshot: 'Alex Rivera',
        customerPhoneSnapshot: '555-0110',
        customerEmailSnapshot: 'alex@example.com',
      },
      {
        id: 'job-unrelated',
        customerId: 'customer-private',
        customerDisplayName: 'Private Customer',
        serviceLocationSnapshot: '99 Private Lane',
        customerContactNameSnapshot: 'Private Customer',
        customerPhoneSnapshot: '555-0199',
        customerEmailSnapshot: 'private@example.com',
        unableToCompleteReason: 'ACCESS_ISSUE',
        unableToCompleteNote: 'Private gate details',
        unableToCompleteAt: new Date('2026-09-28T12:00:00.000Z'),
        unableToCompleteReportedByMemberId: 'member-other',
      },
    ])
    mocks.listWorkspaceMemberExecutableJobIds.mockResolvedValue(
      new Set(['job-assigned']),
    )

    const response = await listJobsRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs'),
      { params: { workspaceId: 'ws-a' } },
    )
    const body = await response.json()

    expect(body.jobs[0]).toMatchObject({
      id: 'job-assigned',
      serviceLocationSnapshot: '10 Main Street',
      customerPhoneSnapshot: '555-0110',
      canCurrentMemberExecute: true,
      sourceEstimate: null,
    })
    expect(body.jobs[1]).toMatchObject({
      id: 'job-unrelated',
      customerId: null,
      customerDisplayName: null,
      serviceLocationSnapshot: null,
      customerContactNameSnapshot: null,
      customerPhoneSnapshot: null,
      customerEmailSnapshot: null,
      unableToCompleteReason: null,
      unableToCompleteNote: null,
      unableToCompleteAt: null,
      unableToCompleteReportedByMemberId: null,
      canCurrentMemberExecute: false,
      sourceEstimate: null,
    })
    expect(mocks.sourceFindMany).not.toHaveBeenCalled()

    mocks.getJob.mockResolvedValue({
      id: 'job-unrelated',
      customerId: 'customer-private',
      customerDisplayName: 'Private Customer',
      serviceLocationSnapshot: '99 Private Lane',
      customerContactNameSnapshot: 'Private Customer',
      customerPhoneSnapshot: '555-0199',
      customerEmailSnapshot: 'private@example.com',
      unableToCompleteReason: 'ACCESS_ISSUE',
      unableToCompleteNote: 'Private gate details',
      unableToCompleteAt: new Date('2026-09-28T12:00:00.000Z'),
      unableToCompleteReportedByMemberId: 'member-other',
    })
    mocks.canWorkspaceMemberExecuteJob.mockResolvedValue(false)
    const unrelatedResponse = await getJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs/job-unrelated'),
      { params: { workspaceId: 'ws-a', jobId: 'job-unrelated' } },
    )
    expect(await unrelatedResponse.json()).toMatchObject({
      job: {
        id: 'job-unrelated',
        customerId: null,
        customerDisplayName: null,
        serviceLocationSnapshot: null,
        customerContactNameSnapshot: null,
        customerPhoneSnapshot: null,
        customerEmailSnapshot: null,
        unableToCompleteReason: null,
        unableToCompleteNote: null,
        unableToCompleteAt: null,
        unableToCompleteReportedByMemberId: null,
        canCurrentMemberExecute: false,
      },
    })

    mocks.getJob.mockResolvedValue({
      id: 'job-assigned',
      customerId: 'customer-a',
      customerDisplayName: 'Rivera Family',
      serviceLocationSnapshot: '10 Main Street',
      customerContactNameSnapshot: 'Alex Rivera',
      customerPhoneSnapshot: '555-0110',
      customerEmailSnapshot: 'alex@example.com',
    })
    mocks.canWorkspaceMemberExecuteJob.mockResolvedValue(true)
    const assignedResponse = await getJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs/job-assigned'),
      { params: { workspaceId: 'ws-a', jobId: 'job-assigned' } },
    )
    expect(await assignedResponse.json()).toMatchObject({
      job: {
        id: 'job-assigned',
        customerId: 'customer-a',
        serviceLocationSnapshot: '10 Main Street',
        customerPhoneSnapshot: '555-0110',
        canCurrentMemberExecute: true,
      },
    })
  })

  it('retains reporter exception context without retaining Customer context after Team access is removed', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue(memberAuthorization)
    const unableJob = {
      id: 'job-unable-reported-by-member',
      customerId: 'customer-private',
      customerDisplayName: 'Private Customer',
      serviceLocationSnapshot: '99 Private Lane',
      customerContactNameSnapshot: 'Private Customer',
      customerPhoneSnapshot: '555-0199',
      customerEmailSnapshot: 'private@example.com',
      unableToCompleteReason: 'ACCESS_ISSUE',
      unableToCompleteNote: 'Gate code no longer works',
      unableToCompleteAt: new Date('2026-09-28T12:00:00.000Z'),
      unableToCompleteReportedByMemberId: 'member-a',
    }
    mocks.listJobs.mockResolvedValue([unableJob])
    mocks.listWorkspaceMemberExecutableJobIds.mockResolvedValue(new Set())

    const listResponse = await listJobsRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs'),
      { params: { workspaceId: 'ws-a' } },
    )
    expect(await listResponse.json()).toMatchObject({
      jobs: [
        {
          id: 'job-unable-reported-by-member',
          customerId: null,
          customerDisplayName: null,
          serviceLocationSnapshot: null,
          customerContactNameSnapshot: null,
          customerPhoneSnapshot: null,
          customerEmailSnapshot: null,
          unableToCompleteReason: 'ACCESS_ISSUE',
          unableToCompleteNote: 'Gate code no longer works',
          unableToCompleteReportedByMemberId: 'member-a',
          canCurrentMemberExecute: false,
        },
      ],
    })

    mocks.getJob.mockResolvedValue(unableJob)
    mocks.canWorkspaceMemberExecuteJob.mockResolvedValue(false)
    const detailResponse = await getJobRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/jobs/job-unable-reported-by-member',
      ),
      {
        params: {
          workspaceId: 'ws-a',
          jobId: 'job-unable-reported-by-member',
        },
      },
    )
    expect(await detailResponse.json()).toMatchObject({
      job: {
        id: 'job-unable-reported-by-member',
        customerId: null,
        customerDisplayName: null,
        serviceLocationSnapshot: null,
        customerContactNameSnapshot: null,
        customerPhoneSnapshot: null,
        customerEmailSnapshot: null,
        unableToCompleteReason: 'ACCESS_ISSUE',
        unableToCompleteNote: 'Gate code no longer works',
        unableToCompleteReportedByMemberId: 'member-a',
        canCurrentMemberExecute: false,
      },
    })
  })

  it('keeps ordinary Members read-only at the API boundary', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
    const response = await createJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs', {
        method: 'POST',
        body: JSON.stringify({ title: 'Blocked Job' }),
      }),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(response.status).toBe(403)
    expect(mocks.createJob).not.toHaveBeenCalled()
  })

  it('returns a validation response for malformed JSON', async () => {
    const response = await createJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs', {
        method: 'POST',
        body: '{',
      }),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    })
    expect(mocks.createJob).not.toHaveBeenCalled()
  })

  it('does not disclose a Job outside the requested workspace scope', async () => {
    mocks.getJob.mockResolvedValue(null)
    const response = await getJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs/job-from-b'),
      { params: { workspaceId: 'ws-a', jobId: 'job-from-b' } },
    )

    expect(response.status).toBe(404)
    expect(mocks.getJob).toHaveBeenCalledWith('ws-a', 'job-from-b')
  })

  it('does not disclose foreign Work Items or nested Job Steps through route mismatches', async () => {
    mocks.getWorkItem.mockResolvedValue(null)
    mocks.getJob.mockResolvedValue(null)

    const workItemResponse = await getWorkItemRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/work-items/item-from-b',
      ),
      { params: { workspaceId: 'ws-a', workItemId: 'item-from-b' } },
    )
    const nestedResponse = await listJobStepsRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/jobs/job-from-b/work-items',
      ),
      { params: { workspaceId: 'ws-a', jobId: 'job-from-b' } },
    )

    expect(workItemResponse.status).toBe(404)
    expect(nestedResponse.status).toBe(404)
    expect(mocks.getWorkItem).toHaveBeenCalledWith('ws-a', 'item-from-b')
    expect(mocks.getJob).toHaveBeenCalledWith('ws-a', 'job-from-b')
    expect(mocks.listWorkItems).not.toHaveBeenCalled()
  })

  it('uses separate routes for Job Steps and standalone To-Dos', async () => {
    mocks.createJobStep.mockResolvedValue({
      id: 'step-1',
      kind: 'JOB_STEP',
      jobId: 'job-1',
    })
    mocks.createTodo.mockResolvedValue({
      id: 'todo-1',
      kind: 'TODO',
      jobId: null,
    })

    const stepResponse = await createJobStepRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/jobs/job-1/work-items',
        {
          method: 'POST',
          body: JSON.stringify({ title: 'Edge sidewalk' }),
        },
      ),
      { params: { workspaceId: 'ws-a', jobId: 'job-1' } },
    )
    const todoResponse = await createTodoRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Restock trimmer line' }),
      }),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(stepResponse.status).toBe(201)
    expect(todoResponse.status).toBe(201)
    expect(mocks.createJobStep).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-user' },
      'job-1',
      { title: 'Edge sidewalk' },
    )
    expect(mocks.createTodo).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-user' },
      { title: 'Restock trimmer line' },
    )
  })

  it('routes a Member Work Item PATCH through the assigned-work command with server identity', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue(memberAuthorization)
    mocks.executeAssignedWorkItem.mockResolvedValue({
      id: 'todo-1',
      status: 'COMPLETED',
    })

    const response = await updateWorkItemRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items/todo-1', {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'COMPLETED',
          notes: 'Finished.',
        }),
      }),
      { params: { workspaceId: 'ws-a', workItemId: 'todo-1' } },
    )

    expect(response.status).toBe(200)
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      access: 'view',
    })
    expect(mocks.executeAssignedWorkItem).toHaveBeenCalledWith(
      {
        workspaceId: 'ws-a',
        userProfileId: 'profile-member',
        workspaceMemberId: 'member-a',
      },
      'todo-1',
      {
        status: 'COMPLETED',
        notes: 'Finished.',
      },
    )
    expect(mocks.updateWorkItem).not.toHaveBeenCalled()
  })

  it('fails closed when a Member authorization lacks a durable WorkspaceMember id', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      ...memberAuthorization,
      workspaceMemberId: null,
    })

    const response = await updateWorkItemRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items/todo-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      }),
      { params: { workspaceId: 'ws-a', workItemId: 'todo-1' } },
    )

    expect(response.status).toBe(403)
    expect(mocks.executeAssignedWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateWorkItem).not.toHaveBeenCalled()
  })

  it('preserves full Work Item updates for management roles', async () => {
    mocks.updateWorkItem.mockResolvedValue({ id: 'todo-1', title: 'Renamed' })

    const response = await updateWorkItemRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items/todo-1', {
        method: 'PATCH',
        body: JSON.stringify({ title: 'Renamed' }),
      }),
      { params: { workspaceId: 'ws-a', workItemId: 'todo-1' } },
    )

    expect(response.status).toBe(200)
    expect(mocks.updateWorkItem).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-user' },
      'todo-1',
      { title: 'Renamed' },
    )
    expect(mocks.executeAssignedWorkItem).not.toHaveBeenCalled()
  })

  it('returns a conflict response for a stale management lifecycle update', async () => {
    mocks.updateWorkItem.mockRejectedValue(
      new OperationsServiceError(
        'Work Item changed before this update was saved. Refresh and try again.',
        409,
        'CONFLICT',
      ),
    )

    const response = await updateWorkItemRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items/todo-1', {
        method: 'PATCH',
        body: JSON.stringify({ status: 'COMPLETED' }),
      }),
      { params: { workspaceId: 'ws-a', workItemId: 'todo-1' } },
    )

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({
      ok: false,
      code: 'CONFLICT',
    })
  })

  it('keeps Member create, archive, and Job mutation routes management-only', async () => {
    mocks.authorizeWorkspaceAccess.mockImplementation(
      async ({ access }: { access: 'view' | 'manage' }) =>
        access === 'view'
          ? memberAuthorization
          : { allowed: false, status: 403, message: 'Forbidden' },
    )

    const createResponse = await createTodoRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items', {
        method: 'POST',
        body: JSON.stringify({ title: 'Blocked To-Do' }),
      }),
      { params: { workspaceId: 'ws-a' } },
    )
    const createStepResponse = await createJobStepRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/jobs/job-1/work-items',
        {
          method: 'POST',
          body: JSON.stringify({ title: 'Blocked Job Step' }),
        },
      ),
      { params: { workspaceId: 'ws-a', jobId: 'job-1' } },
    )
    const deleteResponse = await deleteWorkItemRoute(
      new Request('http://localhost/api/workspaces/ws-a/work-items/todo-1', {
        method: 'DELETE',
      }),
      { params: { workspaceId: 'ws-a', workItemId: 'todo-1' } },
    )
    const jobResponse = await updateJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs/job-1', {
        method: 'PATCH',
        body: JSON.stringify({ customerId: 'customer-a' }),
      }),
      { params: { workspaceId: 'ws-a', jobId: 'job-1' } },
    )
    const deleteJobResponse = await deleteJobRoute(
      new Request('http://localhost/api/workspaces/ws-a/jobs/job-1', {
        method: 'DELETE',
      }),
      { params: { workspaceId: 'ws-a', jobId: 'job-1' } },
    )

    expect(createResponse.status).toBe(403)
    expect(createStepResponse.status).toBe(403)
    expect(deleteResponse.status).toBe(403)
    expect(jobResponse.status).toBe(403)
    expect(deleteJobResponse.status).toBe(403)
    expect(mocks.createTodo).not.toHaveBeenCalled()
    expect(mocks.createJobStep).not.toHaveBeenCalled()
    expect(mocks.archiveWorkItem).not.toHaveBeenCalled()
    expect(mocks.updateJob).not.toHaveBeenCalled()
    expect(mocks.archiveJob).not.toHaveBeenCalled()
  })
})
