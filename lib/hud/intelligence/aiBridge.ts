/* ============================================================================
   DESIGN-ONLY / INACTIVE
   AI Coach ↔ HUD Integration Contract
   - No AI calls
   - No rendering
   - No state mutation
   This describes how AI Coach insights could surface within the HUD.
============================================================================ */

export type HudAiBadgeKind = 'warning' | 'info' | 'success'

export interface HudAiBadge {
  id: string
  label: string
  kind: HudAiBadgeKind
  summary?: string
  // Future: could link to node/run context
  context?: { nodeId?: string; runId?: string }
}

export interface HudAiHint {
  id: string
  title: string
  description?: string
  badges?: HudAiBadge[]
  suggestedActionId?: string
}

export interface HudAiBridge {
  // Would map AI Coach insights to HUD-safe hints (read-only).
  toHudHints(aiInsights: unknown): HudAiHint[]
}
