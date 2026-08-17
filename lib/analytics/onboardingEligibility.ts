import { featureFlags } from '@/lib/config/featureFlags'
import type { InspectorAISettings } from '@/lib/inspector/settings'
import type { InspectorWorkMode } from '@/lib/inspector/workModes'

export type OnboardingEligibility = {
  allowed: boolean
  reason?: string
}

type EligibilityInput = {
  settings: InspectorAISettings
  orgDefaults?: {
    enableWalkthroughs?: boolean
  }
  workMode?: InspectorWorkMode
}

export function resolveOnboardingEligibility(
  input: EligibilityInput,
): OnboardingEligibility {
  const walkthroughsEnabledByUser = input.settings.enableWalkthroughs
  const orgAllows = input.orgDefaults?.enableWalkthroughs ?? true
  const workModeAllows = input.workMode !== 'expert'
  const flagAllows = featureFlags.inspectorOnboarding ?? false

  if (walkthroughsEnabledByUser && orgAllows && workModeAllows && flagAllows) {
    return { allowed: true }
  }

  return {
    allowed: false,
    reason: !flagAllows
      ? 'feature_flag_disabled'
      : !walkthroughsEnabledByUser
        ? 'user_disabled'
        : !orgAllows
          ? 'org_policy'
          : 'work_mode_disabled',
  }
}
