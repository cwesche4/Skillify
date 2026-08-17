type InsightMetric = {
  nodeId: string
  nodeLabel?: string
  failures: number
  avgDurationMs: number
  retryCount: number
  slaBreaches: number
}

type RunStats = {
  nodeId: string
  nodeLabel?: string
  durations: number[]
  failures: number
  retries: number
  slaBreaches: number
}

export function computeFlowInsights(stats: RunStats[]): InsightMetric[] {
  return stats.map((s) => ({
    nodeId: s.nodeId,
    nodeLabel: s.nodeLabel,
    failures: s.failures,
    avgDurationMs:
      s.durations.length === 0
        ? 0
        : Math.round(
            s.durations.reduce((a, b) => a + b, 0) / s.durations.length,
          ),
    retryCount: s.retries,
    slaBreaches: s.slaBreaches,
  }))
}
