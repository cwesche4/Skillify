import { describe, expect, it } from 'vitest'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'

function dependencies(role: string | null) {
  return {
    getUserId: async () => 'clerk-user',
    findMembership: async () =>
      role ? { id: 'member-a', userId: 'profile-user', role } : null,
  }
}

describe('Recurring Service authorization policy', () => {
  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'allows %s to manage Recurring Services',
    async (role) => {
      await expect(
        authorizeWorkspaceAccess(
          { workspaceId: 'ws-a', access: 'manage' },
          dependencies(role),
        ),
      ).resolves.toMatchObject({ allowed: true, role })
    },
  )

  it('denies Members and non-members management authority', async () => {
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
