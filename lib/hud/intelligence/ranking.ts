/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Telemetry-Backed Hint Ranking (Concept)
   - No telemetry calls
   - No analytics
   - No side effects
============================================================================ */

export interface HudHintRankingSignal {
  frequency: number
  recency: number
  confidence: number
}

export interface HudHintRankingInput {
  id: string
  label: string
  signal: HudHintRankingSignal
}

export interface HudHintRankingResult extends HudHintRankingInput {
  score: number
}

export function computeRanking(
  inputs: HudHintRankingInput[],
): HudHintRankingResult[] {
  // Design-only placeholder: a future version could weight frequency/recency/confidence.
  return inputs.map((i) => ({
    ...i,
    score: (i.signal.frequency + i.signal.recency + i.signal.confidence) / 3,
  }))
}
