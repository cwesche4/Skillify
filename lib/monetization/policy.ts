/**
 * PHASE 10.4 — Monetization Policy Boundary (Non-Enforcing)
 *
 * Contract:
 * - Defines advisory-only policy structures
 * - Pure, deterministic, and inert
 * - MUST NOT enforce or grant access
 * - MUST NOT read feature flags, plans, or external systems
 */

import type { EntitlementKey } from './contracts'
import type { MonetizationPlanId } from './contracts'

export type MonetizationPolicyInput = {
  entitlement: EntitlementKey
  workspaceId?: string
  userId?: string
  planId?: MonetizationPlanId
}

export type MonetizationPolicyDecision = {
  allowed: false
  reason: 'monetization_disabled'
}

/**
 * Advisory-only policy evaluation.
 * Always denies; no enforcement or gating is performed.
 */
export function evaluateMonetizationPolicy(
  _input: MonetizationPolicyInput,
): MonetizationPolicyDecision {
  return { allowed: false, reason: 'monetization_disabled' }
}
