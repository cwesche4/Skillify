export type AICoachRecommendation =
  | {
      type: 'stability_risk'
      nodeType?: string
      severity: 'low' | 'medium' | 'high'
      evidence: string
    }
  | {
      type: 'ai_underutilized'
      automationId?: string
      evidence: string
    }
  | {
      type: 'validation_hotspot'
      nodeType: string
      failureRate: number
      evidence: string
    }

export type CrossRunAnalyticsInput = {
  validationHotspots?: Array<{ nodeType: string; failureRate: number }>
  aiUsage?: Array<{
    automationId?: string
    suggestionsShown: number
    autofixApplied: number
  }>
  successTrends?: Array<{
    automationId?: string
    successRate: number
    delta?: number
  }>
  inspectorVsSuccess?: Array<{
    automationId?: string
    inspectorSessions: number
    successRate: number
  }>
}

function severityFromRate(rate: number): 'low' | 'medium' | 'high' {
  if (rate >= 0.5) return 'high'
  if (rate >= 0.25) return 'medium'
  return 'low'
}

export function deriveAICoachRecommendations(
  analytics: CrossRunAnalyticsInput | undefined,
): AICoachRecommendation[] {
  if (!analytics) return []

  const recommendations: AICoachRecommendation[] = []

  // Validation hotspots (by node type)
  for (const hotspot of analytics.validationHotspots || []) {
    if (!hotspot || typeof hotspot.failureRate !== 'number') continue
    recommendations.push({
      type: 'validation_hotspot',
      nodeType: hotspot.nodeType,
      failureRate: hotspot.failureRate,
      evidence: `Validation failure rate ${hotspot.failureRate.toFixed(2)} for ${hotspot.nodeType}`,
    })
    recommendations.push({
      type: 'stability_risk',
      nodeType: hotspot.nodeType,
      severity: severityFromRate(hotspot.failureRate),
      evidence: `Repeated validation failures for ${hotspot.nodeType}`,
    })
  }

  // AI underutilization (shown >> applied)
  for (const usage of analytics.aiUsage || []) {
    if (!usage) continue
    const ignored = Math.max(
      (usage.suggestionsShown || 0) - (usage.autofixApplied || 0),
      0,
    )
    if (ignored > 2) {
      recommendations.push({
        type: 'ai_underutilized',
        automationId: usage.automationId,
        evidence: `${ignored} suggestions ignored`,
      })
    }
  }

  // Success trend stability
  for (const trend of analytics.successTrends || []) {
    if (!trend || typeof trend.delta !== 'number') continue
    if (trend.delta < -0.1) {
      recommendations.push({
        type: 'stability_risk',
        nodeType: undefined,
        severity: severityFromRate(Math.abs(trend.delta)),
        evidence: `Success rate declining by ${(trend.delta * -100).toFixed(1)}%`,
      })
    }
  }

  // High Inspector usage but low success
  for (const row of analytics.inspectorVsSuccess || []) {
    if (!row) continue
    if ((row.inspectorSessions || 0) > 5 && (row.successRate || 0) < 0.5) {
      recommendations.push({
        type: 'stability_risk',
        severity: 'medium',
        evidence: `High Inspector usage with low success (${(row.successRate * 100).toFixed(1)}%)`,
      })
    }
  }

  return recommendations
}
