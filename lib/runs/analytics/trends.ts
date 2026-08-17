import type { CostEstimate } from '@/lib/ai/telemetry/costEstimator'
import type { RunStatus } from '@/lib/runs/status/computeRunStatus'

export type RunTrendPoint = {
  runId: string
  timestamp: string
  status: RunStatus
  branchSignatures?: string[]
  costEstimate?: CostEstimate
}

export function computeTrends(points: RunTrendPoint[]) {
  const statusCounts = { success: 0, 'partial-failure': 0, failed: 0 }
  const costLow = points.reduce(
    (sum, p) => sum + (p.costEstimate?.estimatedCostRange[0] ?? 0),
    0,
  )
  const costHigh = points.reduce(
    (sum, p) => sum + (p.costEstimate?.estimatedCostRange[1] ?? 0),
    0,
  )

  const branchFrequency: Record<string, number> = {}
  points.forEach((p) => {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1
    for (const sig of p.branchSignatures ?? []) {
      branchFrequency[sig] = (branchFrequency[sig] ?? 0) + 1
    }
  })

  return {
    statusCounts,
    costRange: [costLow, costHigh] as [number, number],
    branchFrequency,
  }
}
