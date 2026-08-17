import { afterEach, describe, expect, it } from 'vitest'

import { featureFlags } from '@/lib/config/featureFlags'
import { resolveOnboardingEligibility } from '@/lib/analytics/onboardingEligibility'

const ORIGINAL_FLAG = featureFlags.inspectorOnboarding

afterEach(() => {
  featureFlags.inspectorOnboarding = ORIGINAL_FLAG
})

describe('resolveOnboardingEligibility snapshots', () => {
  it('fully allowed when all inputs allow onboarding', () => {
    featureFlags.inspectorOnboarding = true
    const result = resolveOnboardingEligibility({
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: true,
        enableTelemetry: false,
      },
      orgDefaults: { enableWalkthroughs: true },
      workMode: 'build',
    })
    expect(result).toMatchSnapshot()
  })

  it('user disabled walkthroughs', () => {
    featureFlags.inspectorOnboarding = true
    const result = resolveOnboardingEligibility({
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: false,
        enableTelemetry: false,
      },
      orgDefaults: { enableWalkthroughs: true },
      workMode: 'build',
    })
    expect(result).toMatchSnapshot()
  })

  it('org policy disables walkthroughs', () => {
    featureFlags.inspectorOnboarding = true
    const result = resolveOnboardingEligibility({
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: true,
        enableTelemetry: false,
      },
      orgDefaults: { enableWalkthroughs: false },
      workMode: 'build',
    })
    expect(result).toMatchSnapshot()
  })

  it('work mode blocks onboarding (expert)', () => {
    featureFlags.inspectorOnboarding = true
    const result = resolveOnboardingEligibility({
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: true,
        enableTelemetry: false,
      },
      orgDefaults: { enableWalkthroughs: true },
      workMode: 'expert',
    })
    expect(result).toMatchSnapshot()
  })

  it('feature flag disabled', () => {
    featureFlags.inspectorOnboarding = false
    const result = resolveOnboardingEligibility({
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: true,
        enableTelemetry: false,
      },
      orgDefaults: { enableWalkthroughs: true },
      workMode: 'build',
    })
    expect(result).toMatchSnapshot()
  })

  it('partial inputs (missing org defaults and work mode)', () => {
    featureFlags.inspectorOnboarding = true
    const result = resolveOnboardingEligibility({
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: true,
        enableTelemetry: false,
      },
    })
    expect(result).toMatchSnapshot()
  })

  it('determinism check for identical input', () => {
    featureFlags.inspectorOnboarding = true
    const input = {
      settings: {
        enableInspectorAI: true,
        enableSuggestions: true,
        enableAutoFix: true,
        enableWalkthroughs: false,
        enableTelemetry: false,
      },
      orgDefaults: { enableWalkthroughs: true },
      workMode: 'build' as const,
    }
    const result1 = resolveOnboardingEligibility(input)
    const result2 = resolveOnboardingEligibility(input)
    expect(result1).toEqual(result2)
    expect(result1).toMatchSnapshot()
  })
})
