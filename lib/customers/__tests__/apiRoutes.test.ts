import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorizeWorkspaceAccess: vi.fn(),
  listCustomers: vi.fn(),
  getCustomer: vi.fn(),
  createCustomer: vi.fn(),
  updateCustomer: vi.fn(),
  archiveCustomer: vi.fn(),
}))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeWorkspaceAccess: mocks.authorizeWorkspaceAccess,
}))

vi.mock('@/lib/customers/defaultService', () => ({
  customerService: {
    listCustomers: mocks.listCustomers,
    getCustomer: mocks.getCustomer,
    createCustomer: mocks.createCustomer,
    updateCustomer: mocks.updateCustomer,
    archiveCustomer: mocks.archiveCustomer,
  },
}))

import {
  GET as listCustomersRoute,
  POST as createCustomerRoute,
} from '@/app/api/workspaces/[workspaceId]/customers/route'
import {
  DELETE as archiveCustomerRoute,
  GET as getCustomerRoute,
  PATCH as updateCustomerRoute,
} from '@/app/api/workspaces/[workspaceId]/customers/[customerId]/route'

const managerAuthorization = {
  allowed: true as const,
  userId: 'clerk-manager',
  userProfileId: 'profile-manager',
  role: 'MANAGER',
  workspaceId: 'ws-a',
  workspaceMemberId: 'member-manager',
}

describe('Customer API routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authorizeWorkspaceAccess.mockResolvedValue(managerAuthorization)
  })

  it('uses management authorization for reads and mutations', async () => {
    mocks.listCustomers.mockResolvedValue([])
    mocks.getCustomer.mockResolvedValue({ id: 'customer-1' })
    mocks.createCustomer.mockResolvedValue({ id: 'customer-1' })
    mocks.updateCustomer.mockResolvedValue({ id: 'customer-1' })
    mocks.archiveCustomer.mockResolvedValue({ id: 'customer-1' })

    const context = { params: { workspaceId: 'ws-a' } }
    const recordContext = {
      params: { workspaceId: 'ws-a', customerId: 'customer-1' },
    }
    const responses = await Promise.all([
      listCustomersRoute(
        new Request('http://localhost/api/workspaces/ws-a/customers'),
        context,
      ),
      getCustomerRoute(
        new Request(
          'http://localhost/api/workspaces/ws-a/customers/customer-1',
        ),
        recordContext,
      ),
      createCustomerRoute(
        new Request('http://localhost/api/workspaces/ws-a/customers', {
          method: 'POST',
          body: JSON.stringify({ displayName: 'A Customer' }),
        }),
        context,
      ),
      updateCustomerRoute(
        new Request(
          'http://localhost/api/workspaces/ws-a/customers/customer-1',
          {
            method: 'PATCH',
            body: JSON.stringify({ displayName: 'Renamed' }),
          },
        ),
        recordContext,
      ),
      archiveCustomerRoute(
        new Request(
          'http://localhost/api/workspaces/ws-a/customers/customer-1',
          { method: 'DELETE' },
        ),
        recordContext,
      ),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 201, 200, 200,
    ])
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledTimes(5)
    expect(mocks.authorizeWorkspaceAccess).toHaveBeenCalledWith({
      workspaceId: 'ws-a',
      access: 'manage',
    })
    expect(mocks.createCustomer).toHaveBeenCalledWith(
      { workspaceId: 'ws-a', userProfileId: 'profile-manager' },
      { displayName: 'A Customer' },
    )
  })

  it('denies a Member general list and record access before service calls', async () => {
    mocks.authorizeWorkspaceAccess.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })

    const listResponse = await listCustomersRoute(
      new Request('http://localhost/api/workspaces/ws-a/customers'),
      { params: { workspaceId: 'ws-a' } },
    )
    const recordResponse = await getCustomerRoute(
      new Request('http://localhost/api/workspaces/ws-a/customers/customer-1'),
      { params: { workspaceId: 'ws-a', customerId: 'customer-1' } },
    )

    expect(listResponse.status).toBe(403)
    expect(recordResponse.status).toBe(403)
    expect(mocks.listCustomers).not.toHaveBeenCalled()
    expect(mocks.getCustomer).not.toHaveBeenCalled()
  })

  it('passes workspace-scoped identifiers and fails foreign records closed', async () => {
    mocks.getCustomer.mockResolvedValue(null)
    const response = await getCustomerRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/customers/customer-from-b',
      ),
      { params: { workspaceId: 'ws-a', customerId: 'customer-from-b' } },
    )

    expect(response.status).toBe(404)
    expect(mocks.getCustomer).toHaveBeenCalledWith('ws-a', 'customer-from-b')
  })

  it('passes basic search and rejects malformed JSON safely', async () => {
    mocks.listCustomers.mockResolvedValue([])
    const searchResponse = await listCustomersRoute(
      new Request(
        'http://localhost/api/workspaces/ws-a/customers?search=Rivera',
      ),
      { params: { workspaceId: 'ws-a' } },
    )
    const createResponse = await createCustomerRoute(
      new Request('http://localhost/api/workspaces/ws-a/customers', {
        method: 'POST',
        body: '{',
      }),
      { params: { workspaceId: 'ws-a' } },
    )

    expect(searchResponse.status).toBe(200)
    expect(mocks.listCustomers).toHaveBeenCalledWith('ws-a', {
      search: 'Rivera',
    })
    expect(createResponse.status).toBe(400)
    expect(await createResponse.json()).toMatchObject({
      ok: false,
      code: 'VALIDATION_ERROR',
    })
    expect(mocks.createCustomer).not.toHaveBeenCalled()
  })
})
