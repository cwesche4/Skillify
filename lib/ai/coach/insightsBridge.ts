/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Map run insights into AI Coach explanations (advisory only)
   - No AI calls
   - No actions triggered
============================================================================ */

import type { RunExecutiveSummary } from '@/lib/runs/insights/summary'

export type AICoachExplanation = {
  title: string
  detail: string
  advisory: boolean
}

// DESIGN-ONLY — derived, read-only, no side effects
export function mapRunInsightsToAICoach(
  summary: RunExecutiveSummary,
): AICoachExplanation[] {
  const explanations: AICoachExplanation[] = []
  explanations.push({
    title: 'Run insights (advisory)',
    detail: summary.headline,
    advisory: true,
  })
  summary.bullets.forEach((b, idx) => {
    explanations.push({
      title: `Insight ${idx + 1}`,
      detail: b,
      advisory: true,
    })
  })
  if (summary.confidence) {
    explanations.push({
      title: 'Confidence',
      detail: `${summary.confidence.explanation} (score ${(
        summary.confidence.score * 100
      ).toFixed(0)}%)`,
      advisory: true,
    })
  }
  return explanations
}
