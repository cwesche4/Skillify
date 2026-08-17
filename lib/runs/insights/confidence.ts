/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Run confidence signals derived from existing run data
   - No persistence, telemetry, or AI calls
   - Purely informational / read-only
   - Signals are limited to allowed, explainable factors
============================================================================ */

import type { RunTimelineData } from '../types'

export type RunConfidenceSignalName =
  | 'nodeExecutionConsistency'
  | 'failureRecurrence'
  | 'durationVariance'
  | 'retryPattern'
  | 'statusStability'

export interface RunConfidenceSignal {
  score: number // 0–1, higher = higher confidence
  factors: {
    stability: number
    reliability: number
    variance: number
  }
  explanation: string
  signal: RunConfidenceSignalName
  nodeId?: string
}

// Alias for advisory contexts that expect a score payload
export type RunConfidenceScore = RunConfidenceSignal

// DESIGN-ONLY — derived, read-only, no side effects
export function deriveConfidenceSignals(
  runs: RunTimelineData[],
): RunConfidenceSignal[] {
  if (!runs.length) return []
  const baseline = runs[0]
  const signals: RunConfidenceSignal[] = []

  const nodeStats: Record<
    string,
    { durations: number[]; failures: number; retries: number }
  > = {}

  runs.forEach((run) => {
    run.segments.forEach((seg) => {
      if (!seg.nodeId) return
      if (!nodeStats[seg.nodeId]) {
        nodeStats[seg.nodeId] = { durations: [], failures: 0, retries: 0 }
      }
      nodeStats[seg.nodeId].durations.push(seg.end - seg.start)
      if (seg.status === 'FAILED') nodeStats[seg.nodeId].failures += 1
      const retries = (seg as any).retries ?? 0
      nodeStats[seg.nodeId].retries += retries
    })
  })

  Object.entries(nodeStats).forEach(([nodeId, stats]) => {
    const n = stats.durations.length || 1
    const mean = stats.durations.reduce((a, b) => a + b, 0) / n
    const variance =
      stats.durations.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / n
    const stability = 1 - Math.min(1, variance / Math.max(mean, 1))
    const reliability = 1 - Math.min(1, stats.failures / Math.max(n, 1))
    const varianceFactor = 1 - Math.min(1, variance / Math.max(mean, 1))
    const score = Math.max(
      0,
      Math.min(1, (stability + reliability + varianceFactor) / 3),
    )
    signals.push({
      nodeId,
      signal: 'durationVariance',
      score,
      factors: {
        stability,
        reliability,
        variance: varianceFactor,
      },
      explanation: `Duration variance for ${nodeId} vs baseline (${baseline.runId}).`,
    })

    const failureScore =
      1 - Math.min(1, stats.failures / Math.max(runs.length, 1))
    signals.push({
      nodeId,
      signal: 'failureRecurrence',
      score: failureScore,
      factors: {
        stability: stability,
        reliability: failureScore,
        variance: varianceFactor,
      },
      explanation: `Failure recurrence for ${nodeId} across ${runs.length} run(s).`,
    })
  })

  return signals
}
