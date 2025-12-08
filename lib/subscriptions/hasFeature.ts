// lib/subscriptions/hasFeature.ts
import { FEATURE_MATRIX, type TierKey, type FeatureKey } from './features'

export function hasFeature(
  plan: string | TierKey,
  feature: FeatureKey,
): boolean {
  const key = (plan ?? 'basic').toLowerCase() as TierKey
  const matrix = FEATURE_MATRIX[key] ?? FEATURE_MATRIX.basic
  return !!matrix[feature]
}
