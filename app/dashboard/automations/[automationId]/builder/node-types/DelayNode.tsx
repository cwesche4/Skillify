"use client"

import type { NodeProps } from "reactflow"

export function DelayNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-yellow-500 bg-yellow-600/20 text-yellow-200">
      Delay: {data.durationMinutes ?? 10} min
    </div>
  )
}
