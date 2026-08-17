import { featureFlags } from '@/lib/config/featureFlags'
import type {
  EntitlementKey,
  EntitlementResult,
  MonetizationPlanId,
} from './contracts'

/**
 * Phase 11.2 preview gate.
 * Returns null when the preview flag is off so callers can fall back to Phase 10.
 * Deterministic, pure, and non-mutating.
 */
export function evaluatePhase11PreviewEntitlement(
  entitlement: EntitlementKey,
  context?: { planId?: MonetizationPlanId },
): EntitlementResult | null {
  if (!featureFlags.monetizationPreview) return null

  if (entitlement !== 'analytics_dashboards') {
    return { entitled: false, reason: 'monetization_disabled' }
  }

  const plan = context?.planId
  if (plan === 'pro' || plan === 'enterprise') {
    return { entitled: true, reason: 'not_configured' }
  }

  return { entitled: false, reason: 'plan_insufficient' }
}
