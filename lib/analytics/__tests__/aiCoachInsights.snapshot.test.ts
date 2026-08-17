import { describe, expect, it } from 'vitest'

import type {
  AICoachRecommendation,
  CrossRunAnalyticsInput,
} from '../aiCoachInsights'
import { deriveAICoachRecommendations } from '../aiCoachInsights'

const sortRecs = (recs: AICoachRecommendation[]) =>
  [...recs].sort((a, b) => {
    if (a.type !== b.type) return a.type.localeCompare(b.type)
    const aNode = (a as any).nodeType ?? ''
    const bNode = (b as any).nodeType ?? ''
    if (aNode !== bNode) return aNode.localeCompare(bNode)
    const aAuto = (a as any).automationId ?? ''
    const bAuto = (b as any).automationId ?? ''
    return aAuto.localeCompare(bAuto)
  })

describe('deriveAICoachRecommendations snapshots', () => {
  it('returns empty array for empty analytics', () => {
    const recs = deriveAICoachRecommendations({})
    expect(sortRecs(recs)).toMatchSnapshot()
  })

  it('handles partial analytics input', () => {
    const recs = deriveAICoachRecommendations({
      validationHotspots: [{ nodeType: 'nodeX', failureRate: 0.1 }],
    })
    expect(sortRecs(recs)).toMatchSnapshot()
  })

  it('detects validation hotspots into multiple recommendations', () => {
    const input: CrossRunAnalyticsInput = {
      validationHotspots: [
        { nodeType: 'webhook', failureRate: 0.6 },
        { nodeType: 'delay', failureRate: 0.3 },
      ],
    }
    const recs = deriveAICoachRecommendations(input)
    expect(sortRecs(recs)).toMatchSnapshot()
  })

  it('detects ai underutilization', () => {
    const input: CrossRunAnalyticsInput = {
      aiUsage: [
        { automationId: 'a1', suggestionsShown: 10, autofixApplied: 2 },
        { automationId: 'a2', suggestionsShown: 3, autofixApplied: 3 },
      ],
    }
    const recs = deriveAICoachRecommendations(input)
    expect(sortRecs(recs)).toMatchSnapshot()
  })

  it('detects declining success trend', () => {
    const input: CrossRunAnalyticsInput = {
      successTrends: [
        { automationId: 'a3', successRate: 0.7, delta: -0.2 },
        { automationId: 'a4', successRate: 0.8, delta: 0.05 },
      ],
    }
    const recs = deriveAICoachRecommendations(input)
    expect(sortRecs(recs)).toMatchSnapshot()
  })

  it('detects high inspector usage with low success', () => {
    const input: CrossRunAnalyticsInput = {
      inspectorVsSuccess: [
        { automationId: 'a5', inspectorSessions: 6, successRate: 0.4 },
        { automationId: 'a6', inspectorSessions: 2, successRate: 0.3 },
      ],
    }
    const recs = deriveAICoachRecommendations(input)
    expect(sortRecs(recs)).toMatchSnapshot()
  })

  it('detects combined scenarios deterministically', () => {
    const input: CrossRunAnalyticsInput = {
      validationHotspots: [{ nodeType: 'trigger', failureRate: 0.4 }],
      aiUsage: [{ automationId: 'a7', suggestionsShown: 8, autofixApplied: 1 }],
      successTrends: [{ automationId: 'a8', successRate: 0.5, delta: -0.15 }],
      inspectorVsSuccess: [
        { automationId: 'a9', inspectorSessions: 7, successRate: 0.35 },
      ],
    }
    const recs = deriveAICoachRecommendations(input)
    expect(sortRecs(recs)).toMatchSnapshot()
  })
})
