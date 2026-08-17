import { describe, expect, it } from 'vitest'

import type { InspectorHeatmapPoint } from '../inspectorAggregates'
import { detectOnboardingSignals } from '../onboardingSignals'

type Signal = ReturnType<typeof detectOnboardingSignals>[number]

function sortSignals(signals: Signal[]) {
  return [...signals].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    const aSeverity = (a as any).severity ?? ''
    const bSeverity = (b as any).severity ?? ''
    if (aSeverity !== bSeverity) return aSeverity.localeCompare(bSeverity)
    const aCount = (a as any).count ?? 0
    const bCount = (b as any).count ?? 0
    return aCount - bCount
  })
}

const makePoint = (
  event: string,
  count: number,
  overrides: Partial<InspectorHeatmapPoint> = {},
): InspectorHeatmapPoint => ({
  workspaceId: 'w1',
  nodeType: 'nodeA',
  tab: 'config',
  bucket: 'day',
  event,
  count,
  ...overrides,
})

describe('detectOnboardingSignals snapshots', () => {
  it('returns empty array for empty analytics', () => {
    const signals = detectOnboardingSignals({})
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects validation struggle severity low', () => {
    const signals = detectOnboardingSignals({
      validation: [makePoint('inspector_validation_failed', 5)],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects validation struggle severity medium', () => {
    const signals = detectOnboardingSignals({
      validation: [makePoint('inspector_validation_failed', 15)],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects validation struggle severity high', () => {
    const signals = detectOnboardingSignals({
      validation: [makePoint('inspector_validation_failed', 25)],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects ai ignored using aiRates', () => {
    const signals = detectOnboardingSignals({
      aiRates: [{ shown: 12, applied: 5, failed: 0 }],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects ai ignored using ai heatmap fallback', () => {
    const signals = detectOnboardingSignals({
      ai: [
        makePoint('inspector_ai_suggestion_shown', 8),
        makePoint('inspector_ai_autofix_applied', 3),
      ],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects presets underused when saved but not applied', () => {
    const signals = detectOnboardingSignals({
      presets: [
        makePoint('inspector_preset_saved', 2),
        makePoint('inspector_preset_applied', 0),
      ],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('detects mixed signals deterministically', () => {
    const signals = detectOnboardingSignals({
      validation: [makePoint('inspector_validation_failed', 12)],
      aiRates: [{ shown: 9, applied: 4, failed: 0 }],
      presets: [
        makePoint('inspector_preset_saved', 1),
        makePoint('inspector_preset_applied', 0),
      ],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })

  it('handles partial analytics input', () => {
    const signals = detectOnboardingSignals({
      validation: [
        makePoint('inspector_validation_failed', 2, { workspaceId: 'w2' }),
      ],
    })
    expect(sortSignals(signals)).toMatchSnapshot()
  })
})
