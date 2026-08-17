import { describe, expect, it } from 'vitest'

import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import {
  canManageBilling,
  canManageOperations,
  canManageWorkspace,
  getWorkspaceRoleLabel,
  inviteRoleOptions,
  normalizeWorkspaceRole,
  workspaceRoleOptions,
} from '@/lib/workspaces/workspaceRoles'

describe('workspace role policy', () => {
  it('exposes Manager as a real workspace role option', () => {
    expect(workspaceRoleOptions.map((role) => role.value)).toContain(
      WorkspaceMemberRole.MANAGER,
    )
    expect(inviteRoleOptions.map((role) => role.value)).toContain(
      WorkspaceMemberRole.MANAGER,
    )
    expect(getWorkspaceRoleLabel('MANAGER')).toBe('Manager')
  })

  it('normalizes enum values without accepting display-only labels', () => {
    expect(normalizeWorkspaceRole('MANAGER')).toBe(WorkspaceMemberRole.MANAGER)
    expect(normalizeWorkspaceRole('manager')).toBe(WorkspaceMemberRole.MANAGER)
    expect(normalizeWorkspaceRole('Team Lead')).toBeNull()
  })

  it('keeps Manager operational but not administrative or owner-only', () => {
    expect(canManageOperations('MANAGER')).toBe(true)
    expect(canManageWorkspace('MANAGER')).toBe(false)
    expect(canManageBilling('MANAGER')).toBe(false)
    expect(canManageWorkspace('ADMIN')).toBe(true)
    expect(canManageBilling('OWNER')).toBe(true)
  })
})
