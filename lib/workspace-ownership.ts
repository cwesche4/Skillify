export type TaskOwnerType = 'USER' | 'TEAM' | 'SYSTEM'

export type WorkspaceOwner = {
  id: string
  workspaceId: string
  type: TaskOwnerType
  name: string
  active: boolean
  systemKey?: string
}

export type OwnerManageRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'MEMBER'
  | string
  | null

export function canManageWorkspaceOwners(role: OwnerManageRole) {
  return canManageWorkspace(role)
}

export function createDemoWorkspaceOwners(
  workspaceId: string,
): WorkspaceOwner[] {
  // TODO: Replace demo owners with persisted workspace users, workspace teams,
  // and workspace-scoped system owners once owner/team management is backed by
  // database records.
  return [
    {
      id: 'owner-user-corbin',
      workspaceId,
      type: 'USER',
      name: 'Corbin',
      active: true,
    },
    {
      id: 'owner-team-ops',
      workspaceId,
      type: 'TEAM',
      name: 'Ops Team',
      active: true,
    },
    {
      id: 'owner-team-support',
      workspaceId,
      type: 'TEAM',
      name: 'Support Team',
      active: true,
    },
    {
      id: 'owner-system-skillify-ai',
      workspaceId,
      type: 'SYSTEM',
      name: 'Skillify AI',
      active: true,
      systemKey: 'skillify-ai',
    },
  ]
}

export function getOwnerName(owners: WorkspaceOwner[], ownerId: string) {
  return owners.find((owner) => owner.id === ownerId)?.name ?? 'Unassigned'
}

export function getActiveOwners(owners: WorkspaceOwner[]) {
  return owners.filter((owner) => owner.active)
}

export function getDemoOwnerIdByName(ownerName: string) {
  switch (ownerName) {
    case 'Corbin':
      return 'owner-user-corbin'
    case 'Ops Team':
      return 'owner-team-ops'
    case 'Support Team':
      return 'owner-team-support'
    case 'Skillify AI':
      return 'owner-system-skillify-ai'
    default:
      return 'owner-unassigned'
  }
}
import { canManageWorkspace } from '@/lib/workspaces/workspaceRoles'
