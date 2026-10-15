import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  profileFindUnique: vi.fn(),
  profileFindFirst: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindMany: vi.fn(),
  memberCount: vi.fn(),
  memberUpdate: vi.fn(),
  memberDelete: vi.fn(),
  transaction: vi.fn(),
  inviteFindFirst: vi.fn(),
  inviteFindUnique: vi.fn(),
  inviteCreate: vi.fn(),
  inviteUpdateMany: vi.fn(),
  inviteDeleteMany: vi.fn(),
  requireWorkspaceRole: vi.fn(),
  getWorkspaceSettings: vi.fn(),
  setWorkspaceAiActionsEnabled: vi.fn(),
  queryAiActionAudits: vi.fn(),
  zipFile: vi.fn(),
  zipGenerate: vi.fn(),
  calendarCleanup: vi.fn(),
  logAudit: vi.fn(),
}))

vi.mock('@clerk/nextjs/server', () => ({ auth: mocks.auth }))
vi.mock('@/lib/db', () => ({
  prisma: {
    userProfile: {
      findUnique: mocks.profileFindUnique,
      findFirst: mocks.profileFindFirst,
    },
    workspaceMember: {
      findUnique: mocks.memberFindUnique,
      findMany: mocks.memberFindMany,
      count: mocks.memberCount,
      update: mocks.memberUpdate,
      delete: mocks.memberDelete,
    },
    workspaceInvite: {
      findFirst: mocks.inviteFindFirst,
      findUnique: mocks.inviteFindUnique,
      create: mocks.inviteCreate,
      updateMany: mocks.inviteUpdateMany,
      deleteMany: mocks.inviteDeleteMany,
    },
    $transaction: mocks.transaction,
  },
}))
vi.mock('jszip', () => ({
  default: class MockZip {
    file = mocks.zipFile
    generateAsync = mocks.zipGenerate
  },
}))
vi.mock('@/lib/auth/requireRole', () => ({
  requireWorkspaceRole: mocks.requireWorkspaceRole,
}))
vi.mock('@/lib/workspaces/settings', () => ({
  getWorkspaceSettings: mocks.getWorkspaceSettings,
  setWorkspaceAiActionsEnabled: mocks.setWorkspaceAiActionsEnabled,
}))
vi.mock('@/lib/builder/ai/server/auditQuery', () => ({
  queryAiActionAudits: mocks.queryAiActionAudits,
}))
vi.mock('@/lib/scheduling/providers/calendarGovernance', () => ({
  handleWorkspaceMemberCalendarConnectionLifecycle: mocks.calendarCleanup,
}))
vi.mock('@/lib/audit/log', () => ({ logAudit: mocks.logAudit }))

import {
  DELETE as deleteMember,
  PATCH as patchMember,
} from '@/app/api/workspaces/[workspaceId]/members/route'
import { PATCH as patchMemberById } from '@/app/api/workspaces/[workspaceId]/members/[memberId]/role/route'
import { DELETE as deleteMemberById } from '@/app/api/workspaces/[workspaceId]/members/[memberId]/route'
import { POST as legacyPatchMember } from '@/app/api/workspaces/[workspaceId]/members/update-role/route'
import { POST as legacyDeleteMember } from '@/app/api/workspaces/[workspaceId]/members/remove/route'
import {
  GET as getAiSettings,
  PUT as putAiSettings,
} from '@/app/api/workspaces/[workspaceId]/settings/ai-actions/route'
import { GET as getAiAudit } from '@/app/api/workspaces/[workspaceId]/ai-actions/audit/route'
import { GET as getAiEvidence } from '@/app/api/workspaces/[workspaceId]/ai-actions/evidence/route'
import { POST as resendInvite } from '@/app/api/workspaces/[workspaceId]/invite/resend/route'
import {
  GET as getInvites,
  PATCH as patchInvite,
} from '@/app/api/workspaces/[workspaceId]/invite/route'

const context = { params: { workspaceId: 'workspace-a' } }

function jsonRequest(
  url: string,
  method: string,
  body: Record<string, unknown>,
) {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockActor(role: 'OWNER' | 'ADMIN' | 'MANAGER' | 'MEMBER') {
  mocks.auth.mockReturnValue({ userId: 'clerk-actor' })
  mocks.profileFindUnique.mockResolvedValue({ id: 'profile-actor' })
  mocks.memberFindUnique.mockResolvedValueOnce({
    id: 'actor-member',
    userId: 'profile-actor',
    workspaceId: 'workspace-a',
    role,
  })
}

describe('pre-pilot member authorization closure', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-actor' })
    mocks.profileFindUnique.mockResolvedValue({ id: 'profile-actor' })
    mocks.profileFindFirst.mockResolvedValue(null)
    mocks.memberUpdate.mockResolvedValue({
      id: 'target-member',
      workspaceId: 'workspace-a',
      role: 'MANAGER',
    })
    mocks.memberDelete.mockResolvedValue({ id: 'target-member' })
    mocks.memberCount.mockResolvedValue(1)
    mocks.calendarCleanup.mockResolvedValue(undefined)
    mocks.logAudit.mockResolvedValue(undefined)
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        workspaceMember: {
          findUnique: mocks.memberFindUnique,
          count: mocks.memberCount,
          update: mocks.memberUpdate,
          delete: mocks.memberDelete,
        },
      }),
    )
  })

  it('denies unauthenticated role changes without mutation', async () => {
    mocks.auth.mockReturnValue({ userId: null })
    const response = await patchMember(
      jsonRequest('http://localhost/members', 'PATCH', {
        memberId: 'target-member',
        role: 'ADMIN',
      }),
      context,
    )
    expect(response.status).toBe(401)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })

  it.each(['MEMBER', 'MANAGER'] as const)(
    'denies %s role changes without mutation',
    async (role) => {
      mockActor(role)
      const response = await patchMember(
        jsonRequest('http://localhost/members', 'PATCH', {
          memberId: 'target-member',
          role: 'ADMIN',
        }),
        context,
      )
      expect(response.status).toBe(403)
      expect(mocks.memberUpdate).not.toHaveBeenCalled()
    },
  )

  it('allows an Admin to apply a valid non-owner role with a compound workspace key', async () => {
    mockActor('ADMIN')
    mocks.memberFindUnique.mockResolvedValueOnce({
      id: 'target-member',
      workspaceId: 'workspace-a',
      role: 'MEMBER',
    })

    const response = await patchMember(
      jsonRequest('http://localhost/members', 'PATCH', {
        memberId: 'target-member',
        role: 'MANAGER',
      }),
      context,
    )

    expect(response.status).toBe(200)
    expect(mocks.memberUpdate).toHaveBeenCalledWith({
      where: {
        id_workspaceId: {
          id: 'target-member',
          workspaceId: 'workspace-a',
        },
      },
      data: { role: 'MANAGER' },
    })
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        actorId: 'profile-actor',
        action: 'MEMBER_ROLE_CHANGED',
      }),
    )
  })

  it('fails closed when an Admin targets another workspace member ID', async () => {
    mockActor('ADMIN')
    mocks.memberFindUnique.mockResolvedValueOnce(null)

    const response = await patchMember(
      jsonRequest('http://localhost/members', 'PATCH', {
        memberId: 'workspace-b-member',
        role: 'MANAGER',
      }),
      context,
    )

    expect(response.status).toBe(404)
    expect(mocks.memberFindUnique).toHaveBeenLastCalledWith({
      where: {
        id_workspaceId: {
          id: 'workspace-b-member',
          workspaceId: 'workspace-a',
        },
      },
    })
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })

  it('rejects invalid roles and generic promotion to Owner', async () => {
    mockActor('OWNER')
    const invalid = await patchMember(
      jsonRequest('http://localhost/members', 'PATCH', {
        memberId: 'target-member',
        role: 'SUPERADMIN',
      }),
      context,
    )
    expect(invalid.status).toBe(400)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()

    mocks.memberFindUnique.mockReset()
    mockActor('OWNER')
    mocks.memberFindUnique.mockResolvedValueOnce({
      id: 'target-member',
      workspaceId: 'workspace-a',
      role: 'ADMIN',
    })
    const promote = await patchMember(
      jsonRequest('http://localhost/members', 'PATCH', {
        memberId: 'target-member',
        role: 'OWNER',
      }),
      context,
    )
    expect(promote.status).toBe(400)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })

  it('protects the last Owner from demotion', async () => {
    mockActor('OWNER')
    mocks.memberFindUnique.mockResolvedValueOnce({
      id: 'target-owner',
      workspaceId: 'workspace-a',
      role: 'OWNER',
    })
    mocks.memberCount.mockResolvedValue(1)

    const response = await patchMember(
      jsonRequest('http://localhost/members', 'PATCH', {
        memberId: 'target-owner',
        role: 'ADMIN',
      }),
      context,
    )
    expect(response.status).toBe(400)
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
  })

  it('denies unauthenticated removal without cleanup or mutation', async () => {
    mocks.auth.mockReturnValue({ userId: null })
    const response = await deleteMember(
      new Request('http://localhost/members?memberId=target-member', {
        method: 'DELETE',
      }),
      context,
    )
    expect(response.status).toBe(401)
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
    expect(mocks.memberDelete).not.toHaveBeenCalled()
  })

  it('fails closed on cross-workspace removal', async () => {
    mockActor('ADMIN')
    mocks.memberFindUnique.mockResolvedValueOnce(null)
    const response = await deleteMember(
      new Request('http://localhost/members?memberId=workspace-b-member', {
        method: 'DELETE',
      }),
      context,
    )
    expect(response.status).toBe(404)
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
    expect(mocks.memberDelete).not.toHaveBeenCalled()
  })

  it('denies ordinary Members and protects the last Owner from removal', async () => {
    mockActor('MEMBER')
    const memberDenied = await deleteMember(
      new Request('http://localhost/members?memberId=target-member', {
        method: 'DELETE',
      }),
      context,
    )
    expect(memberDenied.status).toBe(403)
    expect(mocks.memberDelete).not.toHaveBeenCalled()

    mocks.memberFindUnique.mockReset()
    mockActor('OWNER')
    mocks.memberFindUnique.mockResolvedValueOnce({
      id: 'target-owner',
      workspaceId: 'workspace-a',
      role: 'OWNER',
    })
    mocks.memberCount.mockResolvedValue(1)
    const ownerDenied = await deleteMember(
      new Request('http://localhost/members?memberId=target-owner', {
        method: 'DELETE',
      }),
      context,
    )
    expect(ownerDenied.status).toBe(400)
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
    expect(mocks.memberDelete).not.toHaveBeenCalled()
  })

  it('preserves calendar cleanup for legitimate member removal', async () => {
    mockActor('ADMIN')
    mocks.memberFindUnique.mockResolvedValueOnce({
      id: 'target-member',
      workspaceId: 'workspace-a',
      role: 'MEMBER',
    })

    const response = await deleteMember(
      new Request('http://localhost/members?memberId=target-member', {
        method: 'DELETE',
      }),
      context,
    )
    expect(response.status).toBe(200)
    expect(mocks.calendarCleanup).toHaveBeenCalledWith({
      workspaceId: 'workspace-a',
      workspaceMemberId: 'target-member',
      transition: 'removed',
      actor: {
        workspaceMemberId: 'actor-member',
        userId: 'profile-actor',
      },
      db: expect.any(Object),
    })
    expect(mocks.memberDelete).toHaveBeenCalledWith({
      where: {
        id_workspaceId: {
          id: 'target-member',
          workspaceId: 'workspace-a',
        },
      },
    })
  })

  it('gives legacy and path-parameter endpoints canonical denial behavior', async () => {
    for (const call of [
      () =>
        patchMemberById(
          jsonRequest('http://localhost/member/role', 'PATCH', {
            role: 'ADMIN',
          }),
          {
            params: {
              workspaceId: 'workspace-a',
              memberId: 'target-member',
            },
          },
        ),
      () =>
        legacyPatchMember(
          jsonRequest('http://localhost/members/update-role', 'POST', {
            memberId: 'target-member',
            role: 'ADMIN',
          }),
          context,
        ),
      () =>
        deleteMemberById(
          new Request('http://localhost/member', { method: 'DELETE' }),
          {
            params: {
              workspaceId: 'workspace-a',
              memberId: 'target-member',
            },
          },
        ),
      () =>
        legacyDeleteMember(
          jsonRequest('http://localhost/members/remove', 'POST', {
            memberId: 'target-member',
          }),
          context,
        ),
    ]) {
      mocks.auth.mockReturnValue({ userId: null })
      const response = await call()
      expect(response.status).toBe(401)
    }
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
    expect(mocks.memberDelete).not.toHaveBeenCalled()
  })

  it('enforces last-Owner protection through every legacy mutation delegate', async () => {
    const calls = [
      () =>
        patchMemberById(
          jsonRequest('http://localhost/member/role', 'PATCH', {
            role: 'ADMIN',
          }),
          { params: { workspaceId: 'workspace-a', memberId: 'owner-a' } },
        ),
      () =>
        legacyPatchMember(
          jsonRequest('http://localhost/members/update-role', 'POST', {
            memberId: 'owner-a',
            role: 'ADMIN',
          }),
          context,
        ),
      () =>
        deleteMemberById(
          new Request('http://localhost/member', { method: 'DELETE' }),
          { params: { workspaceId: 'workspace-a', memberId: 'owner-a' } },
        ),
      () =>
        legacyDeleteMember(
          jsonRequest('http://localhost/members/remove', 'POST', {
            memberId: 'owner-a',
          }),
          context,
        ),
    ]

    for (const call of calls) {
      mocks.memberFindUnique.mockReset()
      mocks.memberFindUnique
        .mockResolvedValueOnce({ id: 'owner-a', role: 'OWNER' })
        .mockResolvedValueOnce({
          id: 'owner-a',
          userId: 'profile-actor',
          workspaceId: 'workspace-a',
          role: 'OWNER',
        })
      mocks.memberCount.mockResolvedValue(1)

      const response = await call()
      expect(response.status).toBe(400)
    }
    expect(mocks.memberUpdate).not.toHaveBeenCalled()
    expect(mocks.memberDelete).not.toHaveBeenCalled()
    expect(mocks.calendarCleanup).not.toHaveBeenCalled()
  })

  it('preserves historical success payloads through canonical legacy delegates', async () => {
    const calls = [
      {
        invoke: () =>
          patchMemberById(
            jsonRequest('http://localhost/member/role', 'PATCH', {
              role: 'MANAGER',
            }),
            {
              params: { workspaceId: 'workspace-a', memberId: 'target-member' },
            },
          ),
        expected: { success: true },
        operation: 'update',
      },
      {
        invoke: () =>
          legacyPatchMember(
            jsonRequest('http://localhost/members/update-role', 'POST', {
              memberId: 'target-member',
              role: 'MANAGER',
            }),
            context,
          ),
        expected: {
          success: true,
          data: {
            id: 'target-member',
            workspaceId: 'workspace-a',
            role: 'MANAGER',
          },
        },
        operation: 'update',
      },
      {
        invoke: () =>
          deleteMemberById(
            new Request('http://localhost/member', { method: 'DELETE' }),
            {
              params: { workspaceId: 'workspace-a', memberId: 'target-member' },
            },
          ),
        expected: { success: true },
        operation: 'delete',
      },
      {
        invoke: () =>
          legacyDeleteMember(
            jsonRequest('http://localhost/members/remove', 'POST', {
              memberId: 'target-member',
            }),
            context,
          ),
        expected: { success: true, data: { removed: true } },
        operation: 'delete',
      },
    ] as const

    for (const entry of calls) {
      vi.resetAllMocks()
      mocks.auth.mockReturnValue({ userId: 'clerk-actor' })
      mocks.profileFindUnique.mockResolvedValue({ id: 'profile-actor' })
      mocks.memberUpdate.mockResolvedValue({
        id: 'target-member',
        workspaceId: 'workspace-a',
        role: 'MANAGER',
      })
      mocks.memberFindUnique
        .mockResolvedValueOnce({ id: 'actor-member', role: 'ADMIN' })
        .mockResolvedValueOnce({
          id: 'target-member',
          workspaceId: 'workspace-a',
          role: 'MEMBER',
        })
      mocks.calendarCleanup.mockResolvedValue(undefined)
      mocks.logAudit.mockResolvedValue(undefined)
      mocks.transaction.mockImplementation(async (callback) =>
        callback({
          workspaceMember: {
            findUnique: mocks.memberFindUnique,
            count: mocks.memberCount,
            update: mocks.memberUpdate,
            delete: mocks.memberDelete,
          },
        }),
      )

      const response = await entry.invoke()
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual(entry.expected)
    }
  })
})

describe('AI and invitation authorization closure', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.auth.mockReturnValue({ userId: 'clerk-actor' })
    mocks.profileFindUnique.mockResolvedValue({ id: 'profile-actor' })
    mocks.profileFindFirst.mockResolvedValue(null)
    mocks.inviteUpdateMany.mockResolvedValue({ count: 1 })
    mocks.inviteDeleteMany.mockResolvedValue({ count: 1 })
    mocks.logAudit.mockResolvedValue(undefined)
  })

  it.each([
    { allowed: false, status: 401, expected: 401 },
    { allowed: false, status: 403, expected: 403 },
  ])('enforces AI settings GET denial %#', async (guard) => {
    mocks.requireWorkspaceRole.mockResolvedValue(guard)
    const response = await getAiSettings(
      new Request('http://localhost/settings') as never,
      context,
    )
    expect(response.status).toBe(guard.expected)
    expect(mocks.getWorkspaceSettings).not.toHaveBeenCalled()
  })

  it('prevents unauthorized AI settings writes and audits authorized changes', async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      allowed: false,
      status: 403,
    })
    const denied = await putAiSettings(
      jsonRequest('http://localhost/settings', 'PUT', {
        aiActionsEnabled: true,
      }) as never,
      context,
    )
    expect(denied.status).toBe(403)
    expect(mocks.setWorkspaceAiActionsEnabled).not.toHaveBeenCalled()

    mocks.requireWorkspaceRole.mockResolvedValue({
      allowed: true,
      role: 'owner',
      userId: 'clerk-actor',
    })
    mocks.setWorkspaceAiActionsEnabled.mockResolvedValue({
      aiActionsEnabled: true,
    })
    const allowed = await putAiSettings(
      jsonRequest('http://localhost/settings', 'PUT', {
        aiActionsEnabled: true,
      }) as never,
      context,
    )
    expect(allowed.status).toBe(200)
    expect(mocks.setWorkspaceAiActionsEnabled).toHaveBeenCalledWith(
      'workspace-a',
      true,
    )
    expect(mocks.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'workspace-a',
        action: 'AI_ACTIONS_SETTING_CHANGED',
      }),
    )
  })

  it('denies AI audit reads before querying workspace records', async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      allowed: false,
      status: 403,
    })
    const response = await getAiAudit(
      new Request('http://localhost/audit') as never,
      context,
    )
    expect(response.status).toBe(403)
    expect(mocks.queryAiActionAudits).not.toHaveBeenCalled()
  })

  it('requires authentication before AI audit access', async () => {
    mocks.auth.mockReturnValue({ userId: null })
    const response = await getAiAudit(
      new Request('http://localhost/audit') as never,
      context,
    )
    expect(response.status).toBe(401)
    expect(mocks.requireWorkspaceRole).not.toHaveBeenCalled()
    expect(mocks.queryAiActionAudits).not.toHaveBeenCalled()
  })

  it('scopes authorized AI audit queries to the route workspace', async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      allowed: true,
      role: 'admin',
      userId: 'clerk-actor',
    })
    mocks.queryAiActionAudits.mockResolvedValue([])
    const response = await getAiAudit(
      new Request('http://localhost/audit') as never,
      context,
    )
    expect(response.status).toBe(200)
    expect(mocks.queryAiActionAudits).toHaveBeenCalledWith(
      'workspace-a',
      expect.any(Object),
    )
  })

  it.each(['member', 'manager'])(
    'denies %s AI evidence access before query and archive generation',
    async () => {
      mocks.zipGenerate.mockResolvedValue(Buffer.from('zip'))
      mocks.requireWorkspaceRole.mockResolvedValue({
        allowed: false,
        status: 403,
      })
      const response = await getAiEvidence(
        new Request('http://localhost/evidence'),
        context,
      )
      expect(response.status).toBe(403)
      expect(mocks.queryAiActionAudits).not.toHaveBeenCalled()
      expect(mocks.zipFile).not.toHaveBeenCalled()
      expect(mocks.zipGenerate).not.toHaveBeenCalled()
    },
  )

  it('fails a cross-workspace evidence request closed at the route workspace guard', async () => {
    mocks.requireWorkspaceRole.mockResolvedValue({
      allowed: false,
      status: 403,
    })
    const response = await getAiEvidence(
      new Request('http://localhost/evidence'),
      context,
    )
    expect(response.status).toBe(403)
    expect(mocks.requireWorkspaceRole).toHaveBeenCalledWith('workspace-a', [
      'OWNER',
      'ADMIN',
    ])
    expect(mocks.queryAiActionAudits).not.toHaveBeenCalled()
    expect(mocks.zipGenerate).not.toHaveBeenCalled()
  })

  it('requires authentication before the AI evidence role lookup', async () => {
    mocks.auth.mockReturnValue({ userId: null })
    const response = await getAiEvidence(
      new Request('http://localhost/evidence'),
      context,
    )
    expect(response.status).toBe(401)
    expect(mocks.requireWorkspaceRole).not.toHaveBeenCalled()
    expect(mocks.queryAiActionAudits).not.toHaveBeenCalled()
    expect(mocks.zipGenerate).not.toHaveBeenCalled()
  })

  it.each(['owner', 'admin'] as const)(
    'allows an authorized %s to export the scoped AI evidence ZIP',
    async (role) => {
      mocks.requireWorkspaceRole.mockResolvedValue({
        allowed: true,
        role,
        userId: 'clerk-actor',
      })
      mocks.queryAiActionAudits.mockResolvedValue([])
      mocks.zipGenerate.mockResolvedValue(Buffer.from('zip'))

      const response = await getAiEvidence(
        new Request('http://localhost/evidence'),
        context,
      )
      expect(response.status).toBe(200)
      expect(mocks.queryAiActionAudits).toHaveBeenCalledWith(
        'workspace-a',
        expect.any(Object),
      )
      expect(mocks.zipGenerate).toHaveBeenCalledWith({ type: 'nodebuffer' })
    },
  )

  it('denies invitation resend by a non-manager without creating an invite', async () => {
    mocks.memberFindUnique.mockResolvedValue({
      id: 'actor-member',
      role: 'MEMBER',
    })
    const response = await resendInvite(
      jsonRequest('http://localhost/invite/resend', 'POST', {
        email: 'invitee@example.com',
        role: 'MEMBER',
      }),
      context,
    )
    expect(response.status).toBe(403)
    expect(mocks.inviteCreate).not.toHaveBeenCalled()
    expect(mocks.inviteUpdateMany).not.toHaveBeenCalled()
  })

  it('prevents ordinary members from listing workspace invitations', async () => {
    mocks.memberFindUnique.mockResolvedValue({
      id: 'actor-member',
      role: 'MEMBER',
    })
    const response = await getInvites(
      new Request('http://localhost/invite'),
      context,
    )
    expect(response.status).toBe(403)
    expect(mocks.inviteFindFirst).not.toHaveBeenCalled()
  })

  it('resends only the matching workspace invitation without exposing its token', async () => {
    mocks.memberFindUnique.mockResolvedValue({
      id: 'actor-member',
      role: 'ADMIN',
    })
    mocks.inviteFindFirst.mockResolvedValue({
      id: 'invite-a',
      workspaceId: 'workspace-a',
      email: 'invitee@example.com',
      role: 'MEMBER',
      token: 'old-secret-token',
      expiresAt: new Date('2026-10-20T00:00:00.000Z'),
      acceptedAt: null,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    })
    mocks.inviteUpdateMany.mockResolvedValue({ count: 1 })

    const response = await resendInvite(
      jsonRequest('http://localhost/invite/resend', 'POST', {
        email: 'invitee@example.com',
        role: 'MANAGER',
      }),
      context,
    )

    expect(response.status).toBe(200)
    expect(mocks.inviteFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: 'workspace-a' }),
      }),
    )
    expect(mocks.inviteUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'invite-a',
          workspaceId: 'workspace-a',
          acceptedAt: null,
        },
      }),
    )
    const payload = await response.json()
    expect(payload).toMatchObject({
      ok: true,
      action: 'resent',
      invite: {
        id: 'invite-a',
        email: 'invitee@example.com',
        role: 'MANAGER',
      },
    })
    expect(JSON.stringify(payload).includes('token')).toBe(false)
  })

  it('does not update an invitation belonging to another workspace', async () => {
    mocks.memberFindUnique.mockResolvedValue({
      id: 'actor-member',
      role: 'ADMIN',
    })
    mocks.inviteFindUnique.mockResolvedValue({
      id: 'invite-b',
      workspaceId: 'workspace-b',
      role: 'MEMBER',
      acceptedAt: null,
    })
    const response = await patchInvite(
      jsonRequest('http://localhost/invite', 'PATCH', {
        inviteId: 'invite-b',
        role: 'ADMIN',
      }),
      context,
    )
    expect(response.status).toBe(404)
    expect(mocks.inviteUpdateMany).not.toHaveBeenCalled()
  })
})
