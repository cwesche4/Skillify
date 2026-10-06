import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  profileFindUnique: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.profileFindUnique },
    workspaceMember: {
      findUnique: mocks.memberFindUnique,
      findMany: mocks.memberFindMany,
    },
  },
}))

import { GET } from '@/app/api/workspaces/[workspaceId]/members/route'

describe('Member directory read minimization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-member' })
    mocks.profileFindUnique.mockResolvedValue({ id: 'profile-member' })
  })

  it('returns only the ordinary Member own display identity', async () => {
    mocks.memberFindUnique
      .mockResolvedValueOnce({
        id: 'member-a',
        role: 'MEMBER',
        userId: 'profile-member',
      })
      .mockResolvedValueOnce({
        id: 'member-a',
        user: { fullName: 'Alex Field' },
      })

    const response = await GET(new Request('http://localhost'), {
      params: { workspaceId: 'workspace-a' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      members: [{ id: 'member-a', fullName: 'Alex Field' }],
    })
    expect(mocks.memberFindMany).not.toHaveBeenCalled()
  })

  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'keeps %s workspace directory visibility',
    async (role) => {
      mocks.memberFindUnique.mockResolvedValueOnce({
        id: 'member-manager',
        role,
        userId: 'profile-member',
      })
      mocks.memberFindMany.mockResolvedValue([
        {
          id: 'member-a',
          role: 'MEMBER',
          userId: 'profile-a',
          createdAt: new Date('2026-10-01T00:00:00.000Z'),
          user: { fullName: 'Alex Field', email: 'alex@example.com' },
        },
      ])

      const response = await GET(new Request('http://localhost'), {
        params: { workspaceId: 'workspace-a' },
      })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({
        members: [
          {
            id: 'member-a',
            role: 'MEMBER',
            userId: 'profile-a',
            fullName: 'Alex Field',
            email: 'alex@example.com',
          },
        ],
      })
    },
  )
})
