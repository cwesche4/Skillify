import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceAccess: vi.fn(),
  listRecurringServices: vi.fn(),
  getRecurringService: vi.fn(),
  createRecurringService: vi.fn(),
  updateRecurringService: vi.fn(),
  changeLifecycle: vi.fn(),
}))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeWorkspaceAccess: mocks.authorizeWorkspaceAccess,
}))

vi.mock('@/lib/recurring-services/defaultService', () => ({
  recurringServiceService: {
    listRecurringServices: mocks.listRecurringServices,
    getRecurringService: mocks.getRecurringService,
    createRecurringService: mocks.createRecurringService,
    updateRecurringService: mocks.updateRecurringService,
    changeLifecycle: mocks.changeLifecycle,
  },
}))

import {
  GET as listRecurringServicesRoute,
  POST as createRecurringServiceRoute,
} from '@/app/api/workspaces/[workspaceId]/recurring-services/route'
import {
  GET as getRecurringServiceRoute,
  PATCH as updateRecurringServiceRoute,
} from '@/app/api/workspaces/[workspaceId]/recurring-services/[recurringServiceId]/route'
import { POST as lifecycleRoute } from '@/app/api/workspaces/[workspaceId]/recurring-services/[recurringServiceId]/[action]/route'

const managerAuthorization = {
  allowed: true as const,
  userId: 'clerk-manager',
  userProfileId: 'profile-manager',
  role: 'MANAGER',
  workspaceId: 'ws-a',
  workspaceMemberId: 'member-manager',
}

describe('Recurring Service API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorizeWorkspaceAccess.mockResolvedValue(managerAuthorization)
  })

  it('uses view authorization for reads and management authorization for mutations', async () => {
    mocks.listRecurringServices.mockResolvedValue([])
    mocks.getRecurringService.mockResolvedValue({ id: 'service-1' })
    mocks.createRecurringService.mockResolvedValue({ id: 'service-1' })
    mocks.updateRecurringService.mockResolvedValue({ id: 'service-1' })
    mocks.changeLifecycle.mockResolvedValue({
      id: 'service-1',
      status: 'PAUSED',
    })

    const collectionContext = { params: { workspaceId: 'ws-a' } }
    const recordContext = {
      params: { workspaceId: 'ws-a', recurringServiceId: 'service-1' },
    }
    const lifecycleContext = {
      params: {
        workspaceId: 'ws-a',
        recurringServiceId: 'service-1',
        action: 'pause',
      },
    }
    const responses = await Promise.all([
      listRecurringServicesRoute(
        new Request('http://localhost/api/workspaces/ws-a/recurring-services'),
        collectionContext,
      ),
      getRecurringServiceRoute(
        new Request(
          'http://localhost/api/workspaces/ws-a/recurring-services/service-1',
        ),
        recordContext,
      ),
      createRecurringServiceRoute(
        new Request('http://localhost/api/workspaces/ws-a/recurring-services', {
          method: 'POST',
          body: JSON.stringify({ name: 'Weekly service' }),
        }),
        collectionContext,
      ),
      updateRecurringServiceRoute(
        new Request(
          'http://localhost/api/workspaces/ws-a/recurring-services/service-1',
          {
            method: 'PATCH',
            body: JSON.stringify({ name: 'Renamed service' }),
          },
        ),
        recordContext,
      ),
      lifecycleRoute(
        new Request(
          'http://localhost/api/workspaces/ws-a/recurring-services/service-1/pause',
          { method: 'POST', body: '{}' },
        ),
        lifecycleContext,
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 201, 200, 200,
    ])
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledTimes(5)
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      access: 'view',
    })
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      access: 'manage',
    })
    expect(mocks.changeLifecycle).toHaveBeenCalledWith({
      actor: {
        workspaceId: 'ws-a',
        userProfileId: 'profile-manager',
        workspaceMemberId: 'member-manager',
      },
      recurringServiceId: 'service-1',
      action: 'pause',
    })
  })

  it('denies Members before any Recurring Service operation runs', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })

    const response = await createRecurringServiceRoute(
      new Request('http://localhost/api/workspaces/ws-a/recurring-services', {
        method: 'POST',
        body: '{}',
      }),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(response.status).toBe(403)
    expect(mocks.createRecurringService).not.toHaveBeenCalled()
  })

  it('scopes foreign record reads to the workspace and returns 404', async () => {
    mocks.getRecurringService.mockResolvedValue(null)
    const response = await getRecurringServiceRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/recurring-services/service-from-b',
      ),
      {
        params: {
          workspaceId: 'ws-a',
          recurringServiceId: 'service-from-b',
        },
      },
    )

    expect(response.status).toBe(404)
    expect(mocks.getRecurringService).toHaveBeenCalledWith(
      'ws-a',
      'service-from-b',
    )
  })
})
