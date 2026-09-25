import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  authorize: vi.fn(),
  listHistory: vi.fn(),
}))

vi.mock('@/lib/automations/authorization', () => ({
  authorizeWorkspaceAccess: mocks.authorize,
}))
vi.mock('@/lib/automations/simpleAutomationHistory', () => ({
  listSimpleAutomationExecutionHistory: mocks.listHistory,
}))

import { GET } from '@/app/api/workspaces/[workspaceId]/simple-automations/runs/route'

describe('Simple Automation history route', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires manager-level workspace access before reading runs', async () => {
    mocks.authorize.mockResolvedValue({
      allowed: false,
      status: 403,
      message: 'Manager access required.',
    })

    const response = await GET(new Request('https://skillify.test'), {
      params: { workspaceId: 'workspace-b' },
    })

    expect(response.status).toBe(403)
    expect(mocks.authorize).toHaveBeenCalledWith({
      workspaceId: 'workspace-b',
      access: 'manage',
    })
    expect(mocks.listHistory).not.toHaveBeenCalled()
  })

  it('returns only the authorized workspace history', async () => {
    mocks.authorize.mockResolvedValue({
      allowed: true,
      userProfileId: 'user-a',
      role: 'MANAGER',
    })
    mocks.listHistory.mockResolvedValue([{ id: 'run-a' }])

    const response = await GET(new Request('https://skillify.test'), {
      params: { workspaceId: 'workspace-a' },
    })

    expect(response.status).toBe(200)
    expect(mocks.listHistory).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
    })
  })
})
