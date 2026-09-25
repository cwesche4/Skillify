import { describe, expect, it } from 'vitest'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'
import { canAccessServiceRequests } from '@/lib/permissions/workspace'
import { WorkspaceBusinessModel } from '@/lib/prisma/enums'

function dependencies(role: string | null) {
  return {
    getUserId: async () => 'clerk-user',
    findMembership: async ({ workspaceId }: { workspaceId: string }) =>
      role
        ? { id: 'member-a', userId: 'profile-user', role, workspaceId }
        : null,
  }
}

describe('Jobs and Work Items workspace authorization policy', () => {
  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'allows %s to manage operational records',
    async (role) => {
      await expect(
        authorizeWorkspaceAccess(
          { workspaceId: 'ws-a', access: 'manage' },
          dependencies(role),
        ),
      ).resolves.toMatchObject({ allowed: true, role })
    },
  )

  it('allows MEMBER reads but rejects management', async () => {
    await expect(
      authorizeWorkspaceAccess(
        { workspaceId: 'ws-a', access: 'view' },
        dependencies('MEMBER'),
      ),
    ).resolves.toMatchObject({
      allowed: true,
      role: 'MEMBER',
      workspaceMemberId: 'member-a',
    })
    await expect(
      authorizeWorkspaceAccess(
        { workspaceId: 'ws-a', access: 'manage' },
        dependencies('MEMBER'),
      ),
    ).resolves.toEqual({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
  })

  it('rejects a caller without membership in the requested workspace', async () => {
    await expect(
      authorizeWorkspaceAccess(
        { workspaceId: 'ws-b', access: 'view' },
        dependencies(null),
      ),
    ).resolves.toEqual({
      allowed: false,
      status: 403,
      message: 'Forbidden',
    })
  })

  it('lets Simple Service Members reach assigned Jobs without broadening legacy Service Requests', () => {
    expect(
      canAccessServiceRequests({
        workspaceRole: 'MEMBER',
        businessModel: WorkspaceBusinessModel.SIMPLE_SERVICE_BUSINESS,
      }),
    ).toBe(true)
    expect(
      canAccessServiceRequests({
        workspaceRole: 'MEMBER',
        businessModel: WorkspaceBusinessModel.DIRECT_SALES,
      }),
    ).toBe(false)
  })
})
