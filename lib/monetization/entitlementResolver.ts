import {
  EntitlementContext,
  EntitlementKey,
  EntitlementResult,
  evaluateEntitlement,
} from './contracts'
import { evaluatePhase11PreviewEntitlement } from './phase11PreviewGate'

export function resolveEntitlement(
  entitlement?: EntitlementKey,
  context?: EntitlementContext,
): EntitlementResult {
  if (entitlement) {
    const preview = evaluatePhase11PreviewEntitlement(entitlement, context)
    if (preview) return preview
  }

  return evaluateEntitlement(entitlement, context)
}
