import type { InspectorHeatmapPoint } from './inspectorAggregates'

export type OnboardingSignal =
  | { type: 'validation_struggle'; severity: 'low' | 'medium' | 'high' }
  | { type: 'ai_ignored'; count: number }
  | { type: 'presets_underused' }

type AnalyticsInputs = {
  validation?: InspectorHeatmapPoint[]
  ai?: InspectorHeatmapPoint[]
  presets?: InspectorHeatmapPoint[]
  aiRates?: {
    shown: number
    applied: number
    failed: number
  }[]
}

function sumCounts(points: InspectorHeatmapPoint[] | undefined, event: string) {
  if (!points || points.length === 0) return 0
  return points.reduce(
    (acc, p) => (p.event === event ? acc + (p.count || 0) : acc),
    0,
  )
}

export function detectOnboardingSignals(
  inputs: AnalyticsInputs,
): OnboardingSignal[] {
  const signals: OnboardingSignal[] = []

  // Validation struggle detection
  const validationFailures = sumCounts(
    inputs.validation,
    'inspector_validation_failed',
  )
  if (validationFailures > 0) {
    const severity =
      validationFailures > 20
        ? 'high'
        : validationFailures > 10
          ? 'medium'
          : 'low'
    signals.push({ type: 'validation_struggle', severity })
  }

  // AI ignored detection (suggestions shown minus applied)
  const aiShown =
    inputs.aiRates?.reduce((acc, r) => acc + (r.shown || 0), 0) ??
    sumCounts(inputs.ai, 'inspector_ai_suggestion_shown')
  const aiApplied =
    inputs.aiRates?.reduce((acc, r) => acc + (r.applied || 0), 0) ??
    sumCounts(inputs.ai, 'inspector_ai_autofix_applied')
  const aiIgnored = Math.max(aiShown - aiApplied, 0)
  if (aiIgnored > 0) {
    signals.push({ type: 'ai_ignored', count: aiIgnored })
  }

  // Presets underused detection (no apply events)
  const presetsApplied = sumCounts(inputs.presets, 'inspector_preset_applied')
  const presetsSaved = sumCounts(inputs.presets, 'inspector_preset_saved')
  if (presetsSaved > 0 && presetsApplied === 0) {
    signals.push({ type: 'presets_underused' })
  }

  return signals
}
