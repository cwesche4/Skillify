/**
 * PHASE 10.1 — Monetization Readiness (Contracts & Gating Only)
 *
 * Contract:
 * - Types and constants only; no runtime enablement
 * - Disabled by default, non-mutating, deterministic
 * - MUST NOT introduce billing, pricing, or payment logic
 */

import { featureFlags } from '@/lib/config/featureFlags'

export type MonetizationPlanId = 'free' | 'pro' | 'enterprise' | 'unknown'

export type EntitlementKey =
  | 'ai_assist'
  | 'inspector_heatmaps'
  | 'analytics_dashboards'
  | 'preset_sharing'
  | 'marketplace_access'

export type EntitlementDescriptor = {
  plan: MonetizationPlanId
  entitlement: EntitlementKey
  description?: string
}

export type EntitlementResult = {
  entitled: boolean
  reason: 'monetization_disabled' | 'plan_insufficient' | 'not_configured'
}

export type EntitlementContext = {
  planId?: MonetizationPlanId
  workspaceId?: string
}

/**
 * Read-only evaluator with preview gating.
 * analytics_dashboards MAY be entitled when preview flag is ON and plan is pro|enterprise.
 * All other scenarios remain inert and disabled.
 */
export function evaluateEntitlement(
  entitlement?: EntitlementKey,
  context?: EntitlementContext,
): EntitlementResult {
  if (!featureFlags.monetizationPreview) {
    return { entitled: false, reason: 'monetization_disabled' }
  }

  if (entitlement !== 'analytics_dashboards') {
    return { entitled: false, reason: 'monetization_disabled' }
  }

  const plan = context?.planId ?? 'unknown'
  if (plan === 'pro' || plan === 'enterprise') {
    return { entitled: true, reason: 'not_configured' }
  }

  return { entitled: false, reason: 'plan_insufficient' }
}
