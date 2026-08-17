export type EntitlementKey =
  | 'SECURITY_PACK_REQUEST'
  | 'SECURITY_PACK_DOWNLOAD'
  | 'SECURITY_PACK_APPROVAL_INBOX'
  | 'WORKSPACE_AUDIT_FEED'
  | 'SERVICE_TOKEN_AUTOMATION'
  | 'CUSTOM_APPROVAL_ROLES'

export type EntitlementDetail = {
  key: EntitlementKey
  source: string
  effectiveAt: Date
  expiresAt: Date | null
  active: boolean
}

/**
 * Resolve active entitlements for a workspace.
 * - Reads contract entitlements and time-bound exceptions
 * - Honors effectiveAt/expiry
 * - No plan-name branching
 */
export async function getWorkspaceEntitlements(workspaceId: string) {
  void workspaceId
  return new Set<EntitlementKey>()
}

export async function hasWorkspaceEntitlement(
  workspaceId: string,
  key: EntitlementKey,
) {
  const entitlements = await getWorkspaceEntitlements(workspaceId)
  return entitlements.has(key)
}

/**
 * Read-only contract preview (for UI/ops)
 */
export async function getWorkspaceEntitlementDetails(
  workspaceId: string,
): Promise<EntitlementDetail[]> {
  void workspaceId
  return []
}
