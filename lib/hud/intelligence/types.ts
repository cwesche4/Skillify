/* ============================================================================
   DESIGN-ONLY / INACTIVE
   HUD Intelligence Scaffolding
   - No runtime learning
   - No state mutation
   - No persistence
   These types describe how HUD behavior could be learned in the future.
============================================================================ */

export type HudInteractionEvent =
  | { type: 'toggle'; controlId: string; ts: number }
  | { type: 'action'; actionId: string; ts: number }
  | {
      type: 'panel'
      panel: 'left' | 'right'
      state: 'open' | 'closed'
      ts: number
    }
  | {
      type: 'docking'
      mode:
        | 'floating'
        | 'dock-top-left'
        | 'dock-top-right'
        | 'dock-bottom-left'
        | 'dock-bottom-right'
      ts: number
    }

export interface HudLearningSignal {
  freqScore: number
  recencyScore: number
  confidence: number
}

export interface HudSuggestionDescriptor {
  id: string
  label: string
  description?: string
  hint?: string
  // purely descriptive: no execution
  recommendedActionId?: string
  learning?: HudLearningSignal
}

export interface HudLearningSnapshot {
  workspaceId: string
  automationId: string
  interactions: HudInteractionEvent[]
  suggestions: HudSuggestionDescriptor[]
}
