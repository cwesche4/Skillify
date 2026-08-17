/* ============================================================================
   DESIGN-ONLY / INACTIVE
   Executive summary generation for runs (read-only, advisory)
   - Neutral tone, no actions
   - No telemetry or persistence
============================================================================ */

import type { RunTimelineData } from '../types'
import type { RunConfidenceSignal } from './confidence'

export interface RunExecutiveSummary {
  headline: string
  bullets: string[]
  confidence?: RunConfidenceSignal
}

// DESIGN-ONLY — derived, read-only, no side effects
export function buildExecutiveSummary({
  runs,
  confidence,
}: {
  runs: RunTimelineData[]
  confidence?: RunConfidenceSignal[]
}): RunExecutiveSummary {
  const headline = 'Run Insights'
  if (!runs.length) {
    return { headline, bullets: ['No run data available.'] }
  }

  const bullets: string[] = []

  // Example bullet 1: performance trend
  if (runs.length >= 2) {
    const latest = runs[0]
    const prev = runs[1]
    const latestDur = latest.segments.reduce((m, s) => Math.max(m, s.end), 0)
    const prevDur = prev.segments.reduce((m, s) => Math.max(m, s.end), 0)
    const diffPct = prevDur > 0 ? ((latestDur - prevDur) / prevDur) * 100 : 0
    const trend =
      Math.abs(diffPct) < 5
        ? 'similar to recent executions'
        : diffPct < 0
          ? 'faster than recent executions'
          : 'slower than recent executions'
    bullets.push(`This run is ${trend}.`)
  } else {
    bullets.push('Single run view; trends will appear with more history.')
  }

  // Example bullet 2: variance / bottleneck hint
  const varianceNode = runs[0].segments.reduce<{
    nodeId?: string
    variance?: number
  }>((acc, seg) => {
    const dur = seg.end - seg.start
    if (!acc.variance || dur > acc.variance) {
      return { nodeId: seg.nodeId, variance: dur }
    }
    return acc
  }, {})
  if (varianceNode.nodeId) {
    bullets.push(
      `One node shows increased variance compared to the baseline: ${varianceNode.nodeId}.`,
    )
  }

  // Example bullet 3: reliability / retries hint
  bullets.push(
    'Overall reliability is based on recent history; review retries and failures if present.',
  )

  const summary: RunExecutiveSummary = {
    headline,
    bullets: bullets.slice(0, 3),
  }

  if (confidence && confidence.length) {
    summary.confidence = confidence[0]
  }

  return summary
}
