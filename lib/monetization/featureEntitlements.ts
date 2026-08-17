/**
 * PHASE 10.2 — Feature → Entitlement Mapping (Read-Only)
 *
 * Contract:
 * - Static, deterministic mapping only
 * - No enforcement, no gating, no billing logic
 * - No feature flag or plan resolution
 * - Documentation-as-data for future monetization phases
 */

import type { EntitlementKey } from './contracts'

export type FeatureEntitlement = {
  feature: string
  entitlement: EntitlementKey
  description?: string
}

/**
 * Single source of truth for monetizable features and their entitlement keys.
 * MUST remain pure, static, and read-only. MUST NOT be used for enforcement.
 */
export const FEATURE_ENTITLEMENTS: FeatureEntitlement[] = [
  {
    feature: 'Inspector Heatmaps',
    entitlement: 'inspector_heatmaps',
    description: 'Advanced Inspector usage visualization overlays',
  },
  {
    feature: 'AI Assist',
    entitlement: 'ai_assist',
    description: 'AI-assisted configuration and insights',
  },
  {
    feature: 'Analytics Dashboards',
    entitlement: 'analytics_dashboards',
    description: 'Inspector analytics dashboards and reports',
  },
  {
    feature: 'Preset Sharing',
    entitlement: 'preset_sharing',
    description: 'Sharing Inspector presets across workspaces or orgs',
  },
  {
    feature: 'Marketplace Access',
    entitlement: 'marketplace_access',
    description: 'Access to curated preset and template marketplace',
  },
]
