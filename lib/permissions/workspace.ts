// lib/permissions/workspace.ts
import {
  canManageOperations,
  canManageWorkspace as canManageWorkspaceRole,
} from '@/lib/workspaces/workspaceRoles'

export function canManageWorkspace(role: string) {
  return canManageWorkspaceRole(role)
}

export function isOwner(role: string) {
  return role === 'OWNER'
}

type ServiceRequestWorkspaceRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'MEMBER'
  | string
  | null
type ServiceRequestGlobalRole = string | null
type SalesPipelineWorkspaceRole =
  | 'OWNER'
  | 'ADMIN'
  | 'MANAGER'
  | 'MEMBER'
  | string
  | null
type SalesPipelineGlobalRole = string | null

export function canAccessServiceRequests(params: {
  workspaceRole?: ServiceRequestWorkspaceRole
  globalRole?: ServiceRequestGlobalRole
}) {
  const workspaceRole = params.workspaceRole?.toUpperCase()
  const globalRole = params.globalRole?.toLowerCase()

  // Service Requests is the internal workspace operations queue.
  // Client-facing intake/portal requests should be built separately later.
  // TODO: Add OPS/SUPPORT workspace roles here if they are introduced.
  return canManageOperations(workspaceRole) || globalRole === 'admin'
}

export function canAccessSalesPipeline(params: {
  workspaceRole?: SalesPipelineWorkspaceRole
  globalRole?: SalesPipelineGlobalRole
}) {
  const workspaceRole = params.workspaceRole?.toUpperCase()
  const globalRole = params.globalRole?.toLowerCase()

  // TODO: Add dedicated SALES_REP/SALES_MANAGER workspace roles here if they
  // are introduced in the role enum.
  return canManageOperations(workspaceRole) || globalRole === 'admin'
}
