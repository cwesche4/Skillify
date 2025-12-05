// lib/subscriptions/hasFeature.ts
import { FEATURE_MATRIX, type FeatureKey, type TierKey } from "./features"

export function normalizePlan(plan: string | null | undefined): TierKey {
  if (!plan) return "basic"
  const lower = plan.toLowerCase()
  if (lower === "pro") return "pro"
  if (lower === "elite") return "elite"
  return "basic"
}

export function hasFeature(
  plan: string | null | undefined,
  feature: FeatureKey,
): boolean {
  const tier = normalizePlan(plan)
  return !!FEATURE_MATRIX[tier][feature]
}
