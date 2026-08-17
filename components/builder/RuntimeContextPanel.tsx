'use client'

import type { FC } from 'react'
import type { Node, Edge } from 'reactflow'
import { deriveGraphSummary } from '@/lib/builder/graph/deriveGraphSummary'

type Props = {
  nodes: Node[]
  edges: Edge[]
}

export const RuntimeContextPanel: FC<Props> = ({ nodes, edges }) => {
  const summary = deriveGraphSummary(nodes, edges)

  return (
    <div className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100">
      <div className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">
        Builder context (read-only)
      </div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-[12px] text-slate-200">
        <div>Nodes: {summary.nodeCount}</div>
        <div>Branches: {summary.branchCount}</div>
        <div>
          Trigger types:{' '}
          {summary.triggerTypes.length
            ? summary.triggerTypes.join(', ')
            : 'None'}
        </div>
        <div>Approvals: {summary.hasApproval ? 'Yes' : 'No'}</div>
        <div>AI nodes: {summary.hasAi ? 'Yes' : 'No'}</div>
      </div>
    </div>
  )
}

export default RuntimeContextPanel
