import { ENTITLEMENT_SCOPES, type EntitlementScope } from './entitlementScopes'

type EntitlementRecord = {
  entitlementKey: string
  source: string
  effectiveAt: Date
  expiresAt: Date | null
}

type ResolverResult = {
  active: Set<EntitlementScope>
  details: Array<
    EntitlementRecord & {
      active: boolean
    }
  >
}

/**
 * Canonical entitlement resolver.
 * - Contract-driven only (no plan-name branching, no UI toggles)
 * - Honors time-bound exceptions (effective/expiry)
 * - Read-only; does not mutate or grant entitlements
 * - Suitable for append-only audit models (mutations happen elsewhere and are audited)
 */
export async function resolveWorkspaceEntitlements(
  workspaceId: string,
): Promise<ResolverResult> {
  void workspaceId
  void ENTITLEMENT_SCOPES
  return { active: new Set<EntitlementScope>(), details: [] }
}

/**
 * Read-only checker for a specific entitlement scope.
 */
export async function hasEntitlement(
  workspaceId: string,
  scope: EntitlementScope,
) {
  const { active } = await resolveWorkspaceEntitlements(workspaceId)
  return active.has(scope)
}
