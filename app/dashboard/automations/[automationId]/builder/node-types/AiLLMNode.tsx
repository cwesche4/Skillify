"use client"

import type { NodeProps } from "reactflow"

export function AiLLMNode({ data }: NodeProps<any>) {
  return (
    <div className="node-base border border-indigo-500 bg-indigo-600/20 text-indigo-200">
      AI • LLM
      <br />
      {data.label ?? "Model"}
    </div>
  )
}
