/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Baseline selection helpers for run comparisons
   - No persistence or side effects
   - Purely derived from supplied runs
============================================================================ */

import type { RunTimelineData } from '../types'

export type BaselineRun = {
  runId: string
  label?: string
  reason: 'fastest-success' | 'most-stable' | 'explicit' | 'fallback'
}

export function deriveBestRun(
  runs: RunTimelineData[],
  preferredRunId?: string | null,
): BaselineRun | null {
  if (!runs.length) return null

  if (preferredRunId) {
    const hit = runs.find((r) => r.runId === preferredRunId)
    if (hit)
      return { runId: hit.runId, label: hit.runLabel, reason: 'explicit' }
  }

  const successful = runs.filter((r) => r.runStatus === 'SUCCESS')
  if (successful.length) {
    const fastest = successful.reduce((best, curr) => {
      const bestDuration = best.segments.reduce((m, s) => Math.max(m, s.end), 0)
      const currDuration = curr.segments.reduce((m, s) => Math.max(m, s.end), 0)
      return currDuration < bestDuration ? curr : best
    })
    return {
      runId: fastest.runId,
      label: fastest.runLabel,
      reason: 'fastest-success',
    }
  }

  // Fallback: first run
  const first = runs[0]
  return { runId: first.runId, label: first.runLabel, reason: 'fallback' }
}
