/* ============================================================================
   DESIGN-ONLY / INACTIVE
   HUD Intelligence Learning Scaffold
   - No runtime storage
   - No telemetry
   - No AI calls
   This file sketches how learning signals could be derived in the future.
============================================================================ */

import type {
  HudInteractionEvent,
  HudLearningSignal,
  HudSuggestionDescriptor,
} from './types'

// Placeholder interface describing how learning might aggregate interaction history.
export interface HudLearningEngine {
  recordInteraction(event: HudInteractionEvent): void
  getSignals(): HudLearningSignal[]
  getSuggestions(): HudSuggestionDescriptor[]
}

// Example pure helper signatures (no implementation, no side effects).
export function rankSuggestions(
  suggestions: HudSuggestionDescriptor[],
  signals: HudLearningSignal[],
): HudSuggestionDescriptor[] {
  // Design-only: would sort by freq/recency/confidence in a future implementation.
  return suggestions
}

export function deriveSignals(
  interactions: HudInteractionEvent[],
): HudLearningSignal[] {
  // Design-only: would transform raw interactions into normalized signals.
  return interactions.map(() => ({
    freqScore: 0,
    recencyScore: 0,
    confidence: 0,
  }))
}
