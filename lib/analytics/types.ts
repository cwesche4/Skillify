// lib/analytics/types.ts

export interface RunTrendPoint {
  date: string // YYYY-MM-DD
  total: number // count of runs
  success: number
  failed: number
  successRate: number // 0–100
}

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

export interface WorkspaceAnalyticsBundle {
  stats: BasicRunStats
  failures: FailureCluster[]
  grid: AutomationRunSummary[]
  trends: RunTrendPoint[]
}
