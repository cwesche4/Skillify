'use client'

import type { NodeProps } from 'reactflow'
import NodeBase from './NodeBase'
import { getWorkflowNodeDefinition } from '@/lib/workflows/nodeRegistry'

export default function AiLLMNode({ data }: NodeProps) {
  const definition =
    typeof data?.__registryNodeId === 'string'
      ? getWorkflowNodeDefinition(data.__registryNodeId)
      : undefined
  const model = data?.model ?? 'gpt-4.1-mini'
  const prompt =
    data?.prompt ?? data?.instructions ?? 'No prompt configured yet.'

  const isActive = data?.status === 'running' || data?.__active === true
  const isHot = data?.__hot === true

  return (
    <NodeBase
      title={data?.label ?? definition?.label ?? 'AI Prompt'}
      category={definition?.category ?? 'AI'}
      iconKey={data?.__iconKey ?? definition?.iconKey ?? 'bot'}
      tone="ai"
      isActive={isActive}
      isHot={isHot}
    >
      <p className="line-clamp-2 text-[11px] text-slate-300">
        {definition?.description ??
          'Uses AI to generate, summarize, or transform text.'}
      </p>
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>Model</span>
        <span className="rounded-full bg-slate-900/80 px-1.5 py-0.5 text-[10px] text-slate-100">
          {model}
        </span>
      </div>
      <p className="line-clamp-2 text-[10px] text-slate-500">{prompt}</p>
    </NodeBase>
  )
}
