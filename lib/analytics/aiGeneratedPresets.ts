export type AIPresetAnalyticsInput = {
  highPerformingNodes?: Array<{
    nodeType: string
    successRate: number
    commonConfig: Record<string, any>
  }>
  validationHotspots?: Array<{
    nodeType: string
    failureRate: number
    commonFailures?: string[]
  }>
  aiUsagePatterns?: Array<{
    nodeType: string
    suggestionsApplied: number
    suggestionsIgnored: number
  }>
}

export type AIGeneratedPresetDraft = {
  id: string
  nodeType: string
  name: string
  data: Record<string, any>
  confidence: 'low' | 'medium' | 'high'
  evidence: string
  source: 'ai'
}

function hashString(input: string) {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i)
    hash |= 0
  }
  return `ai-${Math.abs(hash)}`
}

function confidenceFromRate(rate: number) {
  if (rate >= 0.85) return 'high'
  if (rate >= 0.7) return 'medium'
  return 'low'
}

export function generateAIPresetDrafts(
  analytics: AIPresetAnalyticsInput | undefined,
): AIGeneratedPresetDraft[] {
  if (!analytics) return []

  const drafts: AIGeneratedPresetDraft[] = []

  for (const item of analytics.highPerformingNodes || []) {
    if (!item || !item.nodeType) continue
    const name = `${item.nodeType} high-performing preset`
    const data = item.commonConfig || {}
    const confidence = confidenceFromRate(item.successRate ?? 0)
    const evidence = `Success rate ${(item.successRate ?? 0).toFixed(2)}`
    drafts.push({
      id: hashString(`${item.nodeType}|${name}|${JSON.stringify(data)}`),
      nodeType: item.nodeType,
      name,
      data,
      confidence,
      evidence,
      source: 'ai',
    })
  }

  for (const item of analytics.validationHotspots || []) {
    if (!item || !item.nodeType) continue
    const name = `${item.nodeType} validation draft`
    const data: Record<string, any> = {}
    const confidence =
      item.failureRate >= 0.5
        ? 'high'
        : item.failureRate >= 0.25
          ? 'medium'
          : 'low'
    const evidence = `Failure rate ${(item.failureRate ?? 0).toFixed(2)}`
    drafts.push({
      id: hashString(`${item.nodeType}|${name}|${JSON.stringify(data)}|v`),
      nodeType: item.nodeType,
      name,
      data,
      confidence,
      evidence,
      source: 'ai',
    })
  }

  for (const item of analytics.aiUsagePatterns || []) {
    if (!item || !item.nodeType) continue
    const ignored =
      typeof item.suggestionsIgnored === 'number' ? item.suggestionsIgnored : 0
    if (ignored <= 0) continue
    const name = `${item.nodeType} ai-usage draft`
    const data: Record<string, any> = {}
    const confidence = ignored > 5 ? 'high' : ignored > 2 ? 'medium' : 'low'
    const evidence = `${ignored} suggestions ignored`
    drafts.push({
      id: hashString(`${item.nodeType}|${name}|${JSON.stringify(data)}|a`),
      nodeType: item.nodeType,
      name,
      data,
      confidence,
      evidence,
      source: 'ai',
    })
  }

  return drafts
}
