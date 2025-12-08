// lib/analytics/types.ts

export interface BasicRunStats {
  total: number
  success: number
  failed: number
  pending: number
  running: number
  successRate: number
  avgDurationMs: number
}

export interface FailureCluster {
  reason: string
  count: number
}

export interface AutomationRunSummary {
  automationId: string
  automationName: string
  totalRuns: number
  successRate: number
  avgDurationMs: number
  lastRunAt: Date | null
}
