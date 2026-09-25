import { describe, expect, it } from 'vitest'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'

function dependencies(role: string | null) {
  return {
    getUserId: async () => 'clerk-user',
    findMembership: async ({ workspaceId }: { workspaceId: string }) =>
      role
        ? {
            id: 'member-a',
            userId: 'profile-user',
            role,
            workspaceId,
          }
        : null,
  }
}

describe('durable Lead authorization policy', () => {
  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'allows %s to manage Leads',
    async (role) => {
      await expect(
        authorizeWorkspaceAccess(
          { workspaceId: 'ws-a', access: 'manage' },
          dependencies(role),
        ),
      ).resolves.toMatchObject({ allowed: true, role })
    },
  )

  it('denies general Lead management to Members and foreign callers', async () => {
    await expect(
      authorizeWorkspaceAccess(
        { workspaceId: 'ws-a', access: 'manage' },
        dependencies('MEMBER'),
      ),
    ).resolves.toMatchObject({ allowed: false, status: 403 })
    await expect(
      authorizeWorkspaceAccess(
        { workspaceId: 'ws-a', access: 'manage' },
        dependencies(null),
      ),
    ).resolves.toMatchObject({ allowed: false, status: 403 })
  })
})
