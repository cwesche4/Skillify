import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { featureFlags } from '../../config/featureFlags'
import { EntitlementKey, evaluateEntitlement } from '../contracts'
import { resolveEntitlement } from '../entitlementResolver'

let originalPreviewFlag: boolean

beforeEach(() => {
  originalPreviewFlag = featureFlags.monetizationPreview
  featureFlags.monetizationPreview = false
})

afterEach(() => {
  featureFlags.monetizationPreview = originalPreviewFlag
})

describe('entitlement snapshots', () => {
  it('flag OFF -> all denied (default)', () => {
    expect(evaluateEntitlement()).toMatchSnapshot()
  })

  it('flag OFF -> analytics_dashboards denied even with plan', () => {
    expect(
      resolveEntitlement('analytics_dashboards', { planId: 'pro' }),
    ).toMatchSnapshot()
  })

  it('flag ON + plan free -> analytics_dashboards denied', () => {
    featureFlags.monetizationPreview = true
    expect(
      evaluateEntitlement('analytics_dashboards', { planId: 'free' }),
    ).toMatchSnapshot()
  })

  it('flag ON + plan pro -> analytics_dashboards allowed', () => {
    featureFlags.monetizationPreview = true
    expect(
      evaluateEntitlement('analytics_dashboards', { planId: 'pro' }),
    ).toMatchSnapshot()
  })

  it('flag ON + plan enterprise -> analytics_dashboards allowed', () => {
    featureFlags.monetizationPreview = true
    expect(
      evaluateEntitlement('analytics_dashboards', { planId: 'enterprise' }),
    ).toMatchSnapshot()
  })

  it('flag ON + other entitlement -> denied', () => {
    featureFlags.monetizationPreview = true
    expect(
      evaluateEntitlement('ai_assist' as EntitlementKey, {
        planId: 'enterprise',
      }),
    ).toMatchSnapshot()
  })
})
