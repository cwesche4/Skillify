import { afterEach, describe, expect, test } from 'vitest'

import { featureFlags } from '../../config/featureFlags'
import { resolveEntitlement } from '../entitlementResolver'

describe('phase11PreviewGate', () => {
  const originalFlag = featureFlags.monetizationPreview

  afterEach(() => {
    featureFlags.monetizationPreview = originalFlag
  })

  test('flag off delegates to phase 10 deny behavior', () => {
    featureFlags.monetizationPreview = false
    const results = {
      analyticsDashboardsPro: resolveEntitlement('analytics_dashboards', {
        planId: 'pro',
      }),
      aiAssistEnterprise: resolveEntitlement('ai_assist', {
        planId: 'enterprise',
      }),
    }

    expect(results).toMatchSnapshot()
  })

  test('flag on gates analytics_dashboards only', () => {
    featureFlags.monetizationPreview = true

    const analyticsDashboards = {
      free: resolveEntitlement('analytics_dashboards', { planId: 'free' }),
      unknown: resolveEntitlement('analytics_dashboards', {
        planId: 'unknown',
      }),
      missing: resolveEntitlement('analytics_dashboards'),
      pro: resolveEntitlement('analytics_dashboards', { planId: 'pro' }),
      enterprise: resolveEntitlement('analytics_dashboards', {
        planId: 'enterprise',
      }),
    }

    const otherEntitlements = {
      aiAssist: resolveEntitlement('ai_assist', { planId: 'pro' }),
      inspectorHeatmaps: resolveEntitlement('inspector_heatmaps', {
        planId: 'pro',
      }),
      presetSharing: resolveEntitlement('preset_sharing', { planId: 'pro' }),
      marketplaceAccess: resolveEntitlement('marketplace_access', {
        planId: 'pro',
      }),
    }

    const determinismCheck = {
      first: resolveEntitlement('analytics_dashboards', { planId: 'pro' }),
      second: resolveEntitlement('analytics_dashboards', { planId: 'pro' }),
    }

    expect({
      analyticsDashboards,
      otherEntitlements,
      determinismCheck,
    }).toMatchSnapshot()
    expect(determinismCheck.first).toEqual(determinismCheck.second)
  })
})
