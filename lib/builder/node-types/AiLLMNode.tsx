'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function AiLLMNode({ data }: NodeProps) {
  const model = data?.model ?? 'gpt-4.1-mini'
  const temperature = data?.temperature ?? 0.2
  const prompt = data?.prompt ?? 'No prompt configured yet.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="AI • LLM"
      category="AI"
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Model</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {model}
        </span>
      </div>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Temperature</span>
        <span className="text-slate-300">{temperature}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">{prompt}</p>
    </NodeBase>
  )
}
