import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findMembership: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    workspaceMember: { findFirst: mocks.findMembership },
  },
}))

import {
  getSchedulingActor,
  isResponse,
} from '@/app/api/workspaces/[workspaceId]/scheduling/_lib/auth'

describe('Scheduling API management authorization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-user' })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'allows %s to manage Scheduling through the shared policy',
    async (role) => {
      mocks.findMembership.mockResolvedValue({
        id: 'member-a',
        userId: 'profile-a',
        role,
        workspace: { businessModel: 'DIRECT_SALES' },
      })
      const actor = await getSchedulingActor('ws-a')
      expect(isResponse(actor)).toBe(false)
      expect(actor).toMatchObject({ canManageScheduling: true })
    },
  )

  it.each(['MEMBER', 'UNKNOWN'])(
    'keeps %s unable to manage Scheduling',
    async (role) => {
      mocks.findMembership.mockResolvedValue({
        id: 'member-a',
        userId: 'profile-a',
        role,
        workspace: { businessModel: 'DIRECT_SALES' },
      })
      const actor = await getSchedulingActor('ws-a')
      expect(isResponse(actor)).toBe(false)
      expect(actor).toMatchObject({ canManageScheduling: false })
    },
  )

  it('fails closed for unauthenticated and nonmember requests', async () => {
    mocks.auth.mockReturnValueOnce({ userId: null })
    expect(isResponse(await getSchedulingActor('ws-a'))).toBe(true)
    mocks.auth.mockReturnValueOnce({ userId: 'clerk-user' })
    mocks.findMembership.mockResolvedValueOnce(null)
    expect(isResponse(await getSchedulingActor('ws-a'))).toBe(true)
  })

  it('denies a Simple Service Member at the shared Scheduling API boundary', async () => {
    mocks.findMembership.mockResolvedValue({
      id: 'member-a',
      userId: 'profile-a',
      role: 'MEMBER',
      workspace: { businessModel: 'SIMPLE_SERVICE_BUSINESS' },
    })

    const result = await getSchedulingActor('ws-a')

    expect(isResponse(result)).toBe(true)
    if (!isResponse(result)) throw new Error('Expected access to be denied')
    expect(result.status).toBe(403)
    await expect(result.json()).resolves.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'preserves Simple Service Scheduling access for %s',
    async (role) => {
      mocks.findMembership.mockResolvedValue({
        id: 'member-a',
        userId: 'profile-a',
        role,
        workspace: { businessModel: 'SIMPLE_SERVICE_BUSINESS' },
      })

      const actor = await getSchedulingActor('ws-a')

      expect(isResponse(actor)).toBe(false)
      expect(actor).toMatchObject({ canManageScheduling: true })
    },
  )
})
