import { describe, expect, it } from 'vitest'

import { evaluateMonetizationPolicy } from '@/lib/monetization/policy'

describe('monetization policy snapshots', () => {
  it('default input (minimal fields)', () => {
    expect(
      evaluateMonetizationPolicy({
        entitlement: 'ai_assist',
      }),
    ).toMatchSnapshot()
  })

  it('explicit entitlement key', () => {
    expect(
      evaluateMonetizationPolicy({
        entitlement: 'inspector_heatmaps',
      }),
    ).toMatchSnapshot()
  })

  it('workspace + user context', () => {
    expect(
      evaluateMonetizationPolicy({
        entitlement: 'preset_sharing',
        workspaceId: 'ws_123',
        userId: 'user_456',
      }),
    ).toMatchSnapshot()
  })

  it('plan provided (free / pro / enterprise)', () => {
    const inputs = [
      { entitlement: 'analytics_dashboards', planId: 'free' },
      { entitlement: 'analytics_dashboards', planId: 'pro' },
      { entitlement: 'analytics_dashboards', planId: 'enterprise' },
    ] as const
    const results = inputs.map((input) => evaluateMonetizationPolicy(input))
    expect(results).toMatchSnapshot()
  })

  it('repeated identical input yields identical output', () => {
    const first = evaluateMonetizationPolicy({
      entitlement: 'marketplace_access',
    })
    const second = evaluateMonetizationPolicy({
      entitlement: 'marketplace_access',
    })
    expect(first).toEqual(second)
    expect(first).toMatchSnapshot()
  })

  it('multiple different inputs are all denied', () => {
    const inputs = [
      { entitlement: 'ai_assist' },
      { entitlement: 'inspector_heatmaps', workspaceId: 'ws_a' },
      { entitlement: 'preset_sharing', userId: 'user_b' },
      { entitlement: 'marketplace_access', planId: 'unknown' },
    ] as const
    const decisions = inputs.map((input) => evaluateMonetizationPolicy(input))
    expect(decisions).toMatchSnapshot()
  })
})
