"use client"

import type { NodeProps } from "reactflow"

export function GroupNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-slate-700 bg-slate-800 text-slate-300">
      Group ({data.count ?? 0})
    </div>
  )
}
