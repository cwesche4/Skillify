/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Workspace-Level HUD Intelligence Profiles
   - No runtime selection
   - No persistence
   Profiles describe how hints *could* vary per workspace temperament.
============================================================================ */

export type HudIntelligenceProfile = 'conservative' | 'balanced' | 'proactive'

export interface HudProfileDescriptor {
  id: HudIntelligenceProfile
  label: string
  description: string
  // Hint categories that would be emphasized in the future (no behavior today)
  focusAreas?: Array<
    'layout' | 'docking' | 'navigation' | 'ai-coach' | 'performance'
  >
}

export const HUD_PROFILES: HudProfileDescriptor[] = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Minimal, low-frequency hints only when confidence is high.',
    focusAreas: ['layout', 'navigation'],
  },
  {
    id: 'balanced',
    label: 'Balanced',
    description: 'Contextual hints at a steady cadence, with user control.',
    focusAreas: ['layout', 'docking', 'navigation'],
  },
  {
    id: 'proactive',
    label: 'Proactive',
    description: 'Surface more opportunities (still opt-in and dismissible).',
    focusAreas: ['layout', 'docking', 'ai-coach', 'performance'],
  },
]
