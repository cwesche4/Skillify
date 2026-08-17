import { describe, expect, it } from 'vitest'

import type {
  AIGeneratedPresetDraft,
  AIPresetAnalyticsInput,
} from '../aiGeneratedPresets'
import { generateAIPresetDrafts } from '../aiGeneratedPresets'

const sortDrafts = (drafts: AIGeneratedPresetDraft[]) =>
  [...drafts].sort((a, b) => {
    if (a.nodeType !== b.nodeType) return a.nodeType.localeCompare(b.nodeType)
    if (a.name !== b.name) return a.name.localeCompare(b.name)
    return a.id.localeCompare(b.id)
  })

describe('generateAIPresetDrafts snapshots', () => {
  it('returns empty array for empty analytics', () => {
    const drafts = generateAIPresetDrafts({})
    expect(sortDrafts(drafts)).toMatchSnapshot()
  })

  it('handles partial analytics input', () => {
    const drafts = generateAIPresetDrafts({
      highPerformingNodes: [
        { nodeType: 'alpha', successRate: 0.9, commonConfig: { foo: 'bar' } },
      ],
    })
    expect(sortDrafts(drafts)).toMatchSnapshot()
  })

  it('creates drafts for validation hotspots', () => {
    const input: AIPresetAnalyticsInput = {
      validationHotspots: [
        { nodeType: 'beta', failureRate: 0.6 },
        { nodeType: 'gamma', failureRate: 0.3 },
      ],
    }
    const drafts = generateAIPresetDrafts(input)
    expect(sortDrafts(drafts)).toMatchSnapshot()
  })

  it('creates drafts for high-performing nodes with confidence derivation', () => {
    const input: AIPresetAnalyticsInput = {
      highPerformingNodes: [
        { nodeType: 'delta', successRate: 0.86, commonConfig: { retries: 1 } },
        {
          nodeType: 'epsilon',
          successRate: 0.72,
          commonConfig: { retries: 2 },
        },
        { nodeType: 'zeta', successRate: 0.5, commonConfig: { retries: 3 } },
      ],
    }
    const drafts = generateAIPresetDrafts(input)
    expect(sortDrafts(drafts)).toMatchSnapshot()
  })

  it('creates drafts for ai usage patterns (ignored suggestions)', () => {
    const input: AIPresetAnalyticsInput = {
      aiUsagePatterns: [
        { nodeType: 'theta', suggestionsApplied: 1, suggestionsIgnored: 6 },
        { nodeType: 'iota', suggestionsApplied: 2, suggestionsIgnored: 3 },
        { nodeType: 'kappa', suggestionsApplied: 3, suggestionsIgnored: 1 },
      ],
    }
    const drafts = generateAIPresetDrafts(input)
    expect(sortDrafts(drafts)).toMatchSnapshot()
  })

  it('ensures duplicate inputs produce stable ids', () => {
    const input: AIPresetAnalyticsInput = {
      highPerformingNodes: [
        { nodeType: 'lambda', successRate: 0.8, commonConfig: { a: 1 } },
      ],
      validationHotspots: [{ nodeType: 'mu', failureRate: 0.4 }],
      aiUsagePatterns: [
        { nodeType: 'nu', suggestionsApplied: 0, suggestionsIgnored: 4 },
      ],
    }
    const drafts1 = sortDrafts(generateAIPresetDrafts(input))
    const drafts2 = sortDrafts(generateAIPresetDrafts(input))
    expect(drafts1).toEqual(drafts2)
    expect(drafts1).toMatchSnapshot()
  })
})
