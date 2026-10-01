import { describe, expect, it } from 'vitest'

import { authorizeWorkspaceAccess } from '@/lib/automations/authorization'

function dependencies(role: string | null) {
  return {
    getUserId: async () => 'clerk-user',
    findMembership: async () =>
      role ? { id: 'member-a', userId: 'profile-user', role } : null,
  }
}

describe('Estimate authorization policy', () => {
  it.each(['OWNER', 'ADMIN', 'MANAGER'])(
    'allows %s to manage commercial Estimates',
    async (role) => {
      await expect(
        authorizeWorkspaceAccess(
          { workspaceId: 'ws-a', access: 'manage' },
          dependencies(role),
        ),
      ).resolves.toMatchObject({ allowed: true, role })
    },
  )

  it.each(['MEMBER', 'UNKNOWN', null])(
    'fails closed for role %s',
    async (role) => {
      await expect(
        authorizeWorkspaceAccess(
          { workspaceId: 'ws-a', access: 'manage' },
          dependencies(role),
        ),
      ).resolves.toMatchObject({ allowed: false, status: 403 })
    },
  )
})
