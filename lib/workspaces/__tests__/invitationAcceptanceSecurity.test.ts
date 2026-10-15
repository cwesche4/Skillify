import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  profileFindUnique: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteUpdateMany: vi.fn(),
  memberFindUnique: vi.fn(),
  memberCreate: vi.fn(),
  workspaceFindUnique: vi.fn(),
  transaction: vi.fn(),
  logAudit: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: { findUnique: mocks.profileFindUnique },
    workspaceInvite: { findUnique: mocks.inviteFindUnique },
    workspace: { findUnique: mocks.workspaceFindUnique },
    $transaction: mocks.transaction,
  },
}))
vi.mock('@/lib/audit/log', () => ({ logAudit: mocks.logAudit }))

import { POST } from '@/app/api/workspaces/invites/accept/route'

function request(token: unknown = 'invite-token') {
  return new Request('http://localhost/api/workspaces/invites/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  })
}

const pendingInvite = {
  id: 'invite-a',
  workspaceId: 'workspace-a',
  email: 'member@example.com',
  role: 'MEMBER',
  token: 'invite-token',
  acceptedAt: null,
  expiresAt: new Date(Date.now() + 60_000),
}

describe('workspace invitation acceptance security', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-invitee' })
    mocks.profileFindUnique.mockResolvedValue({ id: 'profile-invitee' })
    mocks.inviteFindUnique.mockResolvedValue(pendingInvite)
    mocks.inviteUpdateMany.mockResolvedValue({ count: 1 })
    mocks.memberFindUnique.mockResolvedValue(null)
    mocks.memberCreate.mockResolvedValue({ id: 'member-a' })
    mocks.workspaceFindUnique.mockResolvedValue({
      id: 'workspace-a',
      slug: 'workspace-a',
      name: 'Workspace A',
    })
    mocks.logAudit.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        workspaceInvite: {
          findUnique: mocks.inviteFindUnique,
          updateMany: mocks.inviteUpdateMany,
        },
        workspaceMember: {
          findUnique: mocks.memberFindUnique,
          create: mocks.memberCreate,
        },
      }),
    )
  })

  it('requires authentication before reading an invitation', async () => {
    mocks.auth.mockReturnValue({ userId: null })
    const response = await POST(request())
    expect(response.status).toBe(401)
    expect(mocks.inviteFindUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('rejects malformed tokens before invitation lookup', async () => {
    const response = await POST(request(42))
    expect(response.status).toBe(400)
    expect(mocks.inviteFindUnique).not.toHaveBeenCalled()
    expect(mocks.transaction).not.toHaveBeenCalled()
  })

  it('allows only one pending, unexpired transactional claim', async () => {
    mocks.inviteUpdateMany.mockResolvedValue({ count: 0 })
    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mocks.inviteUpdateMany).toHaveBeenCalledWith({
      where: {
        id: 'invite-a',
        workspaceId: 'workspace-a',
        token: 'invite-token',
        role: 'MEMBER',
        acceptedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { acceptedAt: expect.any(Date) },
    })
    expect(mocks.memberCreate).not.toHaveBeenCalled()
    expect(mocks.logAudit).not.toHaveBeenCalled()
  })

  it('creates workspace membership only after winning the invite claim', async () => {
    const response = await POST(request('  invite-token  '))

    expect(response.status).toBe(200)
    expect(mocks.inviteFindUnique).toHaveBeenCalledWith({
      where: { token: 'invite-token' },
    })
    expect(mocks.memberCreate).toHaveBeenCalledWith({
      data: {
        userId: 'profile-invitee',
        workspaceId: 'workspace-a',
        role: 'MEMBER',
      },
    })
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        actorId: 'profile-invitee',
        action: 'INVITE_ACCEPTED',
      }),
    )
  })

  it.each(['MEMBER', 'ADMIN', 'OWNER'])(
    'preserves an existing %s membership and leaves the invite pending',
    async (role) => {
      mocks.memberFindUnique.mockResolvedValue({ id: 'existing', role })
      const response = await POST(request())

      expect(response.status).toBe(409)
      expect(await response.json()).toEqual({
        error: 'Already a workspace member',
      })
      expect(mocks.inviteUpdateMany).not.toHaveBeenCalled()
      expect(mocks.memberCreate).not.toHaveBeenCalled()
      expect(mocks.logAudit).not.toHaveBeenCalled()
    },
  )

  it('rejects a historical Owner invitation without consuming it', async () => {
    mocks.inviteFindUnique.mockResolvedValue({
      ...pendingInvite,
      role: 'OWNER',
    })
    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mocks.memberFindUnique).not.toHaveBeenCalled()
    expect(mocks.inviteUpdateMany).not.toHaveBeenCalled()
    expect(mocks.memberCreate).not.toHaveBeenCalled()
    expect(mocks.logAudit).not.toHaveBeenCalled()
  })

  it.each([
    ['expired', { ...pendingInvite, expiresAt: new Date(0) }, 410],
    ['accepted', { ...pendingInvite, acceptedAt: new Date() }, 409],
    ['canceled or rotated', null, 404],
  ] as const)(
    'rejects an %s invitation without side effects',
    async (_label, invite, status) => {
      mocks.inviteFindUnique.mockResolvedValue(invite)
      const response = await POST(request())
      expect(response.status).toBe(status)
      expect(mocks.inviteUpdateMany).not.toHaveBeenCalled()
      expect(mocks.memberCreate).not.toHaveBeenCalled()
      expect(mocks.logAudit).not.toHaveBeenCalled()
    },
  )

  it('fails closed when resend rotates the token before the atomic claim', async () => {
    mocks.inviteUpdateMany.mockResolvedValue({ count: 0 })
    const response = await POST(request('invite-token'))

    expect(response.status).toBe(409)
    expect(mocks.inviteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ token: 'invite-token' }),
      }),
    )
    expect(mocks.memberCreate).not.toHaveBeenCalled()
    expect(mocks.logAudit).not.toHaveBeenCalled()
  })

  it('fails closed when the authoritative role changes before the claim', async () => {
    mocks.inviteUpdateMany.mockResolvedValue({ count: 0 })
    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(mocks.inviteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'MEMBER' }),
      }),
    )
    expect(mocks.memberCreate).not.toHaveBeenCalled()
  })

  it('rolls back the invitation claim when membership creation fails', async () => {
    mocks.memberCreate.mockRejectedValue(new Error('insert failed'))
    await expect(POST(request())).rejects.toThrow('insert failed')
    expect(mocks.logAudit).not.toHaveBeenCalled()
  })

  it('returns a conflict when concurrent membership creation wins the unique race', async () => {
    mocks.transaction.mockRejectedValue({ code: 'P2002' })
    const response = await POST(request())

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      error: 'Already a workspace member',
    })
    expect(mocks.logAudit).not.toHaveBeenCalled()
  })
})
