"use client"

import type { NodeProps } from "reactflow"

export function AiClassifierNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-indigo-400 bg-indigo-600/20 text-indigo-200">
      Classifier
      <br />
      {(data.classes ?? []).join(", ")}
    </div>
  )
}
