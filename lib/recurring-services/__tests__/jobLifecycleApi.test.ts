import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceAccess: vi.fn(),
  reportUnableToComplete: vi.fn(),
  skipVisit: vi.fn(),
  rescheduleUnable: vi.fn(),
  executeAssignedJob: vi.fn(),
}))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeWorkspaceAccess: mocks.authorizeWorkspaceAccess,
}))

vi.mock('@/lib/recurring-services/jobLifecycle', () => ({
  recurringJobLifecycleService: {
    reportUnableToComplete: mocks.reportUnableToComplete,
    skipVisit: mocks.skipVisit,
    rescheduleUnable: mocks.rescheduleUnable,
  },
}))

vi.mock('@/lib/jobs/defaultService', () => ({
  operationsService: {
    executeAssignedJob: mocks.executeAssignedJob,
  },
}))

import { POST as lifecycleRoute } from '@/app/api/workspaces/[workspaceId]/jobs/[jobId]/lifecycle/[action]/route'

const memberAuthorization = {
  allowed: true as const,
  userId: 'clerk-member',
  userProfileId: 'profile-member',
  role: 'MEMBER',
  workspaceId: 'ws-1',
  workspaceMemberId: 'member-1',
}

function request(action: string, body: unknown) {
  return lifecycleRoute(
    new Request(
      `http://localhost/api/workspaces/ws-1/jobs/job-1/lifecycle/${action}`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
    {
      params: {
        workspaceId: 'ws-1',
        jobId: 'job-1',
        action,
      },
    },
  )
}

describe('Recurring Job lifecycle API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorizeWorkspaceAccess.mockResolvedValue(memberAuthorization)
  })

  it('passes server-resolved member identity to the narrow Unable to Complete command', async () => {
    mocks.reportUnableToComplete.mockResolvedValue({
      id: 'job-1',
      status: 'UNABLE_TO_COMPLETE',
    })
    const response = await request('unable-to-complete', {
      reason: 'WEATHER',
    })

    expect(response.status).toBe(200)
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledWith({
      workspaceId: 'ws-1',
      access: 'view',
    })
    expect(mocks.reportUnableToComplete).toHaveBeenCalledWith(
      {
        workspaceId: 'ws-1',
        userProfileId: 'profile-member',
        workspaceMemberId: 'member-1',
        canManage: false,
      },
      'job-1',
      { reason: 'WEATHER' },
    )
  })

  it('keeps management authority explicit for Skip Visit', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      ...memberAuthorization,
      role: 'MANAGER',
      userProfileId: 'profile-manager',
      workspaceMemberId: 'manager-1',
    })
    mocks.skipVisit.mockResolvedValue({ id: 'job-1', status: 'CANCELED' })

    const response = await request('skip', { reason: 'HOLIDAY' })
    expect(response.status).toBe(200)
    expect(mocks.skipVisit).toHaveBeenCalledWith(
      expect.objectContaining({ canManage: true }),
      'job-1',
      { reason: 'HOLIDAY' },
    )
  })

  it.each([
    ['start', 'IN_PROGRESS'],
    ['complete', 'COMPLETED'],
  ])(
    'passes server-resolved identity to the narrow %s execution command',
    async (action, status) => {
      mocks.executeAssignedJob.mockResolvedValue({ id: 'job-1', status })

      const response = await request(action, { notes: 'Field update.' })

      expect(response.status).toBe(200)
      expect(mocks.executeAssignedJob).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws-1',
          workspaceMemberId: 'member-1',
          canManage: false,
        }),
        'job-1',
        { notes: 'Field update.', status },
      )
    },
  )

  it('supports a notes-only field update without accepting client identity', async () => {
    mocks.executeAssignedJob.mockResolvedValue({
      id: 'job-1',
      status: 'IN_PROGRESS',
      notes: 'Gate code confirmed.',
    })

    const response = await request('update', { notes: 'Gate code confirmed.' })

    expect(response.status).toBe(200)
    expect(mocks.executeAssignedJob).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceMemberId: 'member-1' }),
      'job-1',
      { notes: 'Gate code confirmed.' },
    )
  })

  it('fails closed when authorization has no durable WorkspaceMember identity', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      ...memberAuthorization,
      workspaceMemberId: null,
    })
    const response = await request('unable-to-complete', {
      reason: 'WEATHER',
    })
    expect(response.status).toBe(403)
    expect(mocks.reportUnableToComplete).not.toHaveBeenCalled()
  })
})
