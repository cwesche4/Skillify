"use client"

import type { NodeProps } from "reactflow"

export function OrPathNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-pink-500 bg-pink-600/20 text-pink-200">
      OR Path
      <br />
      {data.label ?? ""}
    </div>
  )
}
