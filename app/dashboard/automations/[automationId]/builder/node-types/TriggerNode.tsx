"use client"

import type { NodeProps } from "reactflow"

export function TriggerNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-green-500 bg-green-600/20 text-green-200">
      {data.label ?? "Trigger"}
    </div>
  )
}
