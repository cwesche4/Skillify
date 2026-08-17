'use client'

import type { CSSProperties } from 'react'
import type { Node as RFNode } from 'reactflow'

interface NodeLocksOverlayProps {
  lockedNodeIds: Set<string>
  nodes: RFNode[]
  project: (p: { x: number; y: number }) => { x: number; y: number }
}

export default function NodeLocksOverlay({
  lockedNodeIds,
  nodes,
  project,
}: NodeLocksOverlayProps) {
  if (!lockedNodeIds.size) return null

  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {nodes
        .filter((n) => lockedNodeIds.has(n.id))
        .map((n) => {
          const p = project({ x: n.position.x, y: n.position.y })
          return (
            <div
              key={n.id}
              className="absolute -translate-y-3 translate-x-3"
              style={
                {
                  left: p.x,
                  top: p.y,
                } as CSSProperties
              }
            >
              <div className="pointer-events-auto rounded-full border border-amber-400/60 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-100 shadow-md">
                Locked
              </div>
            </div>
          )
        })}
    </div>
  )
}
