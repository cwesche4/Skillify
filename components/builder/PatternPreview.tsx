'use client'

import type { FC } from 'react'
import type { Node, Edge } from 'reactflow'

type Props = {
  nodes: Node[]
  edges: Edge[]
}

// Micro-patterns.
// Static snapshots only.
// No inference, no execution behavior.
export const PatternPreview: FC<Props> = ({ nodes, edges }) => {
  return (
    <div className="rounded border border-slate-800 bg-slate-950 p-2 text-[11px] text-slate-200">
      <div className="text-[12px] font-semibold text-slate-100">
        Preview (static)
      </div>
      <div className="text-[11px] text-slate-500">
        No execution context. Copy/paste only.
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1">
        <div className="rounded bg-slate-900 px-2 py-1">
          Nodes: {nodes.length}
        </div>
        <div className="rounded bg-slate-900 px-2 py-1">
          Edges: {edges.length}
        </div>
      </div>
    </div>
  )
}

export default PatternPreview
