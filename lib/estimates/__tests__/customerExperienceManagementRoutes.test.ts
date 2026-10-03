import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  listDeliveries: vi.fn(),
  queueDelivery: vi.fn(),
  resolveSender: vi.fn(),
  logAudit: vi.fn(),
}))

vi.mock('@/lib/estimates/api', () => ({
  authorizeEstimateRequest: mocks.authorize,
  estimateAuthorizationError: (result: { status: number; message: string }) =>
    Response.json(
      { ok: false, message: result.message },
      { status: result.status },
    ),
  estimateApiError: () =>
    Response.json({ ok: false, message: 'Request failed.' }, { status: 500 }),
  readEstimateJson: (request: Request) => request.json(),
}))
vi.mock('@/lib/estimates/customerExperience', () => ({
  listEstimateDeliveries: mocks.listDeliveries,
  queueEstimateDelivery: mocks.queueDelivery,
}))
vi.mock('@/lib/estimates/estimateEmail', () => ({
  resolveVerifiedEstimateSender: mocks.resolveSender,
}))
vi.mock('@/lib/audit/log', () => ({ logAudit: mocks.logAudit }))

import {
  GET as getDeliveries,
  POST as postDelivery,
} from '@/app/api/workspaces/[workspaceId]/estimates/[estimateId]/deliveries/route'

const context = {
  params: { workspaceId: 'workspace-a', estimateId: 'estimate-a' },
}

describe('Estimate customer experience management routes', () => {
  beforeEach(() => vi.clearAllMocks())

  it('denies read and send before touching workspace data when management authorization fails', async () => {
    mocks.authorize.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
    const read = await getDeliveries(
      new Request(
        'https://app.example.test/api/workspaces/workspace-a/estimates/estimate-a/deliveries',
      ),
      context,
    )
    const send = await postDelivery(
      new Request(
        'https://app.example.test/api/workspaces/workspace-a/estimates/estimate-a/deliveries',
        { method: 'POST', body: '{}' },
      ),
      context,
    )
    expect(read.status).toBe(403)
    expect(send.status).toBe(403)
    expect(mocks.authorize).toHaveBeenCalledWith('workspace-a')
    expect(mocks.listDeliveries).not.toHaveBeenCalled()
    expect(mocks.resolveSender).not.toHaveBeenCalled()
    expect(mocks.queueDelivery).not.toHaveBeenCalled()
  })

  it('checks the workspace-owned sender before durably queuing an email', async () => {
    mocks.authorize.mockResolvedValue({
      allowed: true,
      userProfileId: 'profile-manager',
    })
    mocks.resolveSender.mockResolvedValue({ connectionId: 'connection-a' })
    mocks.queueDelivery.mockResolvedValue({
      replayed: false,
      delivery: { id: 'delivery-a', status: 'PENDING' },
    })
    const response = await postDelivery(
      new Request(
        'https://app.example.test/api/workspaces/workspace-a/estimates/estimate-a/deliveries',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            expectedVersion: 3,
            recipientEmail: 'customer@example.test',
            idempotencyKey: 'request-a',
          }),
        },
      ),
      context,
    )
    expect(response.status).toBe(201)
    expect(mocks.resolveSender).toHaveBeenCalledWith('workspace-a')
    expect(mocks.resolveSender.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.queueDelivery.mock.invocationCallOrder[0],
    )
    expect(mocks.queueDelivery).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
      estimateId: 'estimate-a',
      actorUserId: 'profile-manager',
      rawInput: expect.objectContaining({
        recipientEmail: 'customer@example.test',
      }),
    })
  })
})
