'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'

export default function AiSplitterNode({ data }: NodeProps) {
  const mode = data?.mode ?? 'json'
  const schemaHint =
    data?.schemaHint ?? '{ "name": string, "email": string, "message": string }'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title="AI • Splitter"
      category="AI"
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-slate-300">Mode</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {mode}
        </span>
      </div>
      <p className="mt-1 line-clamp-2 text-[10px] text-slate-400">
        {schemaHint}
      </p>
    </NodeBase>
  )
}
