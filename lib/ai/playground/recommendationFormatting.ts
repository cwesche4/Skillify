export const RECOMMENDATION_SCORE_SCALE = '0-100'

export const SCHEDULING_RECOMMENDATION_PROVENANCE = {
  sourceProviderId: 'scheduling',
  sourceEngine: 'Scheduling Knowledge',
  deterministic: true,
  scoreScale: RECOMMENDATION_SCORE_SCALE,
} as const

export function formatRecommendationScore(score: unknown): string {
  if (typeof score !== 'number' || !Number.isFinite(score)) {
    return 'Score unavailable'
  }

  const clamped = Math.max(0, Math.min(100, score))
  return `${Math.round(clamped)}%`
}

export function formatRecommendationScoreLabel(score: unknown): string {
  const formatted = formatRecommendationScore(score)
  return formatted === 'Score unavailable' ? formatted : `Score ${formatted}`
}
