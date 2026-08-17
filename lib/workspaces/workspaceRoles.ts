import { WorkspaceMemberRole } from '@/lib/prisma/enums'

export type WorkspaceRoleValue = WorkspaceMemberRole

export type WorkspaceRoleOption = {
  value: WorkspaceRoleValue
  label: string
  description: string
}

export const workspaceRoleOptions: WorkspaceRoleOption[] = [
  {
    value: WorkspaceMemberRole.MEMBER,
    label: 'Member',
    description: 'Assigned operational work without workspace administration.',
  },
  {
    value: WorkspaceMemberRole.MANAGER,
    label: 'Manager',
    description:
      'Daily operational control without billing, security, or ownership actions.',
  },
  {
    value: WorkspaceMemberRole.ADMIN,
    label: 'Admin',
    description: 'Workspace administration except owner-only actions.',
  },
  {
    value: WorkspaceMemberRole.OWNER,
    label: 'Owner',
    description:
      'Full workspace control, billing, and destructive workspace actions.',
  },
]

export const inviteRoleOptions = workspaceRoleOptions.filter(
  (role) => role.value !== WorkspaceMemberRole.OWNER,
)

const roleValues = new Set(workspaceRoleOptions.map((role) => role.value))

export function normalizeWorkspaceRole(
  value: unknown,
): WorkspaceRoleValue | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toUpperCase()
  return roleValues.has(normalized as WorkspaceRoleValue)
    ? (normalized as WorkspaceRoleValue)
    : null
}

export function getWorkspaceRoleLabel(value: unknown) {
  const role = normalizeWorkspaceRole(value)
  if (!role) return 'Unknown'
  return (
    workspaceRoleOptions.find((option) => option.value === role)?.label ?? role
  )
}

export function canManageWorkspace(role: unknown) {
  const normalized = normalizeWorkspaceRole(role)
  return (
    normalized === WorkspaceMemberRole.OWNER ||
    normalized === WorkspaceMemberRole.ADMIN
  )
}

export function canManageOperations(role: unknown) {
  const normalized = normalizeWorkspaceRole(role)
  return (
    normalized === WorkspaceMemberRole.OWNER ||
    normalized === WorkspaceMemberRole.ADMIN ||
    normalized === WorkspaceMemberRole.MANAGER
  )
}

export function canManageScheduling(role: unknown) {
  return canManageOperations(role)
}

export function canManageWorkspaceMembers(role: unknown) {
  return canManageWorkspace(role)
}

export function canManageBilling(role: unknown) {
  return normalizeWorkspaceRole(role) === WorkspaceMemberRole.OWNER
}

export function canPerformOwnerOnlyAction(role: unknown) {
  return normalizeWorkspaceRole(role) === WorkspaceMemberRole.OWNER
}
