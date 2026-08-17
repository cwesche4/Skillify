'use client'

import type { RunTimelineData } from '@/lib/runs/types'
import { getActiveSegment } from '@/lib/runs/timeline'

interface RunReplayOverlayProps {
  runs: RunTimelineData[]
  currentTime: number
  className?: string
}

export default function RunReplayOverlay({
  runs,
  currentTime,
  className,
}: RunReplayOverlayProps) {
  const active = getActiveSegment(runs, currentTime)

  if (!active) return null

  return (
    <div
      className={`pointer-events-none absolute inset-0 z-40 ${className ?? ''}`}
      aria-label="Run replay overlay"
    >
      <div className="absolute left-4 top-4 rounded-lg border border-cyan-400/50 bg-cyan-500/10 px-3 py-2 text-[11px] font-semibold text-cyan-100 shadow-lg">
        Replay: {active.label ?? active.nodeId ?? active.id} — {active.status}
      </div>
    </div>
  )
}
