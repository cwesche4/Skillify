import { WorkspaceMemberRole } from '@/lib/prisma/enums'
import {
  canManageOperations,
  normalizeWorkspaceRole,
} from '@/lib/workspaces/workspaceRoles'

export const AUTOMATION_MANAGEMENT_ROLES = [
  WorkspaceMemberRole.OWNER,
  WorkspaceMemberRole.ADMIN,
  WorkspaceMemberRole.MANAGER,
] as const

export type AutomationLifecycleStatus =
  | 'INACTIVE'
  | 'ACTIVE'
  | 'PAUSED'
  | 'ARCHIVED'

const ALLOWED_STATUS_TRANSITIONS: Record<
  AutomationLifecycleStatus,
  readonly AutomationLifecycleStatus[]
> = {
  INACTIVE: ['ACTIVE', 'ARCHIVED'],
  ACTIVE: ['INACTIVE', 'PAUSED', 'ARCHIVED'],
  PAUSED: ['INACTIVE', 'ACTIVE', 'ARCHIVED'],
  ARCHIVED: ['INACTIVE'],
}

export function canViewAutomations(role: unknown) {
  return normalizeWorkspaceRole(role) !== null
}

export function canManageAutomations(role: unknown) {
  return canManageOperations(role)
}

export function canTransitionAutomationStatus(
  current: AutomationLifecycleStatus,
  next: AutomationLifecycleStatus,
) {
  return current === next || ALLOWED_STATUS_TRANSITIONS[current].includes(next)
}

export function getAutomationStatusTransitionError(
  current: AutomationLifecycleStatus,
  next: AutomationLifecycleStatus,
) {
  if (canTransitionAutomationStatus(current, next)) return null
  return `Automation status cannot change from ${current} to ${next}.`
}

export function getAutomationActivationError(
  next: AutomationLifecycleStatus,
  flow: unknown,
) {
  if (next !== 'ACTIVE') return null
  if (!flow || typeof flow !== 'object') return 'Automation has no flow.'
  const nodes = (flow as { nodes?: unknown }).nodes
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return 'Automation must contain at least one node before activation.'
  }
  return null
}

export function getAutomationExecutionPreconditionError(input: {
  status: AutomationLifecycleStatus
  workspaceId: string
  expectedWorkspaceId: string
}) {
  if (input.workspaceId !== input.expectedWorkspaceId) {
    return 'Automation not found'
  }
  if (input.status !== 'ACTIVE') return 'Automation is not active'
  return null
}

export function getAdvancedAutomationMutationError(managedBySimple: boolean) {
  return managedBySimple
    ? 'This workflow is managed from Simple Automations.'
    : null
}
