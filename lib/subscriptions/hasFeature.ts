// lib/subscriptions/hasFeature.ts

import type { Plan, FeatureKey } from './features'
import { FeatureMatrix } from './features'

/**
 * Determines whether a plan grants access to a feature.
 */
export function hasFeature(plan: Plan, feature: FeatureKey): boolean {
  const allowedPlans = FeatureMatrix[feature] as readonly Plan[]
  return allowedPlans.some((p) => p === plan)
}

/**
 * Convenience wrapper used inside components.
 */
export function requireFeature<T>(
  plan: Plan,
  feature: FeatureKey,
  onAllowed: () => T,
  onDenied: () => T,
): T {
  return hasFeature(plan, feature) ? onAllowed() : onDenied()
}
