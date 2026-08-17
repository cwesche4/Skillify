import type { OnboardingSignal } from './onboardingSignals'

export type OnboardingRecommendation =
  | { id: 'validation_walkthrough'; reason: OnboardingSignal }
  | { id: 'ai_coach_explanation'; reason: OnboardingSignal }
  | { id: 'preset_quick_start'; reason: OnboardingSignal }

export function resolveOnboardingRecommendations(
  signals: OnboardingSignal[],
): OnboardingRecommendation[] {
  if (!signals || signals.length === 0) return []

  const recs: OnboardingRecommendation[] = []

  signals.forEach((signal) => {
    if (signal.type === 'validation_struggle') {
      recs.push({ id: 'validation_walkthrough', reason: signal })
      return
    }
    if (signal.type === 'ai_ignored') {
      recs.push({ id: 'ai_coach_explanation', reason: signal })
      return
    }
    if (signal.type === 'presets_underused') {
      recs.push({ id: 'preset_quick_start', reason: signal })
    }
  })

  return recs
}
