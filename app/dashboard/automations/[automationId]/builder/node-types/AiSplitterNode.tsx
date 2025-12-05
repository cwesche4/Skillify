"use client"

import type { NodeProps } from "reactflow"

export function AiSplitterNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-purple-400 bg-purple-600/20 text-purple-200">
      Splitter
      <br />
      {data.label ?? ""}
    </div>
  )
}
