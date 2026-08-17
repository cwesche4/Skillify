'use client'

import type { CSSProperties } from 'react'

export type RunPath = {
  id: string
  points: { x: number; y: number }[]
  color?: string
}

interface RunHistoryOverlayProps {
  visible: boolean
  runs: RunPath[]
  opacity?: number
  className?: string
}

export default function RunHistoryOverlay({
  visible,
  runs,
  opacity = 0.25,
  className,
}: RunHistoryOverlayProps) {
  if (!visible) return null

  return (
    <svg
      className={`pointer-events-none absolute inset-0 z-10 h-full w-full ${className ?? ''}`}
    >
      {runs.map((run) => (
        <polyline
          key={run.id}
          points={run.points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          stroke={run.color || 'rgba(94, 234, 212, 0.5)'}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity } as CSSProperties}
        />
      ))}

      {/* faded nodes */}
      {runs.map((run) =>
        run.points.map((p, idx) => (
          <circle
            key={`${run.id}-${idx}`}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={run.color || 'rgba(94, 234, 212, 0.5)'}
            style={{ opacity } as CSSProperties}
          />
        )),
      )}
    </svg>
  )
}
