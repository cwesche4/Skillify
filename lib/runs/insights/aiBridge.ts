/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Bridge run insights to AI Coach context (read-only)
   - No AI calls, no mutations
============================================================================ */

import type { RunExecutiveSummary } from './summary'
import type { RunConfidenceScore } from './confidence'

export type AICoachRunInsightContext = {
  summary: RunExecutiveSummary
  confidence: RunConfidenceScore[]
}

export function toAICoachContext(
  summary: RunExecutiveSummary,
  confidence: RunConfidenceScore[],
): AICoachRunInsightContext {
  return { summary, confidence }
}
